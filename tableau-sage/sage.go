package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/golang-sql/civil"
	_ "github.com/microsoft/go-mssqldb"
)

// dsn turns what the person typed ("SERVEUR\SAGE100", "SERVEUR,1433", ".")
// into a go-mssqldb connection URL. An empty user means Windows authentication.
func dsn(cfg *Config, database string) (string, error) {
	server := strings.TrimSpace(cfg.Server)
	if server == "" {
		return "", fmt.Errorf("nom du serveur vide")
	}
	host, instance, _ := strings.Cut(server, `\`)
	port := ""
	if h, p, ok := strings.Cut(host, ","); ok {
		host, port = h, p
	} else if h, p, ok := strings.Cut(host, ":"); ok {
		host, port = h, p
	}
	host = strings.TrimSpace(host)
	switch strings.ToLower(host) {
	case ".", "(local)", "(localdb)", "":
		host = "localhost"
	}
	if port != "" {
		if _, err := strconv.Atoi(strings.TrimSpace(port)); err != nil {
			return "", fmt.Errorf("port invalide : %q", port)
		}
		host += ":" + strings.TrimSpace(port)
	}

	u := &url.URL{Scheme: "sqlserver", Host: host}
	if instance != "" {
		u.Path = "/" + instance
	}
	if cfg.Auth == "sql" {
		u.User = url.UserPassword(cfg.User, cfg.Password)
	}
	q := url.Values{}
	if database != "" {
		q.Set("database", database)
	}
	q.Set("app name", "Tableau Sage")
	q.Set("dial timeout", "10")
	q.Set("connection timeout", "20")
	// Sage installations use the self-signed certificate SQL Server generates.
	q.Set("TrustServerCertificate", "true")
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func openDB(ctx context.Context, cfg *Config, database string) (*sql.DB, error) {
	conn, err := dsn(cfg, database)
	if err != nil {
		return nil, err
	}
	db, err := sql.Open("sqlserver", conn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(4)
	db.SetConnMaxIdleTime(5 * time.Minute)
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

type Company struct {
	Database string `json:"database"`
	Name     string `json:"name"`
}

type DatabaseList struct {
	Sage   []Company `json:"sage"`
	Others []string  `json:"others"`
}

// listDatabases connects to the server and sorts its databases into Sage 100
// companies (they hold the Gestion commerciale tables) and everything else.
func listDatabases(ctx context.Context, cfg *Config) (*DatabaseList, error) {
	db, err := openDB(ctx, cfg, "")
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.QueryContext(ctx, `
		SELECT name FROM sys.databases
		WHERE database_id > 4 AND state = 0 AND HAS_DBACCESS(name) = 1
		ORDER BY name`)
	if err != nil {
		return nil, err
	}
	var names []string
	for rows.Next() {
		var n string
		if err := rows.Scan(&n); err != nil {
			rows.Close()
			return nil, err
		}
		names = append(names, n)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	list := &DatabaseList{Sage: []Company{}, Others: []string{}}
	for _, n := range names {
		var isSage int
		err := db.QueryRowContext(ctx, `
			SELECT CASE WHEN OBJECT_ID(QUOTENAME(@db) + N'.dbo.F_DOCENTETE') IS NOT NULL
			             AND OBJECT_ID(QUOTENAME(@db) + N'.dbo.F_ARTSTOCK') IS NOT NULL
			       THEN 1 ELSE 0 END`, sql.Named("db", n)).Scan(&isSage)
		if err != nil || isSage == 0 {
			list.Others = append(list.Others, n)
			continue
		}
		list.Sage = append(list.Sage, Company{Database: n, Name: companyName(ctx, db, n)})
	}
	sort.Slice(list.Sage, func(i, j int) bool { return list.Sage[i].Name < list.Sage[j].Name })
	return list, nil
}

// companyName reads the company name Sage stores in P_DOSSIER, falling back to
// the database name.
func companyName(ctx context.Context, db *sql.DB, database string) string {
	quoted := "[" + strings.ReplaceAll(database, "]", "]]") + "]"
	var name sql.NullString
	err := db.QueryRowContext(ctx, `
		IF COL_LENGTH(N'`+strings.ReplaceAll(quoted, "'", "''")+`.dbo.P_DOSSIER', N'D_RaisonSoc') IS NOT NULL
			EXEC(N'SELECT TOP 1 D_RaisonSoc FROM `+strings.ReplaceAll(quoted, "'", "''")+`.dbo.P_DOSSIER')
		ELSE
			SELECT CAST(NULL AS nvarchar(100))`).Scan(&name)
	if err != nil || strings.TrimSpace(name.String) == "" {
		return database
	}
	return strings.TrimSpace(name.String)
}

// requiredColumns lists every Sage column the dashboard reads. Checking them up
// front turns a version difference into a precise message instead of a failed query.
var requiredColumns = map[string][]string{
	"F_DOCENTETE": {"DO_Domaine", "DO_Type", "DO_Piece", "DO_Date", "DO_Tiers", "DO_Provenance"},
	"F_DOCLIGNE":  {"DO_Domaine", "DO_Type", "DO_Piece", "AR_Ref", "DL_Qte", "DL_MontantHT"},
	"F_COMPTET":   {"CT_Num", "CT_Intitule"},
	"F_ARTICLE":   {"AR_Ref", "AR_Design", "FA_CodeFamille", "AR_Sommeil", "AR_SuiviStock"},
	"F_ARTSTOCK":  {"AR_Ref", "DE_No", "AS_QteSto", "AS_QteRes", "AS_QteCom", "AS_QteMini", "AS_MontSto"},
	"F_DEPOT":     {"DE_No", "DE_Intitule"},
	"F_FAMILLE":   {"FA_CodeFamille", "FA_Intitule"},
}

type SchemaError struct{ Missing []string }

func (e *SchemaError) Error() string {
	return "colonnes Sage introuvables : " + strings.Join(e.Missing, ", ")
}

func checkSchema(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `
		SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME IN
			('F_DOCENTETE','F_DOCLIGNE','F_COMPTET','F_ARTICLE','F_ARTSTOCK','F_DEPOT','F_FAMILLE')`)
	if err != nil {
		return err
	}
	defer rows.Close()
	have := map[string]bool{}
	for rows.Next() {
		var t, c string
		if err := rows.Scan(&t, &c); err != nil {
			return err
		}
		have[strings.ToUpper(t+"."+c)] = true
	}
	if err := rows.Err(); err != nil {
		return err
	}
	var missing []string
	for table, cols := range requiredColumns {
		for _, c := range cols {
			if !have[strings.ToUpper(table+"."+c)] {
				missing = append(missing, table+"."+c)
			}
		}
	}
	if len(missing) > 0 {
		sort.Strings(missing)
		return &SchemaError{Missing: missing}
	}
	return nil
}

type sageSource struct {
	db      *sql.DB
	company string
}

func connectSage(ctx context.Context, cfg *Config) (*sageSource, error) {
	if strings.TrimSpace(cfg.Database) == "" {
		return nil, fmt.Errorf("aucune société choisie")
	}
	db, err := openDB(ctx, cfg, cfg.Database)
	if err != nil {
		return nil, err
	}
	if err := checkSchema(ctx, db); err != nil {
		db.Close()
		return nil, err
	}
	return &sageSource{db: db, company: companyName(ctx, db, cfg.Database)}, nil
}

func (s *sageSource) Company() string { return s.company }
func (s *sageSource) Close()          { s.db.Close() }

// salesLines are the lines of sales invoices (DO_Domaine 0, DO_Type 6 "facture"
// and 7 "facture comptabilisée"). Return and credit invoices (DO_Provenance 1
// and 2) count negatively whatever sign their amounts are stored with.
// NOLOCK keeps these reads from ever blocking people working in Sage.
const salesLines = `
WITH L AS (
	SELECT e.DO_Date AS D, e.DO_Tiers AS Client, l.AR_Ref AS Ref,
		CAST(CASE WHEN e.DO_Provenance IN (1, 2) THEN -ABS(l.DL_MontantHT) ELSE l.DL_MontantHT END AS float) AS HT,
		CAST(CASE WHEN e.DO_Provenance IN (1, 2) THEN -ABS(l.DL_Qte) ELSE l.DL_Qte END AS float) AS Qte
	FROM dbo.F_DOCLIGNE l WITH (NOLOCK)
	JOIN dbo.F_DOCENTETE e WITH (NOLOCK)
		ON e.DO_Domaine = l.DO_Domaine AND e.DO_Type = l.DO_Type AND e.DO_Piece = l.DO_Piece
	WHERE l.DO_Domaine = 0 AND l.DO_Type IN (6, 7)
		AND e.DO_Date >= @from AND e.DO_Date < @to
)`

func (s *sageSource) Sales(ctx context.Context, from, topFrom, to time.Time) (*SalesRaw, error) {
	raw := &SalesRaw{}

	rows, err := s.db.QueryContext(ctx, salesLines+`
		SELECT CAST(D AS date), SUM(HT) FROM L GROUP BY CAST(D AS date)`,
		sql.Named("from", civil.DateOf(from)), sql.Named("to", civil.DateOf(to)))
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var d DayTotal
		var ht sql.NullFloat64
		if err := rows.Scan(&d.Day, &ht); err != nil {
			rows.Close()
			return nil, err
		}
		d.HT = ht.Float64
		raw.Days = append(raw.Days, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, err
	}

	top := func(query string, withQty bool) ([]Ranked, error) {
		rows, err := s.db.QueryContext(ctx, salesLines+query,
			sql.Named("from", civil.DateOf(topFrom)), sql.Named("to", civil.DateOf(to)))
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		var out []Ranked
		for rows.Next() {
			var r Ranked
			var code, name sql.NullString
			var qty, ht sql.NullFloat64
			if withQty {
				err = rows.Scan(&code, &name, &qty, &ht)
			} else {
				err = rows.Scan(&code, &name, &ht)
			}
			if err != nil {
				return nil, err
			}
			r.Code, r.Name = strings.TrimSpace(code.String), strings.TrimSpace(name.String)
			r.Qty, r.HT = qty.Float64, ht.Float64
			if r.Name == "" {
				r.Name = r.Code
			}
			out = append(out, r)
		}
		return out, rows.Err()
	}

	raw.TopClients, err = top(`
		SELECT TOP 10 L.Client, MAX(c.CT_Intitule), SUM(L.HT)
		FROM L LEFT JOIN dbo.F_COMPTET c WITH (NOLOCK) ON c.CT_Num = L.Client
		GROUP BY L.Client
		HAVING SUM(L.HT) > 0
		ORDER BY SUM(L.HT) DESC`, false)
	if err != nil {
		return nil, err
	}
	raw.TopArticles, err = top(`
		SELECT TOP 10 L.Ref, MAX(a.AR_Design), SUM(L.Qte), SUM(L.HT)
		FROM L LEFT JOIN dbo.F_ARTICLE a WITH (NOLOCK) ON a.AR_Ref = L.Ref
		WHERE L.Ref IS NOT NULL AND L.Ref <> ''
		GROUP BY L.Ref
		HAVING SUM(L.HT) > 0
		ORDER BY SUM(L.HT) DESC`, true)
	if err != nil {
		return nil, err
	}
	return raw, nil
}

func (s *sageSource) Stock(ctx context.Context, depot int) ([]Depot, []StockItem, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DE_No, ISNULL(DE_Intitule, '') FROM dbo.F_DEPOT WITH (NOLOCK) ORDER BY DE_No`)
	if err != nil {
		return nil, nil, err
	}
	var depots []Depot
	for rows.Next() {
		var d Depot
		if err := rows.Scan(&d.No, &d.Name); err != nil {
			rows.Close()
			return nil, nil, err
		}
		d.Name = strings.TrimSpace(d.Name)
		depots = append(depots, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	// Only active articles (AR_Sommeil = 0) whose stock Sage follows
	// (AR_SuiviStock <> 0). For a single depot, only articles stocked there.
	rows, err = s.db.QueryContext(ctx, `
		SELECT a.AR_Ref, ISNULL(a.AR_Design, ''), ISNULL(MAX(f.FA_Intitule), ISNULL(a.FA_CodeFamille, '')),
			CAST(ISNULL(SUM(s.AS_QteSto), 0) AS float),
			CAST(ISNULL(SUM(s.AS_QteRes), 0) AS float),
			CAST(ISNULL(SUM(s.AS_QteCom), 0) AS float),
			CAST(ISNULL(SUM(s.AS_QteMini), 0) AS float),
			CAST(ISNULL(SUM(s.AS_MontSto), 0) AS float)
		FROM dbo.F_ARTICLE a WITH (NOLOCK)
		LEFT JOIN dbo.F_ARTSTOCK s WITH (NOLOCK)
			ON s.AR_Ref = a.AR_Ref AND (@depot = 0 OR s.DE_No = @depot)
		LEFT JOIN dbo.F_FAMILLE f WITH (NOLOCK) ON f.FA_CodeFamille = a.FA_CodeFamille
		WHERE a.AR_Sommeil = 0 AND a.AR_SuiviStock <> 0
		GROUP BY a.AR_Ref, a.AR_Design, a.FA_CodeFamille
		HAVING @depot = 0 OR COUNT(s.AR_Ref) > 0`, sql.Named("depot", depot))
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	var items []StockItem
	for rows.Next() {
		var it StockItem
		if err := rows.Scan(&it.Ref, &it.Name, &it.Family, &it.Qty, &it.Reserved, &it.Ordered, &it.Min, &it.Value); err != nil {
			return nil, nil, err
		}
		it.Ref, it.Name, it.Family = strings.TrimSpace(it.Ref), strings.TrimSpace(it.Name), strings.TrimSpace(it.Family)
		items = append(items, it)
	}
	return depots, items, rows.Err()
}
