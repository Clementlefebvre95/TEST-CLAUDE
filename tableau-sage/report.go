package main

import (
	"context"
	"sort"
	"time"
)

// Source is where the numbers come from: the Sage database, or demo data.
type Source interface {
	Company() string
	Features() Features
	// Flow returns sales or purchase invoice totals per day over [From, To),
	// with the top tiers (and, for sales, articles) since YearStart.
	Flow(ctx context.Context, kind FlowKind, w Window) (*FlowRaw, error)
	// Stock returns stock-tracked, active articles; depot 0 means all depots.
	Stock(ctx context.Context, depot int) ([]Depot, []StockItem, error)
	// Suppliers returns the active suppliers and anyone bought from in the window.
	Suppliers(ctx context.Context, w Window) ([]Supplier, error)
	// PurchaseOrders returns the supplier orders not yet received.
	PurchaseOrders(ctx context.Context) ([]Order, error)
	// SupplierArticles returns what was bought most from one supplier over [from, to).
	SupplierArticles(ctx context.Context, code string, from, to time.Time) ([]Ranked, error)
	Close()
}

type FlowKind int

const (
	Sales FlowKind = iota
	Purchases
)

// Features says which optional Sage data this database has, so the page can
// leave out what it cannot show.
type Features struct {
	DeliveryDates    bool `json:"deliveryDates"`
	Contacts         bool `json:"contacts"`
	ArticleSuppliers bool `json:"articleSuppliers"`
}

// Window holds the dates a report for "today" needs. All are UTC midnights.
type Window struct {
	Today     time.Time
	From      time.Time // 1 January last year
	YearStart time.Time // 1 January this year
	LYCut     time.Time // the day after today's date last year
	To        time.Time // tomorrow, the exclusive end
}

func window(now time.Time) Window {
	today := dateOf(now)
	return Window{
		Today:     today,
		From:      time.Date(today.Year()-1, 1, 1, 0, 0, 0, 0, time.UTC),
		YearStart: time.Date(today.Year(), 1, 1, 0, 0, 0, 0, time.UTC),
		LYCut:     today.AddDate(-1, 0, 0).AddDate(0, 0, 1),
		To:        today.AddDate(0, 0, 1),
	}
}

type DayTotal struct {
	Day time.Time
	HT  float64
}

type Ranked struct {
	Code string  `json:"code"`
	Name string  `json:"name"`
	Qty  float64 `json:"qty"`
	HT   float64 `json:"ht"`
}

type FlowRaw struct {
	Days        []DayTotal
	TopTiers    []Ranked
	TopArticles []Ranked
}

type FlowReport struct {
	Today       string     `json:"today"`
	Year        int        `json:"year"`
	KPI         FlowKPI    `json:"kpi"`
	Current     []*float64 `json:"current"`  // 12 months of this year, null after the current month
	Previous    []float64  `json:"previous"` // 12 months of last year
	TopTiers    []Ranked   `json:"topTiers"`
	TopArticles []Ranked   `json:"topArticles"`
}

type FlowKPI struct {
	Today         float64 `json:"today"`
	Month         float64 `json:"month"`
	MonthLastYear float64 `json:"monthLastYear"`
	Year          float64 `json:"year"`
	YearLastYear  float64 `json:"yearLastYear"`
	LastYearTotal float64 `json:"lastYearTotal"`
}

type Depot struct {
	No   int    `json:"no"`
	Name string `json:"name"`
}

type StockItem struct {
	Ref          string  `json:"ref"`
	Name         string  `json:"name"`
	Family       string  `json:"family"`
	Supplier     string  `json:"supplier,omitempty"` // main supplier's account
	SupplierName string  `json:"supplierName,omitempty"`
	Qty          float64 `json:"qty"`
	Reserved     float64 `json:"reserved"`
	Ordered      float64 `json:"ordered"`
	Min          float64 `json:"min"`
	Value        float64 `json:"value"`
}

type StockReport struct {
	Depots []Depot     `json:"depots"`
	Depot  int         `json:"depot"`
	Totals StockTotals `json:"totals"`
	Items  []StockItem `json:"items"`
}

type StockTotals struct {
	Value    float64 `json:"value"`
	Articles int     `json:"articles"`
	Out      int     `json:"out"`
	Low      int     `json:"low"`
}

type Supplier struct {
	Code         string  `json:"code"`
	Name         string  `json:"name"`
	Contact      string  `json:"contact,omitempty"`
	Phone        string  `json:"phone,omitempty"`
	Email        string  `json:"email,omitempty"`
	City         string  `json:"city,omitempty"`
	Year         float64 `json:"year"`         // bought since 1 January
	YearLastYear float64 `json:"yearLastYear"` // same period last year
	LastYear     float64 `json:"lastYear"`     // all of last year
	LastPurchase string  `json:"lastPurchase,omitempty"`
}

type Order struct {
	Piece    string  `json:"piece"`
	Supplier string  `json:"supplier"`
	Name     string  `json:"name"`
	Date     string  `json:"date"`
	Delivery string  `json:"delivery,omitempty"` // expected delivery, when Sage has one
	HT       float64 `json:"ht"`
	Late     bool    `json:"late"`
}

type PurchasesReport struct {
	Flow        *FlowReport `json:"flow"`
	Orders      []Order     `json:"orders"`
	OrdersTotal float64     `json:"ordersTotal"`
	OrdersLate  int         `json:"ordersLate"`
	Suppliers   []Supplier  `json:"suppliers"`
	Features    Features    `json:"features"`
}

func dateOf(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// sageDate formats a date for the page. Sage stores "no date" as 1900-01-01
// (or older), which becomes an empty string.
func sageDate(t time.Time) string {
	if t.Year() < 1990 {
		return ""
	}
	return t.Format("2006-01-02")
}

func buildFlow(now time.Time, raw *FlowRaw) *FlowReport {
	w := window(now)
	today := w.Today
	year := today.Year()
	monthStart := time.Date(year, today.Month(), 1, 0, 0, 0, 0, time.UTC)
	todayLY := today.AddDate(-1, 0, 0)

	between := func(d, lo, hi time.Time) bool { return !d.Before(lo) && !d.After(hi) }

	r := &FlowReport{
		Today:       today.Format("2006-01-02"),
		Year:        year,
		Current:     make([]*float64, 12),
		Previous:    make([]float64, 12),
		TopTiers:    nonNil(raw.TopTiers),
		TopArticles: nonNil(raw.TopArticles),
	}
	current := make([]float64, 12)
	for _, d := range raw.Days {
		day := dateOf(d.Day)
		switch {
		case day.After(today):
			continue
		case day.Year() == year:
			current[day.Month()-1] += d.HT
			r.KPI.Year += d.HT
			if !day.Before(monthStart) {
				r.KPI.Month += d.HT
			}
			if day.Equal(today) {
				r.KPI.Today += d.HT
			}
		case day.Year() == year-1:
			r.Previous[day.Month()-1] += d.HT
			r.KPI.LastYearTotal += d.HT
			if between(day, w.From, todayLY) {
				r.KPI.YearLastYear += d.HT
			}
			if between(day, monthStart.AddDate(-1, 0, 0), todayLY) {
				r.KPI.MonthLastYear += d.HT
			}
		}
	}
	for m := 0; m < int(today.Month()); m++ {
		v := current[m]
		r.Current[m] = &v
	}
	return r
}

func buildStock(depots []Depot, depot int, items []StockItem) *StockReport {
	r := &StockReport{Depots: depots, Depot: depot, Items: nonNil(items)}
	sort.Slice(r.Items, func(i, j int) bool { return r.Items[i].Ref < r.Items[j].Ref })
	for _, it := range r.Items {
		r.Totals.Articles++
		r.Totals.Value += it.Value
		switch {
		case it.Qty <= 0:
			r.Totals.Out++
		case it.Min > 0 && it.Qty < it.Min:
			r.Totals.Low++
		}
	}
	if r.Depots == nil {
		r.Depots = []Depot{}
	}
	return r
}

// buildPurchases marks late orders and puts what needs attention first: late
// orders by how long they have waited, then the others by expected date.
func buildPurchases(now time.Time, flow *FlowRaw, orders []Order, suppliers []Supplier, f Features) *PurchasesReport {
	today := dateOf(now).Format("2006-01-02")
	r := &PurchasesReport{
		Flow:      buildFlow(now, flow),
		Orders:    nonNil(orders),
		Suppliers: nonNil(suppliers),
		Features:  f,
	}
	for i := range r.Orders {
		o := &r.Orders[i]
		o.Late = o.Delivery != "" && o.Delivery < today
		r.OrdersTotal += o.HT
		if o.Late {
			r.OrdersLate++
		}
	}
	due := func(o Order) string {
		if o.Delivery != "" {
			return o.Delivery
		}
		return "9999" + o.Date // no expected date: after every dated order
	}
	sort.Slice(r.Orders, func(i, j int) bool {
		a, b := r.Orders[i], r.Orders[j]
		if a.Late != b.Late {
			return a.Late
		}
		if due(a) != due(b) {
			return due(a) < due(b)
		}
		return a.Piece < b.Piece
	})
	sort.Slice(r.Suppliers, func(i, j int) bool {
		a, b := r.Suppliers[i], r.Suppliers[j]
		if a.Year != b.Year {
			return a.Year > b.Year
		}
		if a.LastYear != b.LastYear {
			return a.LastYear > b.LastYear
		}
		return a.Code < b.Code
	})
	return r
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
