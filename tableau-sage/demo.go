package main

import (
	"context"
	"fmt"
	"math"
	"math/rand/v2"
	"sort"
	"time"
)

// The demo world is shaped like a Sage 100 database: tiers, documents with a
// domain, type and provenance, lines, articles, their suppliers, per-depot
// stock. The demo source aggregates it in Go with the same rules the SQL
// queries apply, and the test loads it into SQL Server to check both agree.

type demoTiers struct {
	Num, Name                   string
	Type                        int // 0 client, 1 supplier (CT_Type)
	Sleeping                    bool
	Contact, Phone, Email, City string
}

type demoArticle struct {
	Ref, Name, Family string
	Price, Cost       float64
	Tracked, Sleeping bool
	weight            float64
}

type demoArtSupplier struct {
	Ref, Supplier string
	Principal     bool
}

type demoStock struct {
	Ref                     string
	Depot                   int
	Qty, Res, Com, Min, Val float64
}

type demoLine struct {
	Ref     string // empty for comment lines
	Qty, HT float64
}

type demoDoc struct {
	Domaine, Type, Provenance int
	Piece                     string
	Date                      time.Time
	Delivery                  time.Time // expected delivery; zero when none
	Closed                    bool      // DO_Cloture
	Tiers                     string
	Lines                     []demoLine
}

type demoWorld struct {
	Company      string
	Clients      []demoTiers
	Suppliers    []demoTiers
	Families     [][2]string // code, name
	Articles     []demoArticle
	ArtSuppliers []demoArtSupplier
	Depots       []Depot
	Stock        []demoStock
	Docs         []demoDoc
}

var demoFamilies = [][2]string{
	{"OUTIL", "Outillage"}, {"VISS", "Visserie"}, {"PEINT", "Peinture"},
	{"ELEC", "Électricité"}, {"PLOMB", "Plomberie"}, {"JARD", "Jardin"},
	{"SERV", "Services"},
}

var demoCatalog = map[string][]string{
	"OUTIL": {"Perceuse visseuse 18V", "Marteau menuisier 500 g", "Scie égoïne 550 mm", "Niveau à bulle 60 cm", "Jeu de tournevis 8 pièces", "Mètre ruban 5 m", "Pince multiprise", "Clé à molette 250 mm", "Meuleuse 125 mm", "Coffret de forets 19 pièces"},
	"VISS":  {"Vis bois 4x40 (boîte de 200)", "Vis bois 5x60 (boîte de 100)", "Chevilles nylon 8 mm (x100)", "Boulons M8 (x50)", "Rondelles M10 (x100)", "Clous tête plate 70 mm (1 kg)", "Tire-fond 8x80 (x25)", "Vis placo 3,5x35 (x500)"},
	"PEINT": {"Peinture murale blanche 10 L", "Sous-couche 5 L", "Lasure chêne 2,5 L", "Rouleau 180 mm", "Pinceau plat 50 mm", "Bâche de protection 4x5 m", "Enduit de rebouchage 1 kg", "Ruban de masquage 50 m"},
	"ELEC":  {"Câble R2V 3G2,5 (50 m)", "Interrupteur va-et-vient", "Prise 2P+T", "Disjoncteur 16 A", "Ampoule LED E27 9W", "Gaine ICTA 20 mm (100 m)", "Boîte d'encastrement", "Rallonge 10 m"},
	"PLOMB": {"Tube multicouche 16 mm (50 m)", "Raccord à sertir 16 mm", "Robinet d'arrêt 1/2", "Siphon lavabo", "Mitigeur évier", "Flexible inox 50 cm", "Colle PVC 250 ml", "Téflon (rouleau)"},
	"JARD":  {"Tuyau d'arrosage 25 m", "Sécateur", "Terreau universel 50 L", "Brouette 100 L", "Râteau 14 dents", "Gants de jardin", "Engrais gazon 5 kg", "Pulvérisateur 5 L"},
	"SERV":  {"Frais de transport", "Livraison sur chantier"},
}

var demoClientNames = []string{
	"Bâtiment Morel", "Menuiserie Garnier", "SARL Dupuis Rénovation", "Électricité Lambert",
	"Plomberie Rousseau", "Mairie de Saint-Aubin", "Jardins Fontaine", "Entreprise Mercier",
	"Chauffage Girard", "Peintures Bonnet", "Maçonnerie Faure", "Toitures André",
	"Camping Les Pins", "Lycée professionnel Jean Moulin", "Résidence Les Tilleuls",
	"Agence Immo Perrin", "Garage Chevalier", "Hôtel du Marché", "Boulangerie Robin",
	"Particulier (comptoir)", "Ferme Blanchard", "Paysages Gauthier", "SCI Clément",
	"Atelier Masson", "Multiservices Henry", "Collège Victor Hugo", "Entreprise Roche",
	"Isolation Dumas", "Carrelage Fournier", "Syndic Lefèvre",
}

// Fictional suppliers. Phone numbers are in the 01 99 00 range set aside for
// fiction, e-mail domains in the reserved .example TLD.
var demoSuppliers = []demoTiers{
	{Num: "F0001", Name: "Distri-Outils Martin", Contact: "Julien Martin", Phone: "01 99 00 12 34", Email: "commandes@distri-outils.example", City: "Lyon"},
	{Num: "F0002", Name: "Boulonnerie Vasseur", Contact: "Sophie Vasseur", Phone: "01 99 00 23 45", Email: "contact@boulonnerie-vasseur.example", City: "Saint-Étienne"},
	{Num: "F0003", Name: "Couleurs & Enduits Barre", Contact: "Marc Barre", Phone: "01 99 00 34 56", Email: "ventes@couleurs-barre.example", City: "Grenoble"},
	{Num: "F0004", Name: "Électro Négoce Poulain", Contact: "Nadia Poulain", Phone: "01 99 00 45 67", Email: "pro@electro-poulain.example", City: "Villeurbanne"},
	{Num: "F0005", Name: "Hydro Sanitaire Renard", Contact: "Paul Renard", Phone: "01 99 00 56 78", Email: "commandes@hydro-renard.example", City: "Mâcon"},
	{Num: "F0006", Name: "Vert Grossiste Colin", Contact: "Élodie Colin", Phone: "01 99 00 67 89", Email: "grossiste@vert-colin.example", City: "Valence"},
	{Num: "F0007", Name: "Multi-Bricolage Denis", Contact: "Karim Denis", Phone: "01 99 00 78 90", Email: "achats@multibricolage-denis.example", City: "Clermont-Ferrand"},
	{Num: "F0008", Name: "Transports Brunet", Contact: "Luc Brunet", Phone: "01 99 00 89 01", City: "Vienne"},
	{Num: "F0009", Name: "Ancien fournisseur Picard", Sleeping: true, City: "Roanne"},
	{Num: "F0010", Name: "Négoce Bois Arnaud", Sleeping: true, Phone: "01 99 00 90 12", City: "Annecy"},
}

// demoMainSupplier is the principal supplier of each family.
var demoMainSupplier = map[string]string{
	"OUTIL": "F0001", "VISS": "F0002", "PEINT": "F0003", "ELEC": "F0004",
	"PLOMB": "F0005", "JARD": "F0006", "SERV": "F0008",
}

func newDemoWorld(now time.Time) *demoWorld {
	rng := rand.New(rand.NewPCG(2026, 95))
	w := &demoWorld{
		Company:  "Quincaillerie Démo",
		Families: demoFamilies,
		Depots:   []Depot{{1, "Dépôt principal"}, {2, "Magasin"}},
	}

	for i, name := range demoClientNames {
		w.Clients = append(w.Clients, demoTiers{Num: fmt.Sprintf("C%04d", i+1), Name: name})
	}
	for _, s := range demoSuppliers {
		s.Type = 1
		w.Suppliers = append(w.Suppliers, s)
	}

	n := 0
	for _, fam := range demoFamilies {
		for _, name := range demoCatalog[fam[0]] {
			n++
			price := math.Round((3+rng.ExpFloat64()*35)*100) / 100
			a := demoArticle{
				Ref:      fmt.Sprintf("%s%03d", fam[0][:3], n),
				Name:     name,
				Family:   fam[0],
				Price:    price,
				Cost:     math.Round(price*(0.55+rng.Float64()*0.15)*100) / 100,
				Tracked:  n%17 != 0 && fam[0] != "SERV", // services and a few others are not stocked
				Sleeping: n%23 == 0,
				weight:   0.3 + rng.ExpFloat64(),
			}
			w.Articles = append(w.Articles, a)

			// Most articles come from their family's supplier; some also from a
			// generalist, a few only from the generalist (not marked principal)
			// and a few from nobody.
			switch {
			case n%13 == 9:
			case n%11 == 7:
				w.ArtSuppliers = append(w.ArtSuppliers, demoArtSupplier{Ref: a.Ref, Supplier: "F0007"})
			default:
				w.ArtSuppliers = append(w.ArtSuppliers, demoArtSupplier{Ref: a.Ref, Supplier: demoMainSupplier[fam[0]], Principal: true})
				if n%3 == 0 {
					w.ArtSuppliers = append(w.ArtSuppliers, demoArtSupplier{Ref: a.Ref, Supplier: "F0007"})
				}
			}
		}
	}

	for i, a := range w.Articles {
		for _, d := range w.Depots {
			if d.No == 2 && i%3 == 0 {
				continue // not every article is in the shop
			}
			min := float64(5 * (1 + rng.IntN(6)))
			qty := math.Round(min * (0.2 + rng.Float64()*3.5))
			switch {
			case i%13 == 5:
				qty = 0
			case i%11 == 3:
				qty = math.Max(1, math.Round(min*0.4))
			}
			w.Stock = append(w.Stock, demoStock{
				Ref: a.Ref, Depot: d.No, Qty: qty,
				Res: math.Min(qty, float64(rng.IntN(4))),
				Com: float64(rng.IntN(3)) * min,
				Min: min, Val: math.Round(qty*a.Cost*100) / 100,
			})
		}
	}

	today := dateOf(now)
	w.Docs = generateSales(rng, w, today)
	w.Docs = append(w.Docs, generatePurchases(rng, w, today)...)
	return w
}

func pickWeighted[T any](rng *rand.Rand, items []T, weight func(int) float64, total float64) T {
	x := rng.Float64() * total
	for i := range items {
		x -= weight(i)
		if x <= 0 {
			return items[i]
		}
	}
	return items[len(items)-1]
}

type pieceCounter map[string]int

func (c pieceCounter) next(prefix string) string {
	c[prefix]++
	return fmt.Sprintf("%s%05d", prefix, c[prefix])
}

func generateSales(rng *rand.Rand, w *demoWorld, today time.Time) []demoDoc {
	clientW := func(i int) float64 { return 1 / float64(i+1) } // a few big clients
	var clientTotal float64
	for i := range w.Clients {
		clientTotal += clientW(i)
	}
	var sellable []demoArticle
	for _, a := range w.Articles {
		if !a.Sleeping {
			sellable = append(sellable, a)
		}
	}
	artW := func(i int) float64 { return sellable[i].weight }
	var artTotal float64
	for i := range sellable {
		artTotal += artW(i)
	}

	piece := pieceCounter{}
	lines := func(scale float64) []demoLine {
		var ls []demoLine
		for k := 0; k < 1+rng.IntN(4); k++ {
			a := pickWeighted(rng, sellable, artW, artTotal)
			qty := float64(1 + rng.IntN(int(4+12*scale)))
			ht := math.Round(qty*a.Price*(1-0.05*float64(rng.IntN(3)))*100) / 100
			ls = append(ls, demoLine{Ref: a.Ref, Qty: qty, HT: ht})
		}
		if rng.IntN(5) == 0 {
			ls = append(ls, demoLine{}) // comment line: no article, no amount
		}
		return ls
	}

	var docs []demoDoc
	start := time.Date(today.Year()-1, 1, 1, 0, 0, 0, 0, time.UTC)
	for day := start; !day.After(today.AddDate(0, 0, 3)); day = day.AddDate(0, 0, 1) {
		if day.Weekday() == time.Sunday {
			continue
		}
		// Spring and autumn are busier; this year runs about 7 % ahead.
		season := 1 + 0.35*math.Sin(float64(day.YearDay())/365*4*math.Pi-1.2)
		growth := 1.0
		if day.Year() == today.Year() {
			growth = 1.07
		}
		if day.Weekday() == time.Saturday {
			season *= 0.5
		}
		for k := 0; k < int(math.Round(season*growth*(3+rng.Float64()*4))); k++ {
			c := pickWeighted(rng, w.Clients, clientW, clientTotal)
			typ := 7
			if today.Sub(day) < 30*24*time.Hour {
				typ = 6
			}
			docs = append(docs, demoDoc{Domaine: 0, Type: typ, Piece: piece.next("FA"), Date: day, Tiers: c.Num, Lines: lines(season * growth)})
		}
		// Documents that are not revenue and must be ignored.
		if rng.IntN(3) == 0 {
			c := pickWeighted(rng, w.Clients, clientW, clientTotal)
			docs = append(docs, demoDoc{Domaine: 0, Type: 0, Piece: piece.next("DE"), Date: day, Tiers: c.Num, Lines: lines(1)})
			docs = append(docs, demoDoc{Domaine: 0, Type: 3, Piece: piece.next("BL"), Date: day, Tiers: c.Num, Lines: lines(1)})
		}
		// Credit notes and returns reduce revenue.
		if rng.IntN(12) == 0 {
			c := pickWeighted(rng, w.Clients, clientW, clientTotal)
			prov := 1 + rng.IntN(2)
			docs = append(docs, demoDoc{Domaine: 0, Type: 7, Provenance: prov, Piece: piece.next("AV"), Date: day, Tiers: c.Num, Lines: lines(0.3)[:1]})
		}
	}
	return docs
}

func generatePurchases(rng *rand.Rand, w *demoWorld, today time.Time) []demoDoc {
	articles := map[string]demoArticle{}
	for _, a := range w.Articles {
		articles[a.Ref] = a
	}
	catalog := map[string][]demoArticle{} // what each supplier sells us
	for _, as := range w.ArtSuppliers {
		if a := articles[as.Ref]; !a.Sleeping {
			catalog[as.Supplier] = append(catalog[as.Supplier], a)
		}
	}
	// The dormant timber merchant sold us garden goods last spring.
	catalog["F0010"] = catalog["F0006"]

	piece := pieceCounter{}
	lines := func(supplier string, n int) []demoLine {
		arts := catalog[supplier]
		var ls []demoLine
		for k := 0; k < n; k++ {
			a := arts[rng.IntN(len(arts))]
			qty := float64(10 + rng.IntN(41))
			ht := math.Round(qty*a.Cost*(1-0.03*float64(rng.IntN(3)))*100) / 100
			ls = append(ls, demoLine{Ref: a.Ref, Qty: qty, HT: ht})
		}
		return ls
	}
	invoiceType := func(day time.Time) int {
		if today.Sub(day) < 30*24*time.Hour {
			return 16
		}
		return 17
	}

	var docs []demoDoc
	regular := []string{"F0001", "F0002", "F0003", "F0004", "F0005", "F0006", "F0007", "F0008"}
	start := time.Date(today.Year()-1, 1, 1, 0, 0, 0, 0, time.UTC)
	for week := start; !week.After(today); week = week.AddDate(0, 0, 7) {
		for _, sup := range regular {
			if rng.Float64() > 0.8 {
				continue
			}
			day := week.AddDate(0, 0, rng.IntN(5))
			docs = append(docs, demoDoc{Domaine: 1, Type: invoiceType(day), Piece: piece.next("FF"), Date: day, Tiers: sup, Lines: lines(sup, 1+rng.IntN(5))})
			switch rng.IntN(15) {
			case 0: // credit note, stored with positive amounts
				docs = append(docs, demoDoc{Domaine: 1, Type: 17, Provenance: 2, Piece: piece.next("FAV"), Date: day, Tiers: sup, Lines: lines(sup, 1)})
			case 1: // return, stored with negative amounts by the loader
				docs = append(docs, demoDoc{Domaine: 1, Type: 17, Provenance: 1, Piece: piece.next("FRE"), Date: day, Tiers: sup, Lines: lines(sup, 1)})
			case 2: // delivery note: not an invoice, ignored
				docs = append(docs, demoDoc{Domaine: 1, Type: 13, Piece: piece.next("FBL"), Date: day, Tiers: sup, Lines: lines(sup, 2)})
			}
		}
	}
	for k := 0; k < 4; k++ {
		day := start.AddDate(0, 1, 7*k)
		docs = append(docs, demoDoc{Domaine: 1, Type: 17, Piece: piece.next("FF"), Date: day, Tiers: "F0010", Lines: lines("F0010", 2)})
	}

	// Orders awaiting delivery: recent ones, on time or late.
	for _, sup := range regular[:7] {
		for k, n := 0, rng.IntN(3); k < n; k++ {
			day := today.AddDate(0, 0, -rng.IntN(40))
			due := day.AddDate(0, 0, 7+rng.IntN(21))
			ls := lines(sup, 1+rng.IntN(4))
			if k == 1 {
				ls = append(ls, demoLine{}) // comment line
			}
			docs = append(docs, demoDoc{Domaine: 1, Type: 12, Piece: piece.next("FBC"), Date: day, Delivery: due, Tiers: sup, Lines: ls})
		}
	}
	docs = append(docs,
		// Long forgotten, still open.
		demoDoc{Domaine: 1, Type: 12, Piece: piece.next("FBC"), Date: today.AddDate(0, 0, -200), Delivery: today.AddDate(0, 0, -185), Tiers: "F0003", Lines: lines("F0003", 2)},
		// No expected delivery date.
		demoDoc{Domaine: 1, Type: 12, Piece: piece.next("FBC"), Date: today.AddDate(0, 0, -5), Tiers: "F0005", Lines: lines("F0005", 3)},
		// Closed without delivery: no longer awaited.
		demoDoc{Domaine: 1, Type: 12, Piece: piece.next("FBC"), Date: today.AddDate(0, 0, -90), Delivery: today.AddDate(0, 0, -80), Closed: true, Tiers: "F0002", Lines: lines("F0002", 2)},
	)
	return docs
}

// isInvoice mirrors the WHERE clause of the SQL flowLines query.
func (d *demoDoc) isInvoice(kind FlowKind) bool {
	if kind == Purchases {
		return d.Domaine == 1 && (d.Type == 16 || d.Type == 17)
	}
	return d.Domaine == 0 && (d.Type == 6 || d.Type == 7)
}

func (d *demoDoc) sign() float64 {
	if d.Provenance == 1 || d.Provenance == 2 {
		return -1
	}
	return 1
}

type demoSource struct {
	world    *demoWorld
	articles map[string]demoArticle
	tiers    map[string]demoTiers
}

func newDemoSource(now time.Time) *demoSource {
	w := newDemoWorld(now)
	s := &demoSource{world: w, articles: map[string]demoArticle{}, tiers: map[string]demoTiers{}}
	for _, a := range w.Articles {
		s.articles[a.Ref] = a
	}
	for _, t := range append(append([]demoTiers{}, w.Clients...), w.Suppliers...) {
		s.tiers[t.Num] = t
	}
	return s
}

func (s *demoSource) Company() string { return s.world.Company }
func (s *demoSource) Close()          {}

func (s *demoSource) Features() Features {
	return Features{DeliveryDates: true, Contacts: true, ArticleSuppliers: true}
}

func (s *demoSource) tiersName(code string) string {
	if name := s.tiers[code].Name; name != "" {
		return name
	}
	return code
}

// eachLine calls fn for every line of the kind's invoices dated in [from, to),
// with the amount and quantity signed as the SQL query signs them.
func (s *demoSource) eachLine(kind FlowKind, from, to time.Time, fn func(d *demoDoc, l demoLine, ht, qty float64)) {
	for i := range s.world.Docs {
		d := &s.world.Docs[i]
		if !d.isInvoice(kind) || d.Date.Before(from) || !d.Date.Before(to) {
			continue
		}
		for _, l := range d.Lines {
			fn(d, l, d.sign()*math.Abs(l.HT), d.sign()*math.Abs(l.Qty))
		}
	}
}

func (s *demoSource) Flow(_ context.Context, kind FlowKind, w Window) (*FlowRaw, error) {
	days := map[time.Time]float64{}
	tiers := map[string]*Ranked{}
	s.eachLine(kind, w.From, w.To, func(d *demoDoc, l demoLine, ht, _ float64) {
		days[d.Date] += ht
		if d.Date.Before(w.YearStart) {
			return
		}
		t := tiers[d.Tiers]
		if t == nil {
			t = &Ranked{Code: d.Tiers, Name: s.tiersName(d.Tiers)}
			tiers[d.Tiers] = t
		}
		t.HT += ht
	})
	raw := &FlowRaw{}
	for day, ht := range days {
		raw.Days = append(raw.Days, DayTotal{Day: day, HT: ht})
	}
	sort.Slice(raw.Days, func(i, j int) bool { return raw.Days[i].Day.Before(raw.Days[j].Day) })
	raw.TopTiers = top10(tiers)
	if kind == Sales {
		raw.TopArticles = s.topArticles(kind, "", w.YearStart, w.To)
	}
	return raw, nil
}

func (s *demoSource) topArticles(kind FlowKind, tiers string, from, to time.Time) []Ranked {
	articles := map[string]*Ranked{}
	s.eachLine(kind, from, to, func(d *demoDoc, l demoLine, ht, qty float64) {
		if l.Ref == "" || (tiers != "" && d.Tiers != tiers) {
			return
		}
		a := articles[l.Ref]
		if a == nil {
			a = &Ranked{Code: l.Ref, Name: s.articles[l.Ref].Name}
			articles[l.Ref] = a
		}
		a.HT += ht
		a.Qty += qty
	})
	return top10(articles)
}

func (s *demoSource) SupplierArticles(_ context.Context, code string, from, to time.Time) ([]Ranked, error) {
	return s.topArticles(Purchases, code, from, to), nil
}

func top10(m map[string]*Ranked) []Ranked {
	var out []Ranked
	for _, r := range m {
		if r.HT > 0 {
			out = append(out, *r)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].HT > out[j].HT })
	if len(out) > 10 {
		out = out[:10]
	}
	return out
}

func (s *demoSource) Suppliers(_ context.Context, w Window) ([]Supplier, error) {
	bought := map[string]*Supplier{}
	s.eachLine(Purchases, w.From, w.To, func(d *demoDoc, _ demoLine, ht, _ float64) {
		sp := bought[d.Tiers]
		if sp == nil {
			sp = &Supplier{}
			bought[d.Tiers] = sp
		}
		if !d.Date.Before(w.YearStart) {
			sp.Year += ht
		}
		if d.Date.Before(w.LYCut) {
			sp.YearLastYear += ht
		}
		if d.Date.Before(w.YearStart) {
			sp.LastYear += ht
		}
		if day := d.Date.Format("2006-01-02"); day > sp.LastPurchase {
			sp.LastPurchase = day
		}
	})
	var out []Supplier
	for _, t := range append(append([]demoTiers{}, s.world.Clients...), s.world.Suppliers...) {
		b := bought[t.Num]
		if b == nil && (t.Type != 1 || t.Sleeping) {
			continue
		}
		sp := Supplier{Code: t.Num, Name: t.Name, Contact: t.Contact, Phone: t.Phone, Email: t.Email, City: t.City}
		if b != nil {
			sp.Year, sp.YearLastYear, sp.LastYear, sp.LastPurchase = b.Year, b.YearLastYear, b.LastYear, b.LastPurchase
		}
		out = append(out, sp)
	}
	return out, nil
}

func (s *demoSource) PurchaseOrders(_ context.Context) ([]Order, error) {
	var out []Order
	for _, d := range s.world.Docs {
		if d.Domaine != 1 || d.Type != 12 || d.Closed {
			continue
		}
		o := Order{Piece: d.Piece, Supplier: d.Tiers, Name: s.tiersName(d.Tiers), Date: sageDate(d.Date), Delivery: sageDate(d.Delivery)}
		for _, l := range d.Lines {
			o.HT += l.HT
		}
		out = append(out, o)
	}
	return out, nil
}

// mainSupplier mirrors the SQL choice: principal first, then lowest account.
func (s *demoSource) mainSupplier(ref string) string {
	best, bestPrincipal := "", false
	for _, as := range s.world.ArtSuppliers {
		if as.Ref != ref {
			continue
		}
		if best == "" || (as.Principal && !bestPrincipal) || (as.Principal == bestPrincipal && as.Supplier < best) {
			best, bestPrincipal = as.Supplier, as.Principal
		}
	}
	return best
}

func (s *demoSource) Stock(_ context.Context, depot int) ([]Depot, []StockItem, error) {
	famName := map[string]string{}
	for _, f := range s.world.Families {
		famName[f[0]] = f[1]
	}
	newItem := func(a demoArticle) *StockItem {
		it := &StockItem{Ref: a.Ref, Name: a.Name, Family: famName[a.Family], Supplier: s.mainSupplier(a.Ref)}
		if it.Supplier != "" {
			it.SupplierName = s.tiers[it.Supplier].Name
		}
		return it
	}
	items := map[string]*StockItem{}
	for _, a := range s.world.Articles {
		if a.Sleeping || !a.Tracked {
			continue
		}
		if depot == 0 {
			items[a.Ref] = newItem(a)
		}
	}
	for _, st := range s.world.Stock {
		a := s.articles[st.Ref]
		if a.Sleeping || !a.Tracked || (depot != 0 && st.Depot != depot) {
			continue
		}
		it := items[st.Ref]
		if it == nil {
			it = newItem(a)
			items[st.Ref] = it
		}
		it.Qty += st.Qty
		it.Reserved += st.Res
		it.Ordered += st.Com
		it.Min += st.Min
		it.Value += st.Val
	}
	out := make([]StockItem, 0, len(items))
	for _, it := range items {
		out = append(out, *it)
	}
	return s.world.Depots, out, nil
}
