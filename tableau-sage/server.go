package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net"
	"net/http"
	"os"
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
	phone   *phoneAccess
}

func newApp(phone *phoneAccess) *App { return &App{status: "setup", phone: phone} }

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
	go a.connect(&cfg, 0)
}

// connect opens the saved Sage connection. When Windows starts the dashboard
// at logon, the SQL Server may not be reachable yet: network failures are
// retried every 30 seconds for about an hour. A refused login is not retried,
// since repeated failures can lock the SQL account.
func (a *App) connect(cfg *Config, attempt int) {
	ctx, cancel := context.WithTimeout(context.Background(), 40*time.Second)
	src, err := connectSage(ctx, cfg)
	cancel()
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.demo || a.cfg == nil || !sameSage(a.cfg, cfg) || a.status == "ready" {
		if src != nil { // set up again, or demo chosen, meanwhile
			src.Close()
		}
		return
	}
	if err != nil {
		a.status, a.lastErr = "error", explain(err)
		if unreachable(err) && attempt < 120 {
			time.AfterFunc(30*time.Second, func() { a.connect(cfg, attempt+1) })
		}
		return
	}
	a.src, a.status, a.lastErr = src, "ready", nil
}

func sameSage(x, y *Config) bool {
	return x.Server == y.Server && x.Database == y.Database && x.Auth == y.Auth &&
		x.User == y.User && x.Password == y.Password
}

// unreachable reports errors that mean the SQL Server could not be reached,
// as opposed to reached and refusing.
func unreachable(err error) bool {
	low := strings.ToLower(err.Error())
	return errors.Is(err, context.DeadlineExceeded) ||
		strings.Contains(low, "no such host") || strings.Contains(low, "unable to get instances") ||
		strings.Contains(low, "i/o timeout") || strings.Contains(low, "connection refused") ||
		strings.Contains(low, "unable to open tcp") || strings.Contains(low, "no instance matching")
}

func (a *App) source() (Source, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.src, a.demo
}

// routes serves the page and the JSON API.
//
// This PC may do everything. Requests addressed to anything but our own local
// address are refused, which shuts out other websites (DNS rebinding). Other
// devices only get in while phone access is on; they must have typed the code
// to read the numbers, and can never reach setup or settings.
//
// State-changing calls must be JSON, which browsers never send cross-site
// without a preflight we don't grant.
func (a *App) routes(static http.Handler, listenAddr string) http.Handler {
	_, port, _ := net.SplitHostPort(listenAddr)
	localHosts := map[string]bool{"127.0.0.1:" + port: true, "localhost:" + port: true}

	mux := http.NewServeMux()
	mux.Handle("GET /", static)
	mux.HandleFunc("GET /api/ping", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, map[string]string{"app": appID})
	})
	mux.HandleFunc("GET /api/state", a.handleState)
	mux.HandleFunc("POST /api/login", a.handleLogin)
	mux.HandleFunc("POST /api/logout", a.handleLogout)

	mux.HandleFunc("GET /api/sales", a.viewer(a.handleSales))
	mux.HandleFunc("GET /api/stock", a.viewer(a.handleStock))
	mux.HandleFunc("GET /api/purchases", a.viewer(a.handlePurchases))
	mux.HandleFunc("GET /api/supplier-articles", a.viewer(a.handleSupplierArticles))

	mux.HandleFunc("GET /api/discover", a.admin(a.handleDiscover))
	mux.HandleFunc("POST /api/databases", a.admin(a.handleDatabases))
	mux.HandleFunc("POST /api/config", a.admin(a.handleConfig))
	mux.HandleFunc("POST /api/demo", a.admin(func(w http.ResponseWriter, r *http.Request) {
		a.useDemo()
		a.handleState(w, r)
	}))
	mux.HandleFunc("GET /api/phone", a.admin(a.handlePhone))
	mux.HandleFunc("POST /api/phone", a.admin(a.handlePhoneUpdate))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if isLocal(r) {
			if !localHosts[r.Host] {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		} else if !a.phone.isEnabled() {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if r.Method == http.MethodPost && !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		mux.ServeHTTP(w, r)
	})
}

// isLocal reports whether the request comes from this PC itself.
func isLocal(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	ip := net.ParseIP(host)
	return err == nil && ip != nil && ip.IsLoopback()
}

func clientIP(r *http.Request) string {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	return host
}

// viewer lets through this PC and phones that typed the code.
func (a *App) viewer(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isLocal(r) && !a.phone.valid(r, time.Now()) {
			writeError(w, http.StatusUnauthorized, &UserError{Title: "Saisissez le code d'accès"})
			return
		}
		h(w, r)
	}
}

// admin lets through this PC only.
func (a *App) admin(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !isLocal(r) {
			writeError(w, http.StatusForbidden, &UserError{Title: "Réservé au PC du bureau"})
			return
		}
		h(w, r)
	}
}

type stateResponse struct {
	Status        string     `json:"status"`
	Demo          bool       `json:"demo"`
	Local         bool       `json:"local"`         // this PC, not a phone
	Authenticated bool       `json:"authenticated"` // may read the numbers
	Company       string     `json:"company"`
	Server        string     `json:"server,omitempty"`
	Database      string     `json:"database,omitempty"`
	Auth          string     `json:"auth,omitempty"`
	User          string     `json:"user,omitempty"`
	Currency      string     `json:"currency"`
	Version       string     `json:"version"`
	Error         *UserError `json:"error,omitempty"`
}

func (a *App) handleState(w http.ResponseWriter, r *http.Request) {
	local := isLocal(r)
	writeJSON(w, a.state(local, local || a.phone.valid(r, time.Now())))
}

// state describes the dashboard. A phone learns nothing about the server or
// the login, and nothing at all before it has typed the code.
func (a *App) state(local, authenticated bool) stateResponse {
	a.mu.Lock()
	defer a.mu.Unlock()
	s := stateResponse{Status: a.status, Demo: a.demo, Local: local, Authenticated: authenticated, Currency: "€", Version: version}
	if a.cfg != nil && a.cfg.Currency != "" {
		s.Currency = a.cfg.Currency
	}
	if a.src != nil && authenticated {
		s.Company = a.src.Company()
	}
	if !local {
		if s.Status != "ready" {
			s.Status = "unavailable"
		}
		return s
	}
	s.Error = a.lastErr
	if a.cfg != nil {
		s.Server, s.Database, s.Auth, s.User = a.cfg.Server, a.cfg.Database, a.cfg.Auth, a.cfg.User
	}
	return s
}

func (a *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	if isLocal(r) {
		a.handleState(w, r)
		return
	}
	ip, now := clientIP(r), time.Now()
	if wait := a.phone.loginWait(ip, now); wait > 0 {
		minutes := int(math.Ceil(wait.Minutes()))
		hint := "Par sécurité, attendez 1 minute avant de réessayer."
		if minutes > 1 {
			hint = fmt.Sprintf("Par sécurité, attendez %d minutes avant de réessayer.", minutes)
		}
		writeError(w, http.StatusTooManyRequests, &UserError{Title: "Trop d'essais", Hint: hint})
		return
	}
	var req struct {
		Code string `json:"code"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, &UserError{Title: "Requête invalide"})
		return
	}
	if !a.phone.checkCode(req.Code) {
		a.phone.loginFailed(ip, now)
		writeError(w, http.StatusUnauthorized, &UserError{
			Title: "Code incorrect",
			Hint:  "Le code est affiché sur le PC du bureau : Tableau Sage, bouton « Accès téléphone ».",
		})
		return
	}
	a.phone.loginSucceeded(ip)
	http.SetCookie(w, a.phone.issue(now))
	writeJSON(w, a.state(false, true))
}

func (a *App) handleLogout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode})
	local := isLocal(r)
	writeJSON(w, a.state(local, local))
}

type toggle struct {
	Supported bool `json:"supported"`
	Enabled   bool `json:"enabled"`
}

type phoneSettings struct {
	Available bool           `json:"available"` // needs a saved Sage connection
	Enabled   bool           `json:"enabled"`
	Code      string         `json:"code,omitempty"`
	Addresses []PhoneAddress `json:"addresses"`
	Problems  []string       `json:"problems,omitempty"`
	Autostart toggle         `json:"autostart"`
	KeepAwake toggle         `json:"keepAwake"`
	Program   string         `json:"program,omitempty"` // where Windows will start us from
}

func (a *App) phoneSettings() phoneSettings {
	a.mu.Lock()
	available, keepAwake := a.cfg != nil, a.cfg != nil && a.cfg.KeepAwake
	a.mu.Unlock()
	enabled, code := a.phone.current()
	s := phoneSettings{
		Available: available,
		Enabled:   enabled,
		Addresses: nonNil(a.phone.addresses()),
		Problems:  a.phone.problems(),
		Autostart: toggle{Supported: autostartSupported(), Enabled: autostartEnabled()},
		KeepAwake: toggle{Supported: keepAwakeSupported(), Enabled: keepAwake},
	}
	if enabled {
		s.Code = code
	}
	s.Program, _ = os.Executable()
	return s
}

func (a *App) handlePhone(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, a.phoneSettings())
}

func (a *App) handlePhoneUpdate(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Enabled   *bool `json:"enabled"`
		NewCode   bool  `json:"newCode"`
		Autostart *bool `json:"autostart"`
		KeepAwake *bool `json:"keepAwake"`
	}
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, &UserError{Title: "Requête invalide", Detail: err.Error()})
		return
	}
	a.mu.Lock()
	if a.cfg == nil {
		a.mu.Unlock()
		writeError(w, http.StatusConflict, &UserError{Title: "Connectez d'abord le tableau de bord à Sage"})
		return
	}
	cfg := *a.cfg
	a.mu.Unlock()

	if req.Enabled != nil {
		cfg.Phone = *req.Enabled
	}
	if cfg.Phone && (req.NewCode || cfg.PhoneCode == "") {
		cfg.PhoneCode, cfg.PhoneSecret = newPhoneCode()
	}
	if req.KeepAwake != nil {
		cfg.KeepAwake = *req.KeepAwake
	}
	if err := saveConfig(&cfg); err != nil {
		writeError(w, http.StatusInternalServerError, &UserError{Title: "Impossible d'enregistrer le réglage", Detail: err.Error()})
		return
	}
	a.mu.Lock()
	a.cfg = &cfg
	a.mu.Unlock()
	a.phone.set(cfg.Phone, cfg.PhoneCode, cfg.PhoneSecret)
	setKeepAwake(cfg.KeepAwake)
	if req.Autostart != nil {
		if err := setAutostart(*req.Autostart); err != nil {
			writeError(w, http.StatusInternalServerError, &UserError{Title: "Impossible de régler le démarrage avec Windows", Detail: err.Error()})
			return
		}
	}
	writeJSON(w, a.phoneSettings())
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
	a.mu.Lock()
	if old := a.cfg; old != nil { // a new Sage connection keeps the phone settings
		cfg.Phone, cfg.PhoneCode, cfg.PhoneSecret, cfg.KeepAwake = old.Phone, old.PhoneCode, old.PhoneSecret, old.KeepAwake
	}
	a.mu.Unlock()
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
	raw, err := src.Flow(ctx, Sales, window(now))
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	writeJSON(w, buildFlow(now, raw))
}

func (a *App) handlePurchases(w http.ResponseWriter, r *http.Request) {
	src, _ := a.source()
	if src == nil {
		writeError(w, http.StatusConflict, &UserError{Title: "Pas encore connecté à Sage"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	now := time.Now()
	win := window(now)
	flow, err := src.Flow(ctx, Purchases, win)
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	orders, err := src.PurchaseOrders(ctx)
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	suppliers, err := src.Suppliers(ctx, win)
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	writeJSON(w, buildPurchases(now, flow, orders, suppliers, src.Features()))
}

func (a *App) handleSupplierArticles(w http.ResponseWriter, r *http.Request) {
	src, _ := a.source()
	if src == nil {
		writeError(w, http.StatusConflict, &UserError{Title: "Pas encore connecté à Sage"})
		return
	}
	code := strings.TrimSpace(r.URL.Query().Get("code"))
	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()
	win := window(time.Now())
	items, err := src.SupplierArticles(ctx, code, win.YearStart, win.To)
	if err != nil {
		writeError(w, http.StatusBadGateway, explain(err))
		return
	}
	writeJSON(w, map[string][]Ranked{"articles": nonNil(items)})
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
	case unreachable(err) && !errors.Is(err, context.DeadlineExceeded):
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
