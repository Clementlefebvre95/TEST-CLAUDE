package main

import (
	"context"
	"fmt"
	"math"
	"math/rand/v2"
	"sort"
	"time"
)

// The demo world is shaped like a Sage 100 database: documents with a domain,
// type and provenance, lines, articles, per-depot stock. The demo source
// aggregates it in Go with the same rules the SQL queries apply, and the test
// loads it into SQL Server to check both agree.

type demoClient struct{ Num, Name string }

type demoArticle struct {
	Ref, Name, Family string
	Price, Cost       float64
	Tracked, Sleeping bool
	weight            float64
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
	Client                    string
	Lines                     []demoLine
}

type demoWorld struct {
	Company  string
	Clients  []demoClient
	Families [][2]string // code, name
	Articles []demoArticle
	Depots   []Depot
	Stock    []demoStock
	Docs     []demoDoc
}

var demoFamilies = [][2]string{
	{"OUTIL", "Outillage"}, {"VISS", "Visserie"}, {"PEINT", "Peinture"},
	{"ELEC", "Électricité"}, {"PLOMB", "Plomberie"}, {"JARD", "Jardin"},
}

var demoCatalog = map[string][]string{
	"OUTIL": {"Perceuse visseuse 18V", "Marteau menuisier 500 g", "Scie égoïne 550 mm", "Niveau à bulle 60 cm", "Jeu de tournevis 8 pièces", "Mètre ruban 5 m", "Pince multiprise", "Clé à molette 250 mm", "Meuleuse 125 mm", "Coffret de forets 19 pièces"},
	"VISS":  {"Vis bois 4x40 (boîte de 200)", "Vis bois 5x60 (boîte de 100)", "Chevilles nylon 8 mm (x100)", "Boulons M8 (x50)", "Rondelles M10 (x100)", "Clous tête plate 70 mm (1 kg)", "Tire-fond 8x80 (x25)", "Vis placo 3,5x35 (x500)"},
	"PEINT": {"Peinture murale blanche 10 L", "Sous-couche 5 L", "Lasure chêne 2,5 L", "Rouleau 180 mm", "Pinceau plat 50 mm", "Bâche de protection 4x5 m", "Enduit de rebouchage 1 kg", "Ruban de masquage 50 m"},
	"ELEC":  {"Câble R2V 3G2,5 (50 m)", "Interrupteur va-et-vient", "Prise 2P+T", "Disjoncteur 16 A", "Ampoule LED E27 9W", "Gaine ICTA 20 mm (100 m)", "Boîte d'encastrement", "Rallonge 10 m"},
	"PLOMB": {"Tube multicouche 16 mm (50 m)", "Raccord à sertir 16 mm", "Robinet d'arrêt 1/2", "Siphon lavabo", "Mitigeur évier", "Flexible inox 50 cm", "Colle PVC 250 ml", "Téflon (rouleau)"},
	"JARD":  {"Tuyau d'arrosage 25 m", "Sécateur", "Terreau universel 50 L", "Brouette 100 L", "Râteau 14 dents", "Gants de jardin", "Engrais gazon 5 kg", "Pulvérisateur 5 L"},
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

func newDemoWorld(now time.Time) *demoWorld {
	rng := rand.New(rand.NewPCG(2026, 95))
	w := &demoWorld{
		Company:  "Quincaillerie Démo",
		Families: demoFamilies,
		Depots:   []Depot{{1, "Dépôt principal"}, {2, "Magasin"}},
	}

	for i, name := range demoClientNames {
		w.Clients = append(w.Clients, demoClient{Num: fmt.Sprintf("C%04d", i+1), Name: name})
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
				Tracked:  n%17 != 0, // a few services/untracked items
				Sleeping: n%23 == 0,
				weight:   0.3 + rng.ExpFloat64(),
			}
			w.Articles = append(w.Articles, a)
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

	w.Docs = generateDocs(rng, w, dateOf(now))
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

func generateDocs(rng *rand.Rand, w *demoWorld, today time.Time) []demoDoc {
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

	counters := map[string]int{}
	piece := func(prefix string) string {
		counters[prefix]++
		return fmt.Sprintf("%s%05d", prefix, counters[prefix])
	}
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
			docs = append(docs, demoDoc{Domaine: 0, Type: typ, Piece: piece("FA"), Date: day, Client: c.Num, Lines: lines(season * growth)})
		}
		// Documents that are not revenue and must be ignored.
		if rng.IntN(3) == 0 {
			c := pickWeighted(rng, w.Clients, clientW, clientTotal)
			docs = append(docs, demoDoc{Domaine: 0, Type: 0, Piece: piece("DE"), Date: day, Client: c.Num, Lines: lines(1)})
			docs = append(docs, demoDoc{Domaine: 0, Type: 3, Piece: piece("BL"), Date: day, Client: c.Num, Lines: lines(1)})
			docs = append(docs, demoDoc{Domaine: 1, Type: 17, Piece: piece("FF"), Date: day, Client: "F0001", Lines: lines(2)})
		}
		// Credit notes and returns reduce revenue.
		if rng.IntN(12) == 0 {
			c := pickWeighted(rng, w.Clients, clientW, clientTotal)
			prov := 1 + rng.IntN(2)
			docs = append(docs, demoDoc{Domaine: 0, Type: 7, Provenance: prov, Piece: piece("AV"), Date: day, Client: c.Num, Lines: lines(0.3)[:1]})
		}
	}
	return docs
}

// isRevenue mirrors the WHERE clause and sign rule of the SQL salesLines query.
func (d *demoDoc) isRevenue() bool { return d.Domaine == 0 && (d.Type == 6 || d.Type == 7) }

func (d *demoDoc) sign() float64 {
	if d.Provenance == 1 || d.Provenance == 2 {
		return -1
	}
	return 1
}

type demoSource struct {
	world    *demoWorld
	articles map[string]demoArticle
	clients  map[string]string
}

func newDemoSource(now time.Time) *demoSource {
	w := newDemoWorld(now)
	s := &demoSource{world: w, articles: map[string]demoArticle{}, clients: map[string]string{}}
	for _, a := range w.Articles {
		s.articles[a.Ref] = a
	}
	for _, c := range w.Clients {
		s.clients[c.Num] = c.Name
	}
	return s
}

func (s *demoSource) Company() string { return s.world.Company }
func (s *demoSource) Close()          {}

func (s *demoSource) Sales(_ context.Context, from, topFrom, to time.Time) (*SalesRaw, error) {
	days := map[time.Time]float64{}
	clients := map[string]*Ranked{}
	articles := map[string]*Ranked{}
	for i := range s.world.Docs {
		d := &s.world.Docs[i]
		if !d.isRevenue() || d.Date.Before(from) || !d.Date.Before(to) {
			continue
		}
		for _, l := range d.Lines {
			ht := d.sign() * math.Abs(l.HT)
			days[d.Date] += ht
			if d.Date.Before(topFrom) {
				continue
			}
			c := clients[d.Client]
			if c == nil {
				c = &Ranked{Code: d.Client, Name: s.clients[d.Client]}
				clients[d.Client] = c
			}
			c.HT += ht
			if l.Ref != "" {
				a := articles[l.Ref]
				if a == nil {
					a = &Ranked{Code: l.Ref, Name: s.articles[l.Ref].Name}
					articles[l.Ref] = a
				}
				a.HT += ht
				a.Qty += d.sign() * math.Abs(l.Qty)
			}
		}
	}
	raw := &SalesRaw{}
	for day, ht := range days {
		raw.Days = append(raw.Days, DayTotal{Day: day, HT: ht})
	}
	sort.Slice(raw.Days, func(i, j int) bool { return raw.Days[i].Day.Before(raw.Days[j].Day) })
	raw.TopClients = top10(clients)
	raw.TopArticles = top10(articles)
	return raw, nil
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

func (s *demoSource) Stock(_ context.Context, depot int) ([]Depot, []StockItem, error) {
	famName := map[string]string{}
	for _, f := range s.world.Families {
		famName[f[0]] = f[1]
	}
	items := map[string]*StockItem{}
	for _, a := range s.world.Articles {
		if a.Sleeping || !a.Tracked {
			continue
		}
		if depot == 0 {
			items[a.Ref] = &StockItem{Ref: a.Ref, Name: a.Name, Family: famName[a.Family]}
		}
	}
	for _, st := range s.world.Stock {
		a := s.articles[st.Ref]
		if a.Sleeping || !a.Tracked || (depot != 0 && st.Depot != depot) {
			continue
		}
		it := items[st.Ref]
		if it == nil {
			it = &StockItem{Ref: a.Ref, Name: a.Name, Family: famName[a.Family]}
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
