package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

type App struct {
	mu      sync.Mutex
	cfg     *Config
	src     Source
	demo    bool
	status  string // "setup", "connecting", "ready", "error"
	lastErr *UserError
}

func newApp() *App { return &App{status: "setup"} }

func (a *App) useDemo() {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.src != nil {
		a.src.Close()
	}
	a.src, a.demo, a.status, a.lastErr = newDemoSource(time.Now()), true, "ready", nil
}

func (a *App) connectInBackground() {
	a.mu.Lock()
	a.status = "connecting"
	cfg := *a.cfg
	a.mu.Unlock()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
		defer cancel()
		src, err := connectSage(ctx, &cfg)
		a.mu.Lock()
		defer a.mu.Unlock()
		if err != nil {
			a.status, a.lastErr = "error", explain(err)
			return
		}
		a.src, a.demo, a.status, a.lastErr = src, false, "ready", nil
	}()
}

func (a *App) source() (Source, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.src, a.demo
}

// routes serves the page and the JSON API. Only requests addressed to our own
// local address are answered, which shuts out other websites (DNS rebinding),
// and state-changing calls must be JSON, which browsers never send cross-site
// without a preflight we don't grant.
func (a *App) routes(static http.Handler, listenAddr string) http.Handler {
	_, port, _ := net.SplitHostPort(listenAddr)
	allowedHosts := map[string]bool{"127.0.0.1:" + port: true, "localhost:" + port: true}

	mux := http.NewServeMux()
	mux.Handle("GET /", static)
	mux.HandleFunc("GET /api/ping", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]string{"app": appID})
	})
	mux.HandleFunc("GET /api/state", a.handleState)
	mux.HandleFunc("GET /api/discover", a.handleDiscover)
	mux.HandleFunc("POST /api/databases", a.handleDatabases)
	mux.HandleFunc("POST /api/config", a.handleConfig)
	mux.HandleFunc("POST /api/demo", func(w http.ResponseWriter, r *http.Request) {
		a.useDemo()
		a.handleState(w, r)
	})
	mux.HandleFunc("GET /api/sales", a.handleSales)
	mux.HandleFunc("GET /api/stock", a.handleStock)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowedHosts[r.Host] {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if r.Method == http.MethodPost && !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		mux.ServeHTTP(w, r)
	})
}

type stateResponse struct {
	Status   string     `json:"status"`
	Demo     bool       `json:"demo"`
	Company  string     `json:"company"`
	Server   string     `json:"server"`
	Database string     `json:"database"`
	Auth     string     `json:"auth"`
	User     string     `json:"user"`
	Currency string     `json:"currency"`
	Version  string     `json:"version"`
	Error    *UserError `json:"error,omitempty"`
}

func (a *App) handleState(w http.ResponseWriter, r *http.Request) {
	a.mu.Lock()
	defer a.mu.Unlock()
	s := stateResponse{Status: a.status, Demo: a.demo, Currency: "€", Version: version, Error: a.lastErr}
	if a.cfg != nil {
		s.Server, s.Database, s.Auth, s.User = a.cfg.Server, a.cfg.Database, a.cfg.Auth, a.cfg.User
		if a.cfg.Currency != "" {
			s.Currency = a.cfg.Currency
		}
	}
	if a.src != nil {
		s.Company = a.src.Company()
	}
	writeJSON(w, s)
}

func (a *App) handleDiscover(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string][]string{"servers": nonNil(discoverServers(r.Context(), 2*time.Second))})
}

type connectRequest struct {
	Server   string `json:"server"`
	Auth     string `json:"auth"`
	User     string `json:"user"`
	Password string `json:"password"`
	Database string `json:"database"`
	Currency string `json:"currency"`
}

func (req *connectRequest) config() *Config {
	cfg := &Config{
		Server:   strings.TrimSpace(req.Server),
		Database: req.Database,
		Auth:     req.Auth,
		User:     strings.TrimSpace(req.User),
		Password: req.Password,
		Currency: strings.TrimSpace(req.Currency),
	}
	if cfg.Auth != "sql" {
		cfg.Auth, cfg.User, cfg.Password = "windows", "", ""
	}
	return cfg
}

func (a *App) handleDatabases(w http.ResponseWriter, r *http.Request) {
	var req connectRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, &UserError{Title: "Requête invalide", Detail: err.Error()})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	list, err := listDatabases(ctx, req.config())
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	writeJSON(w, list)
}

func (a *App) handleConfig(w http.ResponseWriter, r *http.Request) {
	var req connectRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, &UserError{Title: "Requête invalide", Detail: err.Error()})
		return
	}
	cfg := req.config()
	if cfg.Currency == "" {
		cfg.Currency = "€"
	}
	ctx, cancel := context.WithTimeout(r.Context(), 40*time.Second)
	defer cancel()
	src, err := connectSage(ctx, cfg)
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	if err := saveConfig(cfg); err != nil {
		src.Close()
		writeError(w, http.StatusInternalServerError, &UserError{
			Title:  "Impossible d'enregistrer la configuration",
			Detail: err.Error(),
		})
		return
	}
	a.mu.Lock()
	if a.src != nil {
		a.src.Close()
	}
	a.cfg, a.src, a.demo, a.status, a.lastErr = cfg, src, false, "ready", nil
	a.mu.Unlock()
	a.handleState(w, r)
}

func (a *App) handleSales(w http.ResponseWriter, r *http.Request) {
	src, _ := a.source()
	if src == nil {
		writeError(w, http.StatusConflict, &UserError{Title: "Pas encore connecté à Sage"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	now := time.Now()
	from, topFrom, to := salesWindow(now)
	raw, err := src.Sales(ctx, from, topFrom, to)
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	writeJSON(w, buildSales(now, raw))
}

func (a *App) handleStock(w http.ResponseWriter, r *http.Request) {
	src, _ := a.source()
	if src == nil {
		writeError(w, http.StatusConflict, &UserError{Title: "Pas encore connecté à Sage"})
		return
	}
	depot, _ := strconv.Atoi(r.URL.Query().Get("depot"))
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	depots, items, err := src.Stock(ctx, depot)
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	writeJSON(w, buildStock(depots, depot, items))
}

// UserError is an error worded for the person in front of the screen, with the
// raw message kept in Detail so it can be copied and sent to whoever helps.
type UserError struct {
	Title  string `json:"title"`
	Hint   string `json:"hint,omitempty"`
	Detail string `json:"detail,omitempty"`
}

func explain(err error) *UserError {
	msg := err.Error()
	low := strings.ToLower(msg)
	ue := &UserError{Detail: msg}
	var schema *SchemaError
	switch {
	case errors.As(err, &schema):
		ue.Title = "Cette base ne ressemble pas à une base Sage 100 Gestion commerciale"
		ue.Hint = "Vérifiez que vous avez choisi la bonne société. Si c'est la bonne, envoyez ce message à la personne qui vous a fourni l'application : votre version de Sage a peut-être des noms de colonnes différents."
	case strings.Contains(low, "login failed") || strings.Contains(low, "échec de l'ouverture de session"):
		ue.Title = "Le serveur SQL a refusé l'identifiant"
		ue.Hint = "Avec « Mon compte Windows », votre compte n'a pas accès à la base : demandez un identifiant SQL en lecture seule à votre informaticien ou à votre revendeur Sage. Avec un identifiant SQL, vérifiez l'identifiant et le mot de passe (majuscules comprises)."
	case strings.Contains(low, "cannot open database") || strings.Contains(low, "impossible d'ouvrir la base"):
		ue.Title = "Connexion réussie, mais pas d'accès à cette société"
		ue.Hint = "L'identifiant utilisé n'a pas le droit de lire cette base. Demandez à votre informaticien de lui donner le rôle « db_datareader » sur la base de la société."
	case strings.Contains(low, "no such host") || strings.Contains(low, "unable to get instances") ||
		strings.Contains(low, "i/o timeout") || strings.Contains(low, "connection refused") ||
		strings.Contains(low, "unable to open tcp") || strings.Contains(low, "no instance matching"):
		ue.Title = "Serveur SQL introuvable"
		ue.Hint = "Vérifiez le nom du serveur (par exemple SERVEUR\\SAGE100) et que ce PC est bien connecté au réseau du bureau. Astuce : lancez l'application sur le PC où Sage est déjà utilisé."
	case strings.Contains(low, "sspi") || strings.Contains(low, "kerberos") || strings.Contains(low, "ntlm") ||
		strings.Contains(low, "acquirecredentialshandle") || strings.Contains(low, "initializesecuritycontext"):
		ue.Title = "La connexion avec le compte Windows n'a pas fonctionné"
		ue.Hint = "Choisissez « Identifiant SQL » et utilisez un identifiant fourni par votre informaticien ou votre revendeur Sage."
	case errors.Is(err, context.DeadlineExceeded):
		ue.Title = "Le serveur met trop de temps à répondre"
		ue.Hint = "Réessayez dans un instant. Si le problème continue, vérifiez la connexion au réseau du bureau."
	default:
		ue.Title = "Erreur lors de la lecture des données Sage"
		ue.Hint = "Envoyez ce message à la personne qui vous a fourni l'application."
	}
	return ue
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, ue *UserError) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]*UserError{"error": ue})
}
