package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"net"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/microsoft/go-mssqldb/msdsn"
)

func TestDSN(t *testing.T) {
	cases := []struct {
		cfg                            Config
		host, port, instance, user, pw string
	}{
		{Config{Server: `SRV\SAGE100`, Auth: "windows"}, "SRV", "0", "SAGE100", "", ""},
		{Config{Server: "SRV,1433", Auth: "sql", User: "lecture", Password: "p@ss;w'rd:{x}"}, "SRV", "1433", "", "lecture", "p@ss;w'rd:{x}"},
		{Config{Server: `.\SQLEXPRESS`, Auth: "windows"}, "localhost", "0", "SQLEXPRESS", "", ""},
		{Config{Server: `(local)`, Auth: "sql", User: "u", Password: ""}, "localhost", "0", "", "u", ""},
	}
	for _, c := range cases {
		conn, err := dsn(&c.cfg, "BIJOU")
		if err != nil {
			t.Fatal(err)
		}
		p, err := msdsn.Parse(conn)
		if err != nil {
			t.Fatalf("%s: %v", conn, err)
		}
		got := fmt.Sprintf("%s|%d|%s|%s|%s|%s", p.Host, p.Port, p.Instance, p.User, p.Password, p.Database)
		want := fmt.Sprintf("%s|%s|%s|%s|%s|BIJOU", c.host, c.port, c.instance, c.user, c.pw)
		if got != want {
			t.Errorf("dsn(%q) parsed as %s, want %s", c.cfg.Server, got, want)
		}
	}
	if _, err := dsn(&Config{Server: "SRV,abc"}, ""); err == nil {
		t.Error("expected an error for a non-numeric port")
	}
}

func TestExplain(t *testing.T) {
	cases := map[string]string{
		"mssql: login error: Login failed for user 'sa'.":                                        "Le serveur SQL a refusé l'identifiant",
		"AcquireCredentialsHandle failed 8009030e":                                               "La connexion avec le compte Windows n'a pas fonctionné",
		"unable to open tcp connection with host 'SRV:1433': dial tcp: lookup SRV: no such host": "Serveur SQL introuvable",
		"mssql: Cannot open database \"X\" requested by the login.":                              "Connexion réussie, mais pas d'accès à cette société",
	}
	for msg, want := range cases {
		if got := explain(errors.New(msg)).Title; got != want {
			t.Errorf("explain(%q) = %q, want %q", msg, got, want)
		}
	}
	if got := explain(&SchemaError{Missing: []string{"F_DOCENTETE.DO_Provenance"}}); !strings.Contains(got.Detail, "DO_Provenance") {
		t.Errorf("schema error detail = %q", got.Detail)
	}
	if got := explain(context.DeadlineExceeded).Title; got != "Le serveur met trop de temps à répondre" {
		t.Errorf("timeout = %q", got)
	}
	if !unreachable(errors.New("dial tcp: lookup SRV: no such host")) || unreachable(errors.New("Login failed for user 'sa'.")) {
		t.Error("only network failures are retried")
	}
}

func TestDiscoverServers(t *testing.T) {
	fake, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer fake.Close()
	go func() {
		buf := make([]byte, 16)
		n, from, err := fake.ReadFrom(buf)
		if err != nil || n != 1 || buf[0] != 0x02 {
			return
		}
		body := "ServerName;BUREAU-SRV;InstanceName;SAGE100;IsClustered;No;Version;15.0.2000.5;tcp;49712;;"
		fake.WriteTo(append([]byte{0x05, byte(len(body)), 0}, body...), from)
	}()
	old := browserPort
	browserPort = fake.LocalAddr().(*net.UDPAddr).Port
	defer func() { browserPort = old }()

	got := discoverServers(context.Background(), 500*time.Millisecond)
	if len(got) != 1 || got[0] != `BUREAU-SRV\SAGE100` {
		t.Errorf("got %v", got)
	}
}

func TestParseBrowserReply(t *testing.T) {
	body := "ServerName;SRV01;InstanceName;SAGE100;IsClustered;No;Version;15.0.2000.5;tcp;49712;;" +
		"ServerName;SRV01;InstanceName;MSSQLSERVER;IsClustered;No;Version;16.0.1000.6;tcp;1433;;"
	msg := append([]byte{0x05, byte(len(body)), byte(len(body) >> 8)}, body...)
	got := parseBrowserReply(msg)
	want := []string{`SRV01\SAGE100`, "SRV01"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Errorf("got %v, want %v", got, want)
	}
}

func TestBuildFlow(t *testing.T) {
	d := func(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 0, 0, 0, 0, time.UTC) }
	now := time.Date(2026, 3, 15, 16, 30, 0, 0, time.Local)
	raw := &FlowRaw{Days: []DayTotal{
		{d(2025, 1, 10), 100}, // last year, before the same-period cut-off
		{d(2025, 3, 2), 50},   // last year, same month, before the 15th
		{d(2025, 3, 16), 70},  // last year, after the 15th: full-year only
		{d(2025, 12, 31), 5},  // last year total only
		{d(2026, 1, 5), 200},  // this year
		{d(2026, 3, 1), 30},   // this month
		{d(2026, 3, 15), 12},  // today
		{d(2026, 3, 16), 999}, // dated in the future: ignored
	}}
	r := buildFlow(now, raw)
	k := r.KPI
	check := func(name string, got, want float64) {
		t.Helper()
		if math.Abs(got-want) > 1e-9 {
			t.Errorf("%s = %v, want %v", name, got, want)
		}
	}
	check("today", k.Today, 12)
	check("month", k.Month, 42)
	check("monthLastYear", k.MonthLastYear, 50)
	check("year", k.Year, 242)
	check("yearLastYear", k.YearLastYear, 150)
	check("lastYearTotal", k.LastYearTotal, 225)
	if r.Current[2] == nil || *r.Current[2] != 42 || r.Current[3] != nil {
		t.Errorf("current months wrong: March=%v April=%v", r.Current[2], r.Current[3])
	}
	check("previous March", r.Previous[2], 120)

	w := window(now)
	if got := w.LYCut.Format("2006-01-02"); got != "2025-03-16" {
		t.Errorf("LYCut = %s", got)
	}
}

func TestBuildPurchases(t *testing.T) {
	now := time.Date(2026, 3, 15, 9, 0, 0, 0, time.Local)
	orders := []Order{
		{Piece: "BC4", Date: "2026-03-10"},                                 // no expected date: last
		{Piece: "BC3", Date: "2026-03-01", Delivery: "2026-03-20"},         // due later
		{Piece: "BC2", Date: "2026-02-01", Delivery: "2026-03-14", HT: 10}, // late since yesterday
		{Piece: "BC1", Date: "2025-12-01", Delivery: "2026-01-05", HT: 5},  // late the longest
		{Piece: "BC5", Date: "2026-03-12", Delivery: "2026-03-15"},         // due today: not late
	}
	r := buildPurchases(now, &FlowRaw{}, orders, nil, Features{})
	var got []string
	for _, o := range r.Orders {
		got = append(got, fmt.Sprintf("%s:%v", o.Piece, o.Late))
	}
	want := "BC1:true BC2:true BC5:false BC3:false BC4:false"
	if strings.Join(got, " ") != want {
		t.Errorf("orders = %s, want %s", strings.Join(got, " "), want)
	}
	if r.OrdersLate != 2 || r.OrdersTotal != 15 {
		t.Errorf("late = %d, total = %v", r.OrdersLate, r.OrdersTotal)
	}
	if sageDate(time.Date(1900, 1, 1, 0, 0, 0, 0, time.UTC)) != "" {
		t.Error("1900-01-01 must read as no date")
	}
}

// The tests below need a SQL Server. They run when TEST_SQL_SERVER is set, e.g.
//
//	TEST_SQL_SERVER=localhost TEST_SQL_USER=sa TEST_SQL_PASSWORD=... go test ./...
func testServer(t *testing.T) *Config {
	server := os.Getenv("TEST_SQL_SERVER")
	if server == "" {
		t.Skip("TEST_SQL_SERVER not set")
	}
	return &Config{Server: server, Auth: "sql", User: os.Getenv("TEST_SQL_USER"), Password: os.Getenv("TEST_SQL_PASSWORD")}
}

// sageTables creates Sage-shaped tables. The full variant has the optional
// columns too; the minimal one only what the dashboard requires.
func sageTables(full bool) string {
	opt := func(cols string) string {
		if full {
			return cols
		}
		return ""
	}
	ddl := `
CREATE TABLE P_DOSSIER (D_RaisonSoc varchar(35));
CREATE TABLE F_COMPTET (CT_Num varchar(17) PRIMARY KEY, CT_Intitule varchar(69)` +
		opt(`, CT_Type smallint, CT_Sommeil smallint, CT_Contact varchar(35), CT_Telephone varchar(21),
	CT_EMail varchar(69), CT_Ville varchar(35)`) + `);
CREATE TABLE F_FAMILLE (FA_CodeFamille varchar(11) PRIMARY KEY, FA_Intitule varchar(69));
CREATE TABLE F_ARTICLE (AR_Ref varchar(19) PRIMARY KEY, AR_Design varchar(69), FA_CodeFamille varchar(11),
	AR_Sommeil smallint, AR_SuiviStock smallint);
CREATE TABLE F_DEPOT (DE_No int PRIMARY KEY, DE_Intitule varchar(35));
CREATE TABLE F_ARTSTOCK (AR_Ref varchar(19), DE_No int, AS_QteSto numeric(24,6), AS_QteRes numeric(24,6),
	AS_QteCom numeric(24,6), AS_QteMini numeric(24,6), AS_MontSto numeric(24,6));
CREATE TABLE F_DOCENTETE (DO_Domaine smallint, DO_Type smallint, DO_Piece varchar(13), DO_Date smalldatetime,
	DO_Tiers varchar(17), DO_Provenance smallint` + opt(`, DO_DateLivr smalldatetime, DO_Cloture smallint`) + `);
CREATE TABLE F_DOCLIGNE (DO_Domaine smallint, DO_Type smallint, CT_Num varchar(17), DO_Piece varchar(13),
	AR_Ref varchar(19) NULL, DL_Qte numeric(24,6), DL_MontantHT numeric(24,6));
`
	if full {
		ddl += `CREATE TABLE F_ARTFOURNISS (AR_Ref varchar(19), CT_Num varchar(17), AF_Principal smallint,
	AF_RefFourniss varchar(19));
`
	}
	return ddl
}

func sqlStr(s string) string { return "N'" + strings.ReplaceAll(s, "'", "''") + "'" }

func insertRows(ctx context.Context, db *sql.DB, table string, rows []string) error {
	for len(rows) > 0 {
		n := min(len(rows), 900)
		if _, err := db.ExecContext(ctx, "INSERT INTO "+table+" VALUES "+strings.Join(rows[:n], ",")); err != nil {
			return fmt.Errorf("%s: %w", table, err)
		}
		rows = rows[n:]
	}
	return nil
}

// loadWorld writes the demo world into Sage-shaped tables. Returns (provenance 1)
// are stored with negative amounts and credit notes (provenance 2) with positive
// ones, so both sign conventions go through the query. Missing dates are
// stored as 1900-01-01, as Sage does.
func loadWorld(ctx context.Context, db *sql.DB, w *demoWorld, full bool) error {
	if _, err := db.ExecContext(ctx, sageTables(full)); err != nil {
		return err
	}
	var rows []string
	add := func(format string, args ...any) { rows = append(rows, fmt.Sprintf(format, args...)) }
	flush := func(table string) error {
		err := insertRows(ctx, db, table, rows)
		rows = rows[:0]
		return err
	}
	b := func(v bool) int {
		if v {
			return 1
		}
		return 0
	}
	sageDay := func(t time.Time) string {
		if t.IsZero() {
			return "19000101"
		}
		return t.Format("20060102")
	}

	add("(%s)", sqlStr(w.Company))
	if err := flush("P_DOSSIER"); err != nil {
		return err
	}
	for _, c := range append(append([]demoTiers{}, w.Clients...), w.Suppliers...) {
		if full {
			add("(%s,%s,%d,%d,%s,%s,%s,%s)", sqlStr(c.Num), sqlStr(c.Name), c.Type, b(c.Sleeping),
				sqlStr(c.Contact), sqlStr(c.Phone), sqlStr(c.Email), sqlStr(c.City))
		} else {
			add("(%s,%s)", sqlStr(c.Num), sqlStr(c.Name))
		}
	}
	if err := flush("F_COMPTET"); err != nil {
		return err
	}
	for _, f := range w.Families {
		add("(%s,%s)", sqlStr(f[0]), sqlStr(f[1]))
	}
	if err := flush("F_FAMILLE"); err != nil {
		return err
	}
	for _, a := range w.Articles {
		add("(%s,%s,%s,%d,%d)", sqlStr(a.Ref), sqlStr(a.Name), sqlStr(a.Family), b(a.Sleeping), 2*b(a.Tracked))
	}
	if err := flush("F_ARTICLE"); err != nil {
		return err
	}
	if full {
		for _, as := range w.ArtSuppliers {
			add("(%s,%s,%d,%s)", sqlStr(as.Ref), sqlStr(as.Supplier), b(as.Principal), sqlStr("R-"+as.Ref))
		}
		if err := flush("F_ARTFOURNISS"); err != nil {
			return err
		}
	}
	for _, d := range w.Depots {
		add("(%d,%s)", d.No, sqlStr(d.Name))
	}
	if err := flush("F_DEPOT"); err != nil {
		return err
	}
	for _, s := range w.Stock {
		add("(%s,%d,%g,%g,%g,%g,%g)", sqlStr(s.Ref), s.Depot, s.Qty, s.Res, s.Com, s.Min, s.Val)
	}
	if err := flush("F_ARTSTOCK"); err != nil {
		return err
	}
	for _, d := range w.Docs {
		if full {
			add("(%d,%d,%s,'%s',%s,%d,'%s',%d)", d.Domaine, d.Type, sqlStr(d.Piece), sageDay(d.Date), sqlStr(d.Tiers),
				d.Provenance, sageDay(d.Delivery), b(d.Closed))
		} else {
			add("(%d,%d,%s,'%s',%s,%d)", d.Domaine, d.Type, sqlStr(d.Piece), sageDay(d.Date), sqlStr(d.Tiers), d.Provenance)
		}
	}
	if err := flush("F_DOCENTETE"); err != nil {
		return err
	}
	for _, d := range w.Docs {
		for _, l := range d.Lines {
			ref := "NULL"
			if l.Ref != "" {
				ref = sqlStr(l.Ref)
			}
			qty, ht := l.Qty, l.HT
			if d.Provenance == 1 {
				qty, ht = -qty, -ht
			}
			add("(%d,%d,%s,%s,%s,%g,%g)", d.Domaine, d.Type, sqlStr(d.Tiers), sqlStr(d.Piece), ref, qty, ht)
		}
	}
	return flush("F_DOCLIGNE")
}

func recreateDB(ctx context.Context, master *sql.DB, name string) error {
	_, err := master.ExecContext(ctx, fmt.Sprintf(`
		IF DB_ID(N'%[1]s') IS NOT NULL BEGIN
			ALTER DATABASE [%[1]s] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [%[1]s];
		END;
		CREATE DATABASE [%[1]s];`, name))
	return err
}

// loadTestDB creates the named database from the demo world and connects to it.
func loadTestDB(t *testing.T, ctx context.Context, cfg *Config, master *sql.DB, name string, demo *demoSource, full bool) *sageSource {
	t.Helper()
	if err := recreateDB(ctx, master, name); err != nil {
		t.Fatal(err)
	}
	db, err := openDB(ctx, cfg, name)
	if err != nil {
		t.Fatal(err)
	}
	if err := loadWorld(ctx, db, demo.world, full); err != nil {
		t.Fatal(err)
	}
	db.Close()
	c := *cfg
	c.Database = name
	src, err := connectSage(ctx, &c)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(src.Close)
	return src
}

func testMaster(t *testing.T) (context.Context, *Config, *sql.DB) {
	cfg := testServer(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	t.Cleanup(cancel)
	master, err := openDB(ctx, cfg, "")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { master.Close() })
	return ctx, cfg, master
}

func compareFlows(t *testing.T, name string, got, want *FlowRaw) {
	t.Helper()
	if len(got.Days) != len(want.Days) {
		t.Fatalf("%s days: got %d, want %d", name, len(got.Days), len(want.Days))
	}
	sort.Slice(got.Days, func(i, j int) bool { return got.Days[i].Day.Before(got.Days[j].Day) })
	for i := range want.Days {
		g, w := got.Days[i], want.Days[i]
		if !dateOf(g.Day).Equal(w.Day) || math.Abs(g.HT-w.HT) > 0.005 {
			t.Fatalf("%s day %d: got %v %.2f, want %v %.2f", name, i, g.Day, g.HT, w.Day, w.HT)
		}
	}
	compareRanked(t, name+" top tiers", got.TopTiers, want.TopTiers)
	compareRanked(t, name+" top articles", got.TopArticles, want.TopArticles)
}

func TestSQLMatchesDemo(t *testing.T) {
	ctx, cfg, master := testMaster(t)
	if err := recreateDB(ctx, master, "AUTRE_BASE"); err != nil {
		t.Fatal(err)
	}
	now := time.Now()
	win := window(now)
	demo := newDemoSource(now)
	src := loadTestDB(t, ctx, cfg, master, "TABLEAU_DEMO", demo, true)

	list, err := listDatabases(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, c := range list.Sage {
		if c.Database == "TABLEAU_DEMO" {
			found = true
			if c.Name != "Quincaillerie Démo" {
				t.Errorf("company name = %q", c.Name)
			}
		}
	}
	if !found || !contains(list.Others, "AUTRE_BASE") {
		t.Fatalf("database detection wrong: %+v", list)
	}
	other := *cfg
	other.Database = "AUTRE_BASE"
	var schemaErr *SchemaError
	if _, err := connectSage(ctx, &other); !errors.As(err, &schemaErr) || len(schemaErr.Missing) == 0 {
		t.Errorf("non-Sage database: got %v, want a SchemaError", err)
	}
	if f := src.Features(); !f.DeliveryDates || !f.Contacts || !f.ArticleSuppliers {
		t.Errorf("features = %+v, want all", f)
	}

	for _, kind := range []FlowKind{Sales, Purchases} {
		got, err := src.Flow(ctx, kind, win)
		if err != nil {
			t.Fatal(err)
		}
		want, _ := demo.Flow(ctx, kind, win)
		compareFlows(t, fmt.Sprintf("flow %d", kind), got, want)
		g, w := buildFlow(now, got), buildFlow(now, want)
		if math.Abs(g.KPI.Year-w.KPI.Year) > 0.01 || g.KPI.Year <= 0 {
			t.Errorf("flow %d year KPI: got %.2f, want %.2f", kind, g.KPI.Year, w.KPI.Year)
		}
		t.Logf("flux %d depuis le 1er janvier : %.2f (N-1 même période : %.2f)", kind, g.KPI.Year, g.KPI.YearLastYear)
	}

	gotSup, err := src.Suppliers(ctx, win)
	if err != nil {
		t.Fatal(err)
	}
	wantSup, _ := demo.Suppliers(ctx, win)
	compareSuppliers(t, gotSup, wantSup)
	codes := map[string]bool{}
	for _, s := range gotSup {
		codes[s.Code] = true
	}
	if !codes["F0010"] || codes["F0009"] || codes["C0001"] {
		t.Errorf("supplier list: dormant with purchases must stay, dormant without and clients must not: %v", codes)
	}

	gotOrders, err := src.PurchaseOrders(ctx)
	if err != nil {
		t.Fatal(err)
	}
	wantOrders, _ := demo.PurchaseOrders(ctx)
	compareOrders(t, gotOrders, wantOrders)
	report := buildPurchases(now, &FlowRaw{}, gotOrders, gotSup, src.Features())
	noDate := 0
	for _, o := range report.Orders {
		if o.Delivery == "" {
			noDate++
		}
	}
	if report.OrdersLate == 0 || noDate != 1 {
		t.Errorf("orders: %d late, %d without date; want some late and exactly one undated", report.OrdersLate, noDate)
	}
	t.Logf("%d commandes en cours (%d en retard), %.2f HT", len(report.Orders), report.OrdersLate, report.OrdersTotal)

	top := report.Suppliers[0].Code
	gotArt, err := src.SupplierArticles(ctx, top, win.YearStart, win.To)
	if err != nil {
		t.Fatal(err)
	}
	wantArt, _ := demo.SupplierArticles(ctx, top, win.YearStart, win.To)
	if len(wantArt) == 0 {
		t.Fatalf("no articles bought from %s", top)
	}
	compareRanked(t, "supplier articles", gotArt, wantArt)

	for _, depot := range []int{0, 1, 2} {
		gDepots, gItems, err := src.Stock(ctx, depot)
		if err != nil {
			t.Fatal(err)
		}
		wDepots, wItems, _ := demo.Stock(ctx, depot)
		if len(gDepots) != len(wDepots) {
			t.Errorf("depots: got %v, want %v", gDepots, wDepots)
		}
		g, w := buildStock(gDepots, depot, gItems), buildStock(wDepots, depot, wItems)
		if g.Totals.Articles != w.Totals.Articles || g.Totals.Out != w.Totals.Out || g.Totals.Low != w.Totals.Low ||
			math.Abs(g.Totals.Value-w.Totals.Value) > 0.01 {
			t.Errorf("depot %d totals: got %+v, want %+v", depot, g.Totals, w.Totals)
		}
		withSupplier := 0
		for i := range w.Items {
			gi, wi := g.Items[i], w.Items[i]
			if gi.Ref != wi.Ref || gi.Name != wi.Name || gi.Family != wi.Family || math.Abs(gi.Qty-wi.Qty) > 1e-6 ||
				math.Abs(gi.Min-wi.Min) > 1e-6 || math.Abs(gi.Reserved-wi.Reserved) > 1e-6 ||
				gi.Supplier != wi.Supplier || gi.SupplierName != wi.SupplierName {
				t.Fatalf("depot %d item %d: got %+v, want %+v", depot, i, gi, wi)
			}
			if gi.Supplier != "" {
				withSupplier++
			}
		}
		if withSupplier == 0 || withSupplier == len(g.Items) {
			t.Errorf("depot %d: %d of %d items have a supplier; want some but not all", depot, withSupplier, len(g.Items))
		}
		t.Logf("dépôt %d : %+v", depot, g.Totals)
	}
}

// TestSQLMinimalSchema runs against a database without any optional column:
// everything must still work, with the optional details left empty.
func TestSQLMinimalSchema(t *testing.T) {
	ctx, cfg, master := testMaster(t)
	now := time.Now()
	win := window(now)
	demo := newDemoSource(now)
	src := loadTestDB(t, ctx, cfg, master, "TABLEAU_MINI", demo, false)

	if f := src.Features(); f.DeliveryDates || f.Contacts || f.ArticleSuppliers {
		t.Errorf("features = %+v, want none", f)
	}
	got, err := src.Flow(ctx, Sales, win)
	if err != nil {
		t.Fatal(err)
	}
	want, _ := demo.Flow(ctx, Sales, win)
	compareFlows(t, "sales", got, want)

	sup, err := src.Suppliers(ctx, win)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range sup {
		if s.Phone != "" || s.Email != "" || s.City != "" || s.Contact != "" {
			t.Errorf("contact details without the columns: %+v", s)
		}
		if s.Year == 0 && s.LastYear == 0 && s.LastPurchase == "" {
			t.Errorf("without CT_Type only suppliers bought from are listed, got %+v", s)
		}
	}
	if len(sup) == 0 {
		t.Error("no suppliers")
	}

	orders, err := src.PurchaseOrders(ctx)
	if err != nil {
		t.Fatal(err)
	}
	wantOrders, _ := demo.PurchaseOrders(ctx)
	if len(orders) != len(wantOrders)+1 { // the closed order counts without DO_Cloture
		t.Errorf("orders: got %d, want %d", len(orders), len(wantOrders)+1)
	}
	for _, o := range orders {
		if o.Delivery != "" {
			t.Errorf("delivery date without the column: %+v", o)
		}
	}

	_, items, err := src.Stock(ctx, 0)
	if err != nil {
		t.Fatal(err)
	}
	for _, it := range items {
		if it.Supplier != "" || it.SupplierName != "" {
			t.Fatalf("supplier without F_ARTFOURNISS: %+v", it)
		}
	}
}

func compareSuppliers(t *testing.T, got, want []Supplier) {
	t.Helper()
	sort.Slice(got, func(i, j int) bool { return got[i].Code < got[j].Code })
	sort.Slice(want, func(i, j int) bool { return want[i].Code < want[j].Code })
	if len(got) != len(want) {
		t.Fatalf("suppliers: got %d, want %d", len(got), len(want))
	}
	for i := range want {
		g, w := got[i], want[i]
		if g.Code != w.Code || g.Name != w.Name || g.Contact != w.Contact || g.Phone != w.Phone || g.Email != w.Email ||
			g.City != w.City || g.LastPurchase != w.LastPurchase || math.Abs(g.Year-w.Year) > 0.01 ||
			math.Abs(g.YearLastYear-w.YearLastYear) > 0.01 || math.Abs(g.LastYear-w.LastYear) > 0.01 {
			t.Errorf("supplier %d: got %+v, want %+v", i, g, w)
		}
	}
}

func compareOrders(t *testing.T, got, want []Order) {
	t.Helper()
	sort.Slice(got, func(i, j int) bool { return got[i].Piece < got[j].Piece })
	sort.Slice(want, func(i, j int) bool { return want[i].Piece < want[j].Piece })
	if len(got) != len(want) {
		t.Fatalf("orders: got %d, want %d", len(got), len(want))
	}
	for i := range want {
		g, w := got[i], want[i]
		if g.Piece != w.Piece || g.Supplier != w.Supplier || g.Name != w.Name || g.Date != w.Date ||
			g.Delivery != w.Delivery || math.Abs(g.HT-w.HT) > 0.01 {
			t.Errorf("order %d: got %+v, want %+v", i, g, w)
		}
	}
}

func compareRanked(t *testing.T, name string, got, want []Ranked) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: got %d rows, want %d", name, len(got), len(want))
	}
	for i := range want {
		if got[i].Code != want[i].Code || got[i].Name != want[i].Name ||
			math.Abs(got[i].HT-want[i].HT) > 0.01 || math.Abs(got[i].Qty-want[i].Qty) > 1e-6 {
			t.Errorf("%s #%d: got %+v, want %+v", name, i, got[i], want[i])
		}
	}
}

func contains(list []string, s string) bool {
	for _, v := range list {
		if v == s {
			return true
		}
	}
	return false
}
