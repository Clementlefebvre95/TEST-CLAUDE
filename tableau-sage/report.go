package main

import (
	"context"
	"sort"
	"time"
)

// Source is where the numbers come from: the Sage database, or demo data.
type Source interface {
	Company() string
	// Sales returns sales-invoice totals per day over [from, to) and the top
	// clients and articles over [topFrom, to).
	Sales(ctx context.Context, from, topFrom, to time.Time) (*SalesRaw, error)
	// Stock returns stock-tracked, active articles; depot 0 means all depots.
	Stock(ctx context.Context, depot int) ([]Depot, []StockItem, error)
	Close()
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

type SalesRaw struct {
	Days        []DayTotal
	TopClients  []Ranked
	TopArticles []Ranked
}

type SalesReport struct {
	Today       string     `json:"today"`
	Year        int        `json:"year"`
	KPI         SalesKPI   `json:"kpi"`
	Current     []*float64 `json:"current"`  // 12 months of this year, null after the current month
	Previous    []float64  `json:"previous"` // 12 months of last year
	TopClients  []Ranked   `json:"topClients"`
	TopArticles []Ranked   `json:"topArticles"`
}

type SalesKPI struct {
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
	Ref      string  `json:"ref"`
	Name     string  `json:"name"`
	Family   string  `json:"family"`
	Qty      float64 `json:"qty"`
	Reserved float64 `json:"reserved"`
	Ordered  float64 `json:"ordered"`
	Min      float64 `json:"min"`
	Value    float64 `json:"value"`
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

func dateOf(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// salesWindow gives the date ranges a report for "now" needs.
func salesWindow(now time.Time) (from, topFrom, to time.Time) {
	today := dateOf(now)
	from = time.Date(today.Year()-1, 1, 1, 0, 0, 0, 0, time.UTC)
	topFrom = time.Date(today.Year(), 1, 1, 0, 0, 0, 0, time.UTC)
	return from, topFrom, today.AddDate(0, 0, 1)
}

func buildSales(now time.Time, raw *SalesRaw) *SalesReport {
	today := dateOf(now)
	year := today.Year()
	monthStart := time.Date(year, today.Month(), 1, 0, 0, 0, 0, time.UTC)
	yearStart := time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC)
	todayLY := today.AddDate(-1, 0, 0)

	between := func(d, lo, hi time.Time) bool { return !d.Before(lo) && !d.After(hi) }

	r := &SalesReport{
		Today:       today.Format("2006-01-02"),
		Year:        year,
		Current:     make([]*float64, 12),
		Previous:    make([]float64, 12),
		TopClients:  nonNil(raw.TopClients),
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
			if between(day, yearStart.AddDate(-1, 0, 0), todayLY) {
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

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}
