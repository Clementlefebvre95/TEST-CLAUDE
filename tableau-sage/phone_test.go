package main

import (
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
	"time"
)

func TestPhoneSession(t *testing.T) {
	p := newPhoneAccess("8765")
	code, secret := newPhoneCode()
	if len(code) != 8 || strings.Trim(code, "0123456789") != "" {
		t.Fatalf("code %q is not 8 digits", code)
	}
	p.set(true, code, secret)
	now := time.Now()
	req := func(c *http.Cookie) *http.Request {
		r := httptest.NewRequest("GET", "/api/sales", nil)
		if c != nil {
			r.AddCookie(c)
		}
		return r
	}

	c := p.issue(now)
	if !p.valid(req(c), now) {
		t.Fatal("fresh session rejected")
	}
	if p.valid(req(nil), now) {
		t.Error("no cookie accepted")
	}
	if p.valid(req(c), now.Add(sessionLifetime+time.Minute)) {
		t.Error("expired session accepted")
	}
	forged := *c
	forged.Value = "99999999999." + strings.SplitN(c.Value, ".", 2)[1]
	if p.valid(req(&forged), now) {
		t.Error("session with a changed expiry accepted")
	}
	if !p.checkCode(code[:4]+" "+code[4:]) || p.checkCode("") || p.checkCode(code[:7]) {
		t.Error("code check wrong")
	}

	newCode, newSecret := newPhoneCode()
	p.set(true, newCode, newSecret)
	if p.valid(req(c), now) {
		t.Error("a new code must sign every phone out")
	}
	p.set(false, newCode, newSecret)
	if p.valid(req(p.issue(now)), now) || p.checkCode(newCode) {
		t.Error("phone access off must refuse sessions and codes")
	}
}

func TestPhoneLoginThrottle(t *testing.T) {
	p := newPhoneAccess("8765")
	now := time.Now()
	for i := 0; i < loginMaxPerIP; i++ {
		if p.loginWait("10.0.0.2", now) != 0 {
			t.Fatalf("blocked after %d failures", i)
		}
		p.loginFailed("10.0.0.2", now)
	}
	if w := p.loginWait("10.0.0.2", now); w <= 0 || w > loginWindow {
		t.Errorf("wait after %d failures = %v", loginMaxPerIP, w)
	}
	if p.loginWait("10.0.0.3", now) != 0 {
		t.Error("another address must not be blocked yet")
	}
	if p.loginWait("10.0.0.2", now.Add(loginWindow)) != 0 {
		t.Error("still blocked after the window")
	}
	for i := 0; i < loginMaxTotal; i++ {
		p.loginFailed("10.0.1."+string(rune('a'+i)), now)
	}
	if p.loginWait("10.0.0.9", now) <= 0 {
		t.Error("many failures from everywhere must block everyone")
	}
}

// testApp serves demo data with phone access on and code 12345678.
func testApp(t *testing.T) (*App, http.Handler) {
	t.Helper()
	phone := newPhoneAccess("8765")
	app := newApp(phone)
	app.useDemo()
	static := fstest.MapFS{"index.html": {Data: []byte("<!doctype html><title>Tableau Sage</title>")}}
	h := app.routes(http.FileServer(http.FS(static)), "127.0.0.1:8765")
	phone.mu.Lock()
	phone.enabled, phone.code, phone.secret = true, "12345678", []byte("test secret")
	phone.mu.Unlock()
	return app, h
}

func call(h http.Handler, method, path, remote, body string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	var r *http.Request
	if body != "" {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
	} else {
		r = httptest.NewRequest(method, path, nil)
	}
	r.RemoteAddr = remote + ":50000"
	if remote == "127.0.0.1" {
		r.Host = "127.0.0.1:8765"
	} else {
		r.Host = "192.168.1.20:8765"
	}
	for _, c := range cookies {
		r.AddCookie(c)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestAccessControl(t *testing.T) {
	app, h := testApp(t)
	const pc, phone = "127.0.0.1", "192.168.1.30"

	for _, path := range []string{"/api/sales", "/api/stock", "/api/purchases", "/api/phone"} {
		if w := call(h, "GET", path, pc, ""); w.Code != http.StatusOK {
			t.Errorf("PC %s = %d", path, w.Code)
		}
	}
	r := httptest.NewRequest("GET", "/api/sales", nil)
	r.RemoteAddr, r.Host = "127.0.0.1:50000", "evil.example:8765"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != http.StatusForbidden {
		t.Errorf("PC with a foreign Host = %d, want 403", w.Code)
	}

	// A phone without the code sees the page and nothing else.
	if w := call(h, "GET", "/", phone, ""); w.Code != http.StatusOK {
		t.Errorf("phone page = %d", w.Code)
	}
	for _, path := range []string{"/api/sales", "/api/stock", "/api/purchases", "/api/supplier-articles?code=F0001"} {
		if w := call(h, "GET", path, phone, ""); w.Code != http.StatusUnauthorized {
			t.Errorf("phone without code %s = %d, want 401", path, w.Code)
		}
	}
	var st stateResponse
	json.Unmarshal(call(h, "GET", "/api/state", phone, "").Body.Bytes(), &st)
	if st.Local || st.Authenticated || st.Company != "" || st.Server != "" {
		t.Errorf("phone state before the code leaks: %+v", st)
	}

	if w := call(h, "POST", "/api/login", phone, `{"code":"00000000"}`); w.Code != http.StatusUnauthorized {
		t.Errorf("wrong code = %d", w.Code)
	}
	w = call(h, "POST", "/api/login", phone, `{"code":"1234 5678"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("right code = %d %s", w.Code, w.Body)
	}
	var session *http.Cookie
	for _, c := range w.Result().Cookies() {
		if c.Name == sessionCookie {
			session = c
		}
	}
	if session == nil || !session.HttpOnly {
		t.Fatalf("no HttpOnly session cookie: %v", w.Result().Cookies())
	}
	for _, path := range []string{"/api/sales", "/api/stock", "/api/purchases", "/api/supplier-articles?code=F0001"} {
		if w := call(h, "GET", path, phone, "", session); w.Code != http.StatusOK {
			t.Errorf("phone with code %s = %d", path, w.Code)
		}
	}
	json.Unmarshal(call(h, "GET", "/api/state", phone, "", session).Body.Bytes(), &st)
	if !st.Authenticated || st.Company == "" || st.Server != "" || st.Database != "" {
		t.Errorf("phone state after the code: %+v", st)
	}

	// Setup and settings stay on the PC, code or not.
	for _, c := range []struct{ method, path, body string }{
		{"GET", "/api/phone", ""}, {"POST", "/api/phone", `{"enabled":false}`},
		{"POST", "/api/config", `{}`}, {"POST", "/api/databases", `{}`},
		{"POST", "/api/demo", `{}`}, {"GET", "/api/discover", ""},
	} {
		if w := call(h, c.method, c.path, phone, c.body, session); w.Code != http.StatusForbidden {
			t.Errorf("phone %s %s = %d, want 403", c.method, c.path, w.Code)
		}
	}

	// Brute force is cut short.
	other := "192.168.1.31"
	for i := 0; i < loginMaxPerIP; i++ {
		call(h, "POST", "/api/login", other, `{"code":"11111111"}`)
	}
	if w := call(h, "POST", "/api/login", other, `{"code":"12345678"}`); w.Code != http.StatusTooManyRequests {
		t.Errorf("login after %d failures = %d, want 429", loginMaxPerIP, w.Code)
	}

	// Phone access off: the network gets nothing at all.
	app.phone.set(false, "12345678", []byte("test secret"))
	if w := call(h, "GET", "/", phone, "", session); w.Code != http.StatusForbidden {
		t.Errorf("phone with access off = %d, want 403", w.Code)
	}
}

func TestNetworkIPs(t *testing.T) {
	ips := networkIPs()
	if len(ips) == 0 {
		t.Skip("no network here")
	}
	for _, ip := range ips {
		if !usable(ip) {
			t.Errorf("unusable address %v", ip)
		}
	}
	// The fallback must find the same kind of address on its own.
	if route := routeIPs(); len(route) == 0 {
		t.Error("routeIPs found nothing although the machine has a network")
	}
	if ipKind(net.ParseIP("100.101.102.103")) != "tailscale" || ipKind(net.ParseIP("192.168.1.20")) != "lan" {
		t.Error("ipKind")
	}
}
