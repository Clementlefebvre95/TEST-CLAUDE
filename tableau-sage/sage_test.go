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

func TestBuildSales(t *testing.T) {
	d := func(y int, m time.Month, day int) time.Time { return time.Date(y, m, day, 0, 0, 0, 0, time.UTC) }
	now := time.Date(2026, 3, 15, 16, 30, 0, 0, time.Local)
	raw := &SalesRaw{Days: []DayTotal{
		{d(2025, 1, 10), 100}, // last year, before the same-period cut-off
		{d(2025, 3, 2), 50},   // last year, same month, before the 15th
		{d(2025, 3, 16), 70},  // last year, after the 15th: full-year only
		{d(2025, 12, 31), 5},  // last year total only
		{d(2026, 1, 5), 200},  // this year
		{d(2026, 3, 1), 30},   // this month
		{d(2026, 3, 15), 12},  // today
		{d(2026, 3, 16), 999}, // dated in the future: ignored
	}}
	r := buildSales(now, raw)
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

const sageTables = `
CREATE TABLE P_DOSSIER (D_RaisonSoc varchar(35));
CREATE TABLE F_COMPTET (CT_Num varchar(17) PRIMARY KEY, CT_Intitule varchar(69), CT_Type smallint);
CREATE TABLE F_FAMILLE (FA_CodeFamille varchar(11) PRIMARY KEY, FA_Intitule varchar(69));
CREATE TABLE F_ARTICLE (AR_Ref varchar(19) PRIMARY KEY, AR_Design varchar(69), FA_CodeFamille varchar(11),
	AR_Sommeil smallint, AR_SuiviStock smallint);
CREATE TABLE F_DEPOT (DE_No int PRIMARY KEY, DE_Intitule varchar(35));
CREATE TABLE F_ARTSTOCK (AR_Ref varchar(19), DE_No int, AS_QteSto numeric(24,6), AS_QteRes numeric(24,6),
	AS_QteCom numeric(24,6), AS_QteMini numeric(24,6), AS_MontSto numeric(24,6));
CREATE TABLE F_DOCENTETE (DO_Domaine smallint, DO_Type smallint, DO_Piece varchar(13), DO_Date smalldatetime,
	DO_Tiers varchar(17), DO_Provenance smallint);
CREATE TABLE F_DOCLIGNE (DO_Domaine smallint, DO_Type smallint, CT_Num varchar(17), DO_Piece varchar(13),
	AR_Ref varchar(19) NULL, DL_Qte numeric(24,6), DL_MontantHT numeric(24,6));
`

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
// ones, so both sign conventions go through the query.
func loadWorld(ctx context.Context, db *sql.DB, w *demoWorld) error {
	if _, err := db.ExecContext(ctx, sageTables); err != nil {
		return err
	}
	var rows []string
	add := func(format string, args ...any) { rows = append(rows, fmt.Sprintf(format, args...)) }
	flush := func(table string) error {
		err := insertRows(ctx, db, table, rows)
		rows = rows[:0]
		return err
	}

	add("(%s)", sqlStr(w.Company))
	if err := flush("P_DOSSIER"); err != nil {
		return err
	}
	for _, c := range w.Clients {
		add("(%s,%s,0)", sqlStr(c.Num), sqlStr(c.Name))
	}
	add("('F0001',N'Fournisseur Démo',1)")
	if err := flush("F_COMPTET"); err != nil {
		return err
	}
	for _, f := range w.Families {
		add("(%s,%s)", sqlStr(f[0]), sqlStr(f[1]))
	}
	if err := flush("F_FAMILLE"); err != nil {
		return err
	}
	b := func(v bool) int {
		if v {
			return 1
		}
		return 0
	}
	for _, a := range w.Articles {
		add("(%s,%s,%s,%d,%d)", sqlStr(a.Ref), sqlStr(a.Name), sqlStr(a.Family), b(a.Sleeping), 2*b(a.Tracked))
	}
	if err := flush("F_ARTICLE"); err != nil {
		return err
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
		add("(%d,%d,%s,'%s',%s,%d)", d.Domaine, d.Type, sqlStr(d.Piece), d.Date.Format("20060102"), sqlStr(d.Client), d.Provenance)
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
			add("(%d,%d,%s,%s,%s,%g,%g)", d.Domaine, d.Type, sqlStr(d.Client), sqlStr(d.Piece), ref, qty, ht)
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

func TestSQLMatchesDemo(t *testing.T) {
	cfg := testServer(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	master, err := openDB(ctx, cfg, "")
	if err != nil {
		t.Fatal(err)
	}
	defer master.Close()
	for _, name := range []string{"TABLEAU_DEMO", "AUTRE_BASE"} {
		if err := recreateDB(ctx, master, name); err != nil {
			t.Fatal(err)
		}
	}

	now := time.Now()
	demo := newDemoSource(now)
	db, err := openDB(ctx, cfg, "TABLEAU_DEMO")
	if err != nil {
		t.Fatal(err)
	}
	if err := loadWorld(ctx, db, demo.world); err != nil {
		t.Fatal(err)
	}
	db.Close()

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

	cfg.Database = "TABLEAU_DEMO"
	src, err := connectSage(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer src.Close()

	from, topFrom, to := salesWindow(now)
	got, err := src.Sales(ctx, from, topFrom, to)
	if err != nil {
		t.Fatal(err)
	}
	want, _ := demo.Sales(ctx, from, topFrom, to)
	if len(got.Days) != len(want.Days) {
		t.Fatalf("days: got %d, want %d", len(got.Days), len(want.Days))
	}
	sort.Slice(got.Days, func(i, j int) bool { return got.Days[i].Day.Before(got.Days[j].Day) })
	for i := range want.Days {
		g, w := got.Days[i], want.Days[i]
		if !dateOf(g.Day).Equal(w.Day) || math.Abs(g.HT-w.HT) > 0.005 {
			t.Fatalf("day %d: got %v %.2f, want %v %.2f", i, g.Day, g.HT, w.Day, w.HT)
		}
	}
	compareRanked(t, "top clients", got.TopClients, want.TopClients)
	compareRanked(t, "top articles", got.TopArticles, want.TopArticles)

	gotReport, wantReport := buildSales(now, got), buildSales(now, want)
	if math.Abs(gotReport.KPI.Year-wantReport.KPI.Year) > 0.01 || gotReport.KPI.Year <= 0 {
		t.Errorf("year KPI: got %.2f, want %.2f", gotReport.KPI.Year, wantReport.KPI.Year)
	}
	t.Logf("CA depuis le 1er janvier : %.2f (N-1 même période : %.2f)", gotReport.KPI.Year, gotReport.KPI.YearLastYear)

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
		for i := range w.Items {
			gi, wi := g.Items[i], w.Items[i]
			if gi.Ref != wi.Ref || gi.Name != wi.Name || gi.Family != wi.Family || math.Abs(gi.Qty-wi.Qty) > 1e-6 ||
				math.Abs(gi.Min-wi.Min) > 1e-6 || math.Abs(gi.Reserved-wi.Reserved) > 1e-6 {
				t.Fatalf("depot %d item %d: got %+v, want %+v", depot, i, gi, wi)
			}
		}
		t.Logf("dépôt %d : %+v", depot, g.Totals)
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
