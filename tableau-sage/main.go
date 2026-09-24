// Tableau Sage : un petit tableau de bord (chiffre d'affaires, stocks) qui lit
// une base Sage 100 SQL Server en lecture seule et s'affiche dans le navigateur.
package main

import (
	"context"
	"embed"
	"errors"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"strings"
	"time"
)

const (
	appID       = "tableau-sage"
	defaultPort = 8765
)

// version is overridden at build time with -ldflags "-X main.version=...".
var version = "dev"

//go:embed web
var webFiles embed.FS

func main() {
	demo := flag.Bool("demo", false, "démarrer avec des données de démonstration")
	port := flag.Int("port", defaultPort, "port local de l'interface")
	noBrowser := flag.Bool("no-browser", false, "ne pas ouvrir le navigateur")
	flag.Parse()

	setupConsole()
	fmt.Println("==============================================")
	fmt.Println("  Tableau Sage", version)
	fmt.Println("==============================================")

	addr := fmt.Sprintf("127.0.0.1:%d", *port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		// Déjà lancé ? On rouvre simplement la page de l'instance existante.
		if alreadyRunning(addr) {
			fmt.Println("Le tableau de bord est déjà ouvert, j'affiche la page.")
			openBrowser("http://" + addr + "/")
			time.Sleep(2 * time.Second)
			return
		}
		ln, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			fatal("Impossible de démarrer le serveur local : %v", err)
		}
	}
	url := "http://" + ln.Addr().String() + "/"

	app := newApp()
	if *demo {
		app.useDemo()
	} else if cfg, err := loadConfig(); err == nil {
		app.cfg = cfg
		app.connectInBackground()
	}

	static, _ := fs.Sub(webFiles, "web")
	srv := &http.Server{
		Handler:           app.routes(http.FileServer(http.FS(static)), ln.Addr().String()),
		ReadHeaderTimeout: 10 * time.Second,
	}

	fmt.Println()
	fmt.Println("Le tableau de bord est ouvert dans votre navigateur :")
	fmt.Println("   ", url)
	fmt.Println()
	fmt.Println("Laissez cette fenêtre ouverte pendant que vous l'utilisez.")
	fmt.Println("Fermez-la pour arrêter le tableau de bord.")
	if !*noBrowser {
		openBrowser(url)
	}

	go func() {
		stop := make(chan os.Signal, 1)
		signal.Notify(stop, os.Interrupt)
		<-stop
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()
	if err := srv.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal("Le serveur local s'est arrêté : %v", err)
	}
}

func alreadyRunning(addr string) bool {
	client := http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get("http://" + addr + "/api/ping")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	var buf [64]byte
	n, _ := resp.Body.Read(buf[:])
	return strings.Contains(string(buf[:n]), appID)
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("Ouvrez cette adresse dans votre navigateur : %s", url)
	}
}

func fatal(format string, args ...any) {
	fmt.Printf("\nERREUR : "+format+"\n", args...)
	fmt.Println("\nAppuyez sur Entrée pour fermer cette fenêtre.")
	fmt.Scanln()
	os.Exit(1)
}
