package main

import (
	"context"
	"log"
	"net"
	"sort"
	"strings"
	"syscall"
	"time"
)

// browserPort is the SQL Server Browser port; a variable so tests can use a fake one.
var browserPort = 1434

// discoverServers asks every SQL Server Browser on the local network (UDP 1434)
// which instances it serves, so the person does not have to know the server name.
func discoverServers(ctx context.Context, wait time.Duration) []string {
	// Without broadcast permission only the local machine is asked, which is
	// still worth doing, so a refusal is logged rather than fatal.
	lc := net.ListenConfig{Control: func(_, _ string, c syscall.RawConn) error {
		c.Control(func(fd uintptr) {
			if err := setBroadcast(fd); err != nil {
				log.Printf("Recherche réseau : diffusion refusée (%v)", err)
			}
		})
		return nil
	}}
	pc, err := lc.ListenPacket(ctx, "udp4", ":0")
	if err != nil {
		log.Printf("Recherche réseau impossible : %v", err)
		return nil
	}
	defer pc.Close()

	// CLNT_BCAST_EX: "list your instances", sent to every reachable broadcast address.
	query := []byte{0x02}
	sent := 0
	for _, target := range broadcastTargets() {
		if _, err := pc.WriteTo(query, &net.UDPAddr{IP: target, Port: browserPort}); err == nil {
			sent++
		}
	}
	if sent == 0 {
		log.Printf("Recherche réseau : aucune requête n'a pu être envoyée")
		return nil
	}

	found := map[string]bool{}
	deadline := time.Now().Add(wait)
	pc.SetReadDeadline(deadline)
	buf := make([]byte, 65535)
	for time.Now().Before(deadline) {
		n, _, err := pc.ReadFrom(buf)
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				break
			}
			// Windows reports an ICMP "port unreachable" from a machine
			// without SQL Server as a read error; other replies may follow.
			time.Sleep(20 * time.Millisecond)
			continue
		}
		for _, name := range parseBrowserReply(buf[:n]) {
			found[name] = true
		}
	}
	names := make([]string, 0, len(found))
	for name := range found {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func broadcastTargets() []net.IP {
	targets := []net.IP{net.IPv4bcast, net.IPv4(127, 0, 0, 1)}
	ifaces, _ := net.Interfaces()
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagBroadcast == 0 {
			continue
		}
		addrs, _ := iface.Addrs()
		for _, a := range addrs {
			ipnet, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			ip := ipnet.IP.To4()
			if ip == nil || ip.IsLoopback() {
				continue
			}
			bcast := make(net.IP, 4)
			for i := range ip {
				bcast[i] = ip[i] | ^ipnet.Mask[len(ipnet.Mask)-4+i]
			}
			targets = append(targets, bcast)
		}
	}
	return targets
}

// parseBrowserReply decodes an SVR_RESP message:
// 0x05, uint16 length, then "ServerName;X;InstanceName;Y;...;;" repeated.
func parseBrowserReply(msg []byte) []string {
	if len(msg) < 3 || msg[0] != 0x05 {
		return nil
	}
	var names []string
	for _, rec := range strings.Split(string(msg[3:]), ";;") {
		parts := strings.Split(rec, ";")
		fields := map[string]string{}
		for i := 0; i+1 < len(parts); i += 2 {
			fields[strings.ToLower(parts[i])] = parts[i+1]
		}
		server, instance := fields["servername"], fields["instancename"]
		if server == "" {
			continue
		}
		if instance == "" || strings.EqualFold(instance, "MSSQLSERVER") {
			names = append(names, server)
		} else {
			names = append(names, server+`\`+instance)
		}
	}
	return names
}
