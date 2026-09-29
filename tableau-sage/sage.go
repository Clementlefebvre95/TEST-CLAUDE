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

// requiredColumns lists the Sage columns the dashboard cannot do without.
// Checking them up front turns a version difference into a precise message
// instead of a failed query.
var requiredColumns = map[string][]string{
	"F_DOCENTETE": {"DO_Domaine", "DO_Type", "DO_Piece", "DO_Date", "DO_Tiers", "DO_Provenance"},
	"F_DOCLIGNE":  {"DO_Domaine", "DO_Type", "DO_Piece", "AR_Ref", "DL_Qte", "DL_MontantHT"},
	"F_COMPTET":   {"CT_Num", "CT_Intitule"},
	"F_ARTICLE":   {"AR_Ref", "AR_Design", "FA_CodeFamille", "AR_Sommeil", "AR_SuiviStock"},
	"F_ARTSTOCK":  {"AR_Ref", "DE_No", "AS_QteSto", "AS_QteRes", "AS_QteCom", "AS_QteMini", "AS_MontSto"},
	"F_DEPOT":     {"DE_No", "DE_Intitule"},
	"F_FAMILLE":   {"FA_CodeFamille", "FA_Intitule"},
}

// optionalColumns are read when present. Some Sage versions or installations
// lack them; the dashboard then leaves the matching detail out.
var optionalColumns = map[string][]string{
	"F_DOCENTETE":   {"DO_DateLivr", "DO_Cloture"},
	"F_COMPTET":     {"CT_Type", "CT_Sommeil", "CT_Contact", "CT_Telephone", "CT_EMail", "CT_Ville"},
	"F_ARTFOURNISS": {"AR_Ref", "CT_Num", "AF_Principal"},
}

type SchemaError struct{ Missing []string }

func (e *SchemaError) Error() string {
	return "colonnes Sage introuvables : " + strings.Join(e.Missing, ", ")
}

// readSchema returns which of the columns the dashboard knows about exist, as
// upper-case "TABLE.COLUMN", or a SchemaError when a required one is missing.
func readSchema(ctx context.Context, db *sql.DB) (map[string]bool, error) {
	var tables []string
	for t := range requiredColumns {
		tables = append(tables, "'"+t+"'")
	}
	for t := range optionalColumns {
		if _, ok := requiredColumns[t]; !ok {
			tables = append(tables, "'"+t+"'")
		}
	}
	sort.Strings(tables)
	rows, err := db.QueryContext(ctx, `
		SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
		WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME IN (`+strings.Join(tables, ",")+`)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	have := map[string]bool{}
	for rows.Next() {
		var t, c string
		if err := rows.Scan(&t, &c); err != nil {
			return nil, err
		}
		have[strings.ToUpper(t+"."+c)] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
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
		return nil, &SchemaError{Missing: missing}
	}
	return have, nil
}

type sageSource struct {
	db      *sql.DB
	company string
	have    map[string]bool
}

func connectSage(ctx context.Context, cfg *Config) (*sageSource, error) {
	if strings.TrimSpace(cfg.Database) == "" {
		return nil, fmt.Errorf("aucune société choisie")
	}
	db, err := openDB(ctx, cfg, cfg.Database)
	if err != nil {
		return nil, err
	}
	have, err := readSchema(ctx, db)
	if err != nil {
		db.Close()
		return nil, err
	}
	return &sageSource{db: db, company: companyName(ctx, db, cfg.Database), have: have}, nil
}

func (s *sageSource) Company() string { return s.company }
func (s *sageSource) Close()          { s.db.Close() }

func (s *sageSource) has(column string) bool { return s.have[strings.ToUpper(column)] }

// pick returns expr when the column exists, fallback otherwise.
func (s *sageSource) pick(column, expr, fallback string) string {
	if s.has(column) {
		return expr
	}
	return fallback
}

func (s *sageSource) Features() Features {
	return Features{
		DeliveryDates: s.has("F_DOCENTETE.DO_DateLivr"),
		Contacts: s.has("F_COMPTET.CT_Contact") || s.has("F_COMPTET.CT_Telephone") ||
			s.has("F_COMPTET.CT_EMail") || s.has("F_COMPTET.CT_Ville"),
		ArticleSuppliers: s.has("F_ARTFOURNISS.AR_Ref") && s.has("F_ARTFOURNISS.CT_Num") &&
			s.has("F_ARTFOURNISS.AF_Principal"),
	}
}

// flowLines selects invoice lines: sales (DO_Domaine 0, DO_Type 6 "facture" and
// 7 "facture comptabilisée") or purchases (DO_Domaine 1, DO_Type 16 and 17).
// Return and credit invoices (DO_Provenance 1 and 2) count negatively whatever
// sign their amounts are stored with. NOLOCK keeps these reads from ever
// blocking people working in Sage.
func flowLines(kind FlowKind) string {
	domain, types := 0, "6, 7"
	if kind == Purchases {
		domain, types = 1, "16, 17"
	}
	return fmt.Sprintf(`
WITH L AS (
	SELECT e.DO_Date AS D, e.DO_Tiers AS Tiers, l.AR_Ref AS Ref,
		CAST(CASE WHEN e.DO_Provenance IN (1, 2) THEN -ABS(l.DL_MontantHT) ELSE l.DL_MontantHT END AS float) AS HT,
		CAST(CASE WHEN e.DO_Provenance IN (1, 2) THEN -ABS(l.DL_Qte) ELSE l.DL_Qte END AS float) AS Qte
	FROM dbo.F_DOCLIGNE l WITH (NOLOCK)
	JOIN dbo.F_DOCENTETE e WITH (NOLOCK)
		ON e.DO_Domaine = l.DO_Domaine AND e.DO_Type = l.DO_Type AND e.DO_Piece = l.DO_Piece
	WHERE l.DO_Domaine = %d AND l.DO_Type IN (%s)
		AND e.DO_Date >= @from AND e.DO_Date < @to
)`, domain, types)
}

const topArticlesQuery = `
	SELECT TOP 10 L.Ref, MAX(a.AR_Design), SUM(L.Qte), SUM(L.HT)
	FROM L LEFT JOIN dbo.F_ARTICLE a WITH (NOLOCK) ON a.AR_Ref = L.Ref
	WHERE L.Ref IS NOT NULL AND L.Ref <> ''%s
	GROUP BY L.Ref
	HAVING SUM(L.HT) > 0
	ORDER BY SUM(L.HT) DESC`

// ranked runs a query returning (code, name, [quantity,] amount) rows.
func (s *sageSource) ranked(ctx context.Context, query string, withQty bool, args ...any) ([]Ranked, error) {
	rows, err := s.db.QueryContext(ctx, query, args...)
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

func (s *sageSource) Flow(ctx context.Context, kind FlowKind, w Window) (*FlowRaw, error) {
	lines := flowLines(kind)
	raw := &FlowRaw{}

	rows, err := s.db.QueryContext(ctx, lines+`
		SELECT CAST(D AS date), SUM(HT) FROM L GROUP BY CAST(D AS date)`,
		sql.Named("from", civil.DateOf(w.From)), sql.Named("to", civil.DateOf(w.To)))
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

	since := []any{sql.Named("from", civil.DateOf(w.YearStart)), sql.Named("to", civil.DateOf(w.To))}
	raw.TopTiers, err = s.ranked(ctx, lines+`
		SELECT TOP 10 L.Tiers, MAX(c.CT_Intitule), SUM(L.HT)
		FROM L LEFT JOIN dbo.F_COMPTET c WITH (NOLOCK) ON c.CT_Num = L.Tiers
		GROUP BY L.Tiers
		HAVING SUM(L.HT) > 0
		ORDER BY SUM(L.HT) DESC`, false, since...)
	if err != nil {
		return nil, err
	}
	if kind == Sales {
		raw.TopArticles, err = s.ranked(ctx, lines+fmt.Sprintf(topArticlesQuery, ""), true, since...)
		if err != nil {
			return nil, err
		}
	}
	return raw, nil
}

func (s *sageSource) SupplierArticles(ctx context.Context, code string, from, to time.Time) ([]Ranked, error) {
	return s.ranked(ctx, flowLines(Purchases)+fmt.Sprintf(topArticlesQuery, " AND L.Tiers = @code"), true,
		sql.Named("from", civil.DateOf(from)), sql.Named("to", civil.DateOf(to)), sql.Named("code", code))
}

// Suppliers lists the active suppliers (CT_Type 1, not dormant) and anyone
// with purchase invoices in the window, with what was bought from them. Without
// CT_Type, the list is only whoever appears on purchase invoices.
func (s *sageSource) Suppliers(ctx context.Context, w Window) ([]Supplier, error) {
	text := func(col string) string { return s.pick("F_COMPTET."+col, "ISNULL(c."+col+", '')", "''") }
	active := "0 = 1"
	if s.has("F_COMPTET.CT_Type") {
		active = "c.CT_Type = 1" + s.pick("F_COMPTET.CT_Sommeil", " AND c.CT_Sommeil = 0", "")
	}
	rows, err := s.db.QueryContext(ctx, flowLines(Purchases)+`,
S AS (
	SELECT Tiers,
		SUM(CASE WHEN D >= @y0 THEN HT ELSE 0 END) AS Y,
		SUM(CASE WHEN D < @lycut THEN HT ELSE 0 END) AS YLY,
		SUM(CASE WHEN D < @y0 THEN HT ELSE 0 END) AS LY,
		MAX(D) AS Last
	FROM L GROUP BY Tiers
)
SELECT c.CT_Num, ISNULL(c.CT_Intitule, ''), `+text("CT_Contact")+`, `+text("CT_Telephone")+`,
	`+text("CT_EMail")+`, `+text("CT_Ville")+`, ISNULL(S.Y, 0), ISNULL(S.YLY, 0), ISNULL(S.LY, 0), S.Last
FROM dbo.F_COMPTET c WITH (NOLOCK)
LEFT JOIN S ON S.Tiers = c.CT_Num
WHERE (`+active+`) OR S.Tiers IS NOT NULL`,
		sql.Named("from", civil.DateOf(w.From)), sql.Named("to", civil.DateOf(w.To)),
		sql.Named("y0", civil.DateOf(w.YearStart)), sql.Named("lycut", civil.DateOf(w.LYCut)))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Supplier
	for rows.Next() {
		var sp Supplier
		var last sql.NullTime
		if err := rows.Scan(&sp.Code, &sp.Name, &sp.Contact, &sp.Phone, &sp.Email, &sp.City,
			&sp.Year, &sp.YearLastYear, &sp.LastYear, &last); err != nil {
			return nil, err
		}
		for _, f := range []*string{&sp.Code, &sp.Name, &sp.Contact, &sp.Phone, &sp.Email, &sp.City} {
			*f = strings.TrimSpace(*f)
		}
		if sp.Name == "" {
			sp.Name = sp.Code
		}
		if last.Valid {
			sp.LastPurchase = sageDate(last.Time)
		}
		out = append(out, sp)
	}
	return out, rows.Err()
}

// PurchaseOrders returns supplier orders (DO_Domaine 1, DO_Type 12 "bon de
// commande"). Sage keeps the undelivered remainder of a partly received order
// in the order itself, so every one still there is awaited, unless it was
// closed (DO_Cloture) without being delivered.
func (s *sageSource) PurchaseOrders(ctx context.Context) ([]Order, error) {
	delivery := s.pick("F_DOCENTETE.DO_DateLivr", "MAX(e.DO_DateLivr)", "CAST(NULL AS datetime)")
	open := s.pick("F_DOCENTETE.DO_Cloture", " AND e.DO_Cloture = 0", "")
	rows, err := s.db.QueryContext(ctx, `
		SELECT e.DO_Piece, MAX(e.DO_Tiers), MAX(c.CT_Intitule), MAX(e.DO_Date), `+delivery+`,
			CAST(ISNULL(SUM(l.DL_MontantHT), 0) AS float)
		FROM dbo.F_DOCENTETE e WITH (NOLOCK)
		LEFT JOIN dbo.F_DOCLIGNE l WITH (NOLOCK)
			ON l.DO_Domaine = e.DO_Domaine AND l.DO_Type = e.DO_Type AND l.DO_Piece = e.DO_Piece
		LEFT JOIN dbo.F_COMPTET c WITH (NOLOCK) ON c.CT_Num = e.DO_Tiers
		WHERE e.DO_Domaine = 1 AND e.DO_Type = 12`+open+`
		GROUP BY e.DO_Piece`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Order
	for rows.Next() {
		var o Order
		var tiers, name sql.NullString
		var date, due sql.NullTime
		if err := rows.Scan(&o.Piece, &tiers, &name, &date, &due, &o.HT); err != nil {
			return nil, err
		}
		o.Piece = strings.TrimSpace(o.Piece)
		o.Supplier, o.Name = strings.TrimSpace(tiers.String), strings.TrimSpace(name.String)
		if o.Name == "" {
			o.Name = o.Supplier
		}
		if date.Valid {
			o.Date = sageDate(date.Time)
		}
		if due.Valid {
			o.Delivery = sageDate(due.Time)
		}
		out = append(out, o)
	}
	return out, rows.Err()
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

	// The main supplier is the one marked principal, else the first by account.
	supplierCols, supplierJoin := "'', ''", ""
	if s.Features().ArticleSuppliers {
		supplierCols = "ISNULL(MAX(mf.CT_Num), ''), ISNULL(MAX(fc.CT_Intitule), '')"
		supplierJoin = `
		LEFT JOIN (
			SELECT AR_Ref, CT_Num,
				ROW_NUMBER() OVER (PARTITION BY AR_Ref ORDER BY AF_Principal DESC, CT_Num) AS N
			FROM dbo.F_ARTFOURNISS WITH (NOLOCK)
		) mf ON mf.AR_Ref = a.AR_Ref AND mf.N = 1
		LEFT JOIN dbo.F_COMPTET fc WITH (NOLOCK) ON fc.CT_Num = mf.CT_Num`
	}

	// Only active articles (AR_Sommeil = 0) whose stock Sage follows
	// (AR_SuiviStock <> 0). For a single depot, only articles stocked there.
	rows, err = s.db.QueryContext(ctx, `
		SELECT a.AR_Ref, ISNULL(a.AR_Design, ''), ISNULL(MAX(f.FA_Intitule), ISNULL(a.FA_CodeFamille, '')),
			`+supplierCols+`,
			CAST(ISNULL(SUM(s.AS_QteSto), 0) AS float),
			CAST(ISNULL(SUM(s.AS_QteRes), 0) AS float),
			CAST(ISNULL(SUM(s.AS_QteCom), 0) AS float),
			CAST(ISNULL(SUM(s.AS_QteMini), 0) AS float),
			CAST(ISNULL(SUM(s.AS_MontSto), 0) AS float)
		FROM dbo.F_ARTICLE a WITH (NOLOCK)
		LEFT JOIN dbo.F_ARTSTOCK s WITH (NOLOCK)
			ON s.AR_Ref = a.AR_Ref AND (@depot = 0 OR s.DE_No = @depot)
		LEFT JOIN dbo.F_FAMILLE f WITH (NOLOCK) ON f.FA_CodeFamille = a.FA_CodeFamille`+supplierJoin+`
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
		if err := rows.Scan(&it.Ref, &it.Name, &it.Family, &it.Supplier, &it.SupplierName,
			&it.Qty, &it.Reserved, &it.Ordered, &it.Min, &it.Value); err != nil {
			return nil, nil, err
		}
		for _, f := range []*string{&it.Ref, &it.Name, &it.Family, &it.Supplier, &it.SupplierName} {
			*f = strings.TrimSpace(*f)
		}
		items = append(items, it)
	}
	return depots, items, rows.Err()
}
