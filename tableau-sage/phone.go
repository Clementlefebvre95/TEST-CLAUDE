package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"log"
	"math/big"
	"net"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Phone access. When it is on, the dashboard also listens on this PC's network
// addresses (the office Wi-Fi, Tailscale). A phone types the access code once,
// then carries a signed session cookie. Setup and settings stay reachable from
// this PC only, and nothing listens on the network while phone access is off.

const (
	sessionCookie   = "tableau_sage"
	sessionLifetime = 180 * 24 * time.Hour
	loginWindow     = 15 * time.Minute
	loginMaxPerIP   = 5  // failed codes per address per window
	loginMaxTotal   = 20 // failed codes from everywhere per window
)

type PhoneAddress struct {
	URL  string `json:"url"`
	Kind string `json:"kind"` // "lan" (office network) or "tailscale"
}

type phoneAccess struct {
	mu       sync.Mutex
	enabled  bool
	code     string // 8 digits
	secret   []byte // signs session cookies; renewed with the code
	port     string
	handler  http.Handler
	servers  map[string]*http.Server // by listen address
	bindErr  map[string]string
	fails    map[string][]time.Time // failed codes by client address
	allFails []time.Time
}

func newPhoneAccess(port string) *phoneAccess {
	return &phoneAccess{
		port:    port,
		servers: map[string]*http.Server{},
		bindErr: map[string]string{},
		fails:   map[string][]time.Time{},
	}
}

// newPhoneCode draws a fresh access code and signing secret.
func newPhoneCode() (string, []byte) {
	n, err := rand.Int(rand.Reader, big.NewInt(100_000_000))
	if err != nil {
		panic(err)
	}
	secret := make([]byte, 32)
	if _, err := rand.Read(secret); err != nil {
		panic(err)
	}
	return fmt.Sprintf("%08d", n.Int64()), secret
}

func (p *phoneAccess) setHandler(h http.Handler) {
	p.mu.Lock()
	p.handler = h
	p.mu.Unlock()
}

// set applies the saved settings and opens or closes the network listeners.
func (p *phoneAccess) set(enabled bool, code string, secret []byte) {
	p.mu.Lock()
	p.enabled = enabled && len(code) == 8 && len(secret) > 0
	p.code, p.secret = code, secret
	p.mu.Unlock()
	p.sync()
}

func (p *phoneAccess) isEnabled() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.enabled
}

func (p *phoneAccess) current() (bool, string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.enabled, p.code
}

// run keeps the listeners in step with the network: an address that appears
// later (Tailscale started after the dashboard, a new DHCP lease) is picked up.
func (p *phoneAccess) run() {
	for range time.Tick(30 * time.Second) {
		p.sync()
	}
}

func (p *phoneAccess) sync() {
	p.mu.Lock()
	defer p.mu.Unlock()
	want := map[string]bool{}
	if p.enabled && p.handler != nil {
		for _, ip := range networkIPs() {
			want[net.JoinHostPort(ip.String(), p.port)] = true
		}
	}
	for addr, srv := range p.servers {
		if !want[addr] {
			srv.Close()
			delete(p.servers, addr)
			fmt.Printf("Accès téléphone fermé sur http://%s/\n", addr)
		}
	}
	for addr := range p.bindErr {
		if !want[addr] {
			delete(p.bindErr, addr)
		}
	}
	for addr := range want {
		if p.servers[addr] != nil {
			continue
		}
		ln, err := net.Listen("tcp4", addr)
		if err != nil {
			if p.bindErr[addr] != err.Error() {
				log.Printf("Accès téléphone impossible sur %s : %v", addr, err)
			}
			p.bindErr[addr] = err.Error()
			continue
		}
		delete(p.bindErr, addr)
		srv := &http.Server{Handler: p.handler, ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 2 * time.Minute}
		p.servers[addr] = srv
		go srv.Serve(ln)
		fmt.Printf("Accès téléphone ouvert sur http://%s/\n", addr)
	}
}

// addresses lists the URLs a phone can open, office network first.
func (p *phoneAccess) addresses() []PhoneAddress {
	p.mu.Lock()
	defer p.mu.Unlock()
	var out []PhoneAddress
	for addr := range p.servers {
		host, _, _ := net.SplitHostPort(addr)
		out = append(out, PhoneAddress{URL: "http://" + addr, Kind: ipKind(net.ParseIP(host))})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Kind != out[j].Kind {
			return out[i].Kind == "lan"
		}
		return out[i].URL < out[j].URL
	})
	return out
}

func (p *phoneAccess) problems() []string {
	p.mu.Lock()
	defer p.mu.Unlock()
	var out []string
	for addr, msg := range p.bindErr {
		out = append(out, addr+" : "+msg)
	}
	sort.Strings(out)
	return out
}

var tailscaleNet = &net.IPNet{IP: net.IPv4(100, 64, 0, 0), Mask: net.CIDRMask(10, 32)}

func ipKind(ip net.IP) string {
	if ip != nil && tailscaleNet.Contains(ip) {
		return "tailscale"
	}
	return "lan"
}

// virtualAdapters are network cards that only lead to virtual machines or
// containers on this PC; no phone is on the other side.
var virtualAdapters = []string{"vethernet", "hyper-v", "virtualbox", "vmware", "docker", "wsl", "vboxnet", "virbr", "veth"}

// networkIPs returns this PC's IPv4 addresses a phone could reach.
func networkIPs() []net.IP {
	var out []net.IP
	ifaces, _ := net.Interfaces()
next:
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		name := strings.ToLower(iface.Name)
		for _, v := range virtualAdapters {
			if strings.Contains(name, v) {
				continue next
			}
		}
		addrs, _ := iface.Addrs()
		for _, a := range addrs {
			ipnet, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			if ip := ipnet.IP.To4(); usable(ip) {
				out = append(out, ip)
			}
		}
	}
	if len(out) == 0 {
		out = routeIPs()
	}
	return out
}

func usable(ip net.IP) bool {
	return ip != nil && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() && !ip.IsUnspecified()
}

// routeIPs is the fallback when the network cards cannot be listed: it asks
// the routing table which local address leads to the network in general and
// to Tailscale (100.100.100.100 is its internal DNS). Connecting a UDP socket
// only picks a route; nothing is sent.
func routeIPs() []net.IP {
	var out []net.IP
	seen := map[string]bool{}
	for _, target := range []string{"192.0.2.1:9", "100.100.100.100:53"} {
		c, err := net.Dial("udp4", target)
		if err != nil {
			continue
		}
		ip := c.LocalAddr().(*net.UDPAddr).IP.To4()
		c.Close()
		if usable(ip) && !seen[ip.String()] {
			seen[ip.String()] = true
			out = append(out, ip)
		}
	}
	return out
}

func (p *phoneAccess) sign(payload string) string {
	mac := hmac.New(sha256.New, p.secret)
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// issue returns a session cookie valid for sessionLifetime. It carries only
// its expiry and a signature: changing the code renews the secret, which
// signs every phone out.
func (p *phoneAccess) issue(now time.Time) *http.Cookie {
	p.mu.Lock()
	defer p.mu.Unlock()
	exp := strconv.FormatInt(now.Add(sessionLifetime).Unix(), 10)
	return &http.Cookie{
		Name: sessionCookie, Value: exp + "." + p.sign(exp), Path: "/",
		MaxAge: int(sessionLifetime.Seconds()), HttpOnly: true, SameSite: http.SameSiteLaxMode,
	}
}

func (p *phoneAccess) valid(r *http.Request, now time.Time) bool {
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return false
	}
	exp, sig, ok := strings.Cut(c.Value, ".")
	if !ok {
		return false
	}
	until, err := strconv.ParseInt(exp, 10, 64)
	if err != nil || now.Unix() > until {
		return false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.enabled && len(p.secret) > 0 && hmac.Equal([]byte(sig), []byte(p.sign(exp)))
}

func (p *phoneAccess) checkCode(input string) bool {
	var digits strings.Builder
	for _, r := range input {
		if r >= '0' && r <= '9' {
			digits.WriteRune(r)
		}
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.enabled && len(p.code) == 8 &&
		subtle.ConstantTimeCompare([]byte(digits.String()), []byte(p.code)) == 1
}

func recent(times []time.Time, now time.Time) []time.Time {
	kept := times[:0]
	for _, t := range times {
		if now.Sub(t) < loginWindow {
			kept = append(kept, t)
		}
	}
	return kept
}

// loginWait says how long a client must wait before trying another code:
// loginMaxPerIP failures from one address, or loginMaxTotal from all, within
// loginWindow. With 8 digits that leaves guessing hopeless.
func (p *phoneAccess) loginWait(ip string, now time.Time) time.Duration {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.allFails = recent(p.allFails, now)
	mine := recent(p.fails[ip], now)
	if len(mine) == 0 {
		delete(p.fails, ip)
	} else {
		p.fails[ip] = mine
	}
	switch {
	case len(mine) >= loginMaxPerIP:
		return mine[0].Add(loginWindow).Sub(now)
	case len(p.allFails) >= loginMaxTotal:
		return p.allFails[0].Add(loginWindow).Sub(now)
	}
	return 0
}

func (p *phoneAccess) loginFailed(ip string, now time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.fails[ip] = append(p.fails[ip], now)
	p.allFails = append(p.allFails, now)
}

func (p *phoneAccess) loginSucceeded(ip string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	delete(p.fails, ip)
}
