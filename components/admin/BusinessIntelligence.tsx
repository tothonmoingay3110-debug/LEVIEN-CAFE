"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { BusinessIntelligenceData } from "@/types/business-intelligence";

type IntelligenceMode = "kpi" | "customers" | "products" | "campaigns" | "insights";
type ExportCell = string | number;
type ExportTable = { headers: string[]; rows: ExportCell[][] };

const intelligenceLabels: Record<IntelligenceMode, string> = {
  kpi: "KPI Dashboard",
  customers: "Customer Analytics",
  products: "Product & Topping Analytics",
  campaigns: "Promotion & Combo Analytics",
  insights: "AI Business Insights",
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function displayDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function csvCell(value: ExportCell) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function htmlCell(value: ExportCell) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function download(content: BlobPart[], type: string, filename: string) {
  const url = URL.createObjectURL(new Blob(content, { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(table: ExportTable, filename: string) {
  const content = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  download(["\uFEFF", content], "text/csv;charset=utf-8", `${filename}.csv`);
}

function exportExcel(table: ExportTable, filename: string) {
  const head = table.headers.map((value) => `<th>${htmlCell(value)}</th>`).join("");
  const body = table.rows.map((row) => `<tr>${row.map((value) => `<td>${htmlCell(value)}</td>`).join("")}</tr>`).join("");
  const workbook = `<html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  download(["\uFEFF", workbook], "application/vnd.ms-excel;charset=utf-8", `${filename}.xls`);
}

function intelligenceExport(data: BusinessIntelligenceData, mode: IntelligenceMode): ExportTable {
  if (mode === "kpi") return {
    headers: ["Record Type", "Metric / Date", "Value", "Revenue (USD)", "Orders", "Details"],
    rows: [
      ["KPI", "Revenue", data.kpis.revenue, data.kpis.revenue, data.kpis.completedOrders, "Completed-order subtotal after loyalty discount"],
      ["KPI", "Average Order Value", data.kpis.averageOrderValue, data.kpis.averageOrderValue, data.kpis.completedOrders, "Revenue divided by completed orders"],
      ["KPI", "Items Sold", data.kpis.itemsSold, "", data.kpis.completedOrders, "Products and combos"],
      ["KPI", "Best Seller", data.kpis.bestSeller?.quantity || 0, "", "", data.kpis.bestSeller?.name || "No sales"],
      ["KPI", "Low Seller", data.kpis.lowSeller?.quantity || 0, "", "", data.kpis.lowSeller?.name || "No active product"],
      ["KPI", "New Customers", data.kpis.newCustomers, "", "", "First completed purchase in range"],
      ["KPI", "Returning Customers", data.kpis.returningCustomers, "", "", "Purchased before range"],
      ["Forecast", "Next 7 Days", data.forecast.next7DaysRevenue, data.forecast.next7DaysRevenue, data.forecast.expectedOrders, "Recent run-rate estimate"],
      ...data.trend.map((day): ExportCell[] => ["Daily Trend", day.date, "", day.revenue, day.orders, ""]),
    ],
  };
  if (mode === "customers") return {
    headers: ["Customer", "Email", "Phone", "Segment", "Completed Orders", "Spent (USD)", "Average Order (USD)", "Favorite Product", "Favorite Quantity", "Average Frequency (Days)", "First Order", "Last Order"],
    rows: data.customers.map((customer) => [customer.name, customer.email, customer.phone, customer.segment, customer.orders, customer.spent, customer.averageOrder, customer.favoriteProduct, customer.favoriteQuantity, customer.frequencyDays ?? "First visit", customer.firstOrder, customer.lastOrder]),
  };
  if (mode === "products") return {
    headers: ["Record Type", "Name", "Category / Status", "Total Quantity", "Standalone Quantity", "Combo Quantity", "Revenue (USD)", "Order Count", "Active"],
    rows: [
      ...data.products.map((product): ExportCell[] => ["Product", product.name, `${product.category} / ${product.status}`, product.quantity, product.standaloneQuantity, product.comboQuantity, product.standaloneRevenue, product.orderCount, product.active ? "Yes" : "No"]),
      ...data.toppings.map((topping): ExportCell[] => ["Topping", topping.name, "Add-on", topping.quantity, topping.quantity, 0, topping.revenue, topping.orderCount, ""]),
    ],
  };
  if (mode === "campaigns") return {
    headers: ["Record Type", "Name", "Status", "Impressions", "Clicks", "CTR (%)", "Attributed Orders", "Attributed Revenue (USD)", "Units", "Orders", "Revenue (USD)", "Separate Price (USD)", "Offer Price (USD)", "Savings Each (USD)", "Customer Savings (USD)"],
    rows: [
      ...data.promotions.map((promotion): ExportCell[] => ["Promotion", promotion.title, promotion.active ? "Active" : "Hidden", promotion.impressions, promotion.clicks, promotion.clickThroughRate, promotion.attributedOrders, promotion.attributedRevenue, "", "", "", "", "", "", ""]),
      ...data.combos.map((combo): ExportCell[] => ["Combo", combo.name, combo.active ? "Active" : "Archived", "", "", "", "", "", combo.quantity, combo.orderCount, combo.revenue, combo.regularPrice, combo.comboPrice, combo.savingsPerCombo, combo.customerSavings]),
    ],
  };
  return {
    headers: ["Record Type", "Tone", "Title / Metric", "Message / Value", "Evidence", "Recommended Action"],
    rows: [
      ["Forecast", "Info", "Next 7 Days Revenue (USD)", data.forecast.next7DaysRevenue, `Average daily revenue: ${data.forecast.averageDailyRevenue}`, `Expected orders: ${data.forecast.expectedOrders}`],
      ...data.insights.map((insight): ExportCell[] => ["Insight", insight.tone, insight.title, insight.message, insight.evidence, insight.action]),
    ],
  };
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="adminMetric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function DateToolbar({ from, to, today, loading, setFrom, setTo, refresh }: {
  from: string;
  to: string;
  today: string;
  loading: boolean;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  refresh: () => void;
}) {
  const preset = (days: number) => { setFrom(addDays(today, -(days - 1))); setTo(today); };
  return <section className="adminToolbar intelligenceToolbar">
    <div className="reportPresets"><button type="button" onClick={() => preset(7)}>7 days</button><button type="button" onClick={() => preset(30)}>30 days</button><button type="button" onClick={() => preset(90)}>90 days</button></div>
    <div className="reportsDateRange"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label><button className="adminSecondary" type="button" onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
  </section>;
}

function LoadingState({ error, loading, retry }: { error: string; loading: boolean; retry: () => void }) {
  if (error) return <div className="scheduleError"><strong>Analytics unavailable</strong><span>{error}</span><button type="button" onClick={retry}>Try again</button></div>;
  if (loading) return <section className="adminCard intelligenceLoading"><span className="adminEyebrow">Calculating</span><h3>Reading completed orders…</h3><p>LEVIEN is building one consistent data set for this date range.</p></section>;
  return null;
}

function KpiView({ data }: { data: BusinessIntelligenceData }) {
  const maxRevenue = Math.max(1, ...data.trend.map((day) => day.revenue));
  return <>
    <section className="adminMetrics intelligenceMetrics">
      <Metric label="Revenue" value={money(data.kpis.revenue)} detail="Completed order subtotal" />
      <Metric label="Orders" value={String(data.kpis.completedOrders)} detail="Completed in range" />
      <Metric label="Average order" value={money(data.kpis.averageOrderValue)} detail="Revenue ÷ orders" />
      <Metric label="Items sold" value={String(data.kpis.itemsSold)} detail="Products and combos" />
    </section>
    <div className="intelligenceGrid two">
      <section className="adminCard intelligenceChartCard">
        <div className="adminCardHead"><div><span className="adminEyebrow">Sales trend</span><h3>Daily revenue</h3></div><small>{data.range.days} days</small></div>
        <div className="intelligenceChart" aria-label="Daily revenue chart">{data.trend.map((day) => <div key={day.date} title={`${displayDate(day.date)}: ${money(day.revenue)}`}><span><i style={{ height: `${Math.max(day.revenue ? 8 : 2, day.revenue / maxRevenue * 100)}%` }} /></span><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></div>)}</div>
      </section>
      <section className="adminCard intelligenceHighlights">
        <div className="adminCardHead"><div><span className="adminEyebrow">Product pulse</span><h3>Best and low sellers</h3></div></div>
        <div className="intelligenceHighlight positive"><span>Best seller</span><strong>{data.kpis.bestSeller?.name || "No sales yet"}</strong><small>{data.kpis.bestSeller ? `${data.kpis.bestSeller.quantity} units` : "Complete orders to rank products"}</small></div>
        <div className="intelligenceHighlight watch"><span>Low seller</span><strong>{data.kpis.lowSeller?.name || "No active product"}</strong><small>{data.kpis.lowSeller ? `${data.kpis.lowSeller.quantity} units` : "No product to rank"}</small></div>
      </section>
    </div>
    <section className="adminMetrics intelligenceMetrics compact">
      <Metric label="New customers" value={String(data.kpis.newCustomers)} detail="First completed purchase" />
      <Metric label="Returning customers" value={String(data.kpis.returningCustomers)} detail="Purchased before this range" />
      <Metric label="Active promotions" value={String(data.kpis.activePromotions)} detail="Published homepage offers" />
      <Metric label="7-day outlook" value={money(data.forecast.next7DaysRevenue)} detail="Simple recent-run-rate forecast" />
    </section>
  </>;
}

function CustomerView({ data }: { data: BusinessIntelligenceData }) {
  const [query, setQuery] = useState("");
  const customers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return data.customers;
    return data.customers.filter((customer) => `${customer.name} ${customer.email} ${customer.phone} ${customer.segment}`.toLowerCase().includes(term));
  }, [data.customers, query]);
  return <>
    <section className="intelligenceSegments">{data.segments.map((segment) => <div className={`intelligenceSegment segment-${segment.name.toLowerCase()}`} key={segment.name}><span>{segment.name}</span><strong>{segment.customers}</strong><small>{money(segment.revenue)} revenue</small></div>)}</section>
    <section className="adminCard">
      <div className="adminCardHead intelligenceTableHead"><div><span className="adminEyebrow">Customer analytics</span><h3>Purchase behavior</h3><p>Frequency, spend, favorite products and practical customer segments.</p></div><input className="adminSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers…" /></div>
      <div className="adminTableWrap"><table className="adminTable intelligenceTable"><thead><tr><th>Customer</th><th>Segment</th><th>Orders</th><th>Spent</th><th>Average</th><th>Favorite</th><th>Frequency</th><th>Last order</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><strong>{customer.name}</strong><small>{customer.email || customer.phone}</small></td><td><span className={`intelligencePill segment-${customer.segment.toLowerCase()}`}>{customer.segment}</span></td><td><strong>{customer.orders}</strong></td><td><strong>{money(customer.spent)}</strong></td><td>{money(customer.averageOrder)}</td><td><strong>{customer.favoriteProduct}</strong><small>{customer.favoriteQuantity ? `${customer.favoriteQuantity} ordered` : "No items"}</small></td><td>{customer.frequencyDays === null ? "First visit" : `${customer.frequencyDays} days`}</td><td>{displayDate(customer.lastOrder)}</td></tr>)}{!customers.length ? <tr><td colSpan={8}><div className="workforceEmpty"><strong>No matching customers</strong><span>Try another search or date range.</span></div></td></tr> : null}</tbody></table></div>
    </section>
  </>;
}

function ProductView({ data }: { data: BusinessIntelligenceData }) {
  const best = data.products.filter((product) => product.status === "Best seller").slice(0, 3);
  const slow = data.products.filter((product) => product.status === "Slow mover").slice(0, 3);
  return <>
    <div className="intelligenceGrid two">
      <section className="adminCard intelligenceRankCard"><span className="adminEyebrow">Best sellers</span><h3>Products customers choose most</h3>{best.map((product, index) => <div className="intelligenceRank" key={product.id}><b>{index + 1}</b><span><strong>{product.name}</strong><small>{product.category}</small></span><em>{product.quantity} units</em></div>)}{!best.length ? <p>No product sales in this range.</p> : null}</section>
      <section className="adminCard intelligenceRankCard"><span className="adminEyebrow">Slow movers</span><h3>Products to review</h3>{slow.map((product, index) => <div className="intelligenceRank slow" key={product.id}><b>{index + 1}</b><span><strong>{product.name}</strong><small>{product.category}</small></span><em>{product.quantity} units</em></div>)}{!slow.length ? <p>No active products to rank.</p> : null}</section>
    </div>
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Product analytics</span><h3>Quantity and standalone revenue</h3><p>Combo inclusions count toward product demand; standalone revenue is kept separate to avoid fake allocation.</p></div></div>
      <div className="adminTableWrap"><table className="adminTable intelligenceTable"><thead><tr><th>Product</th><th>Status</th><th>Total units</th><th>Standalone</th><th>In combos</th><th>Orders</th><th>Standalone revenue</th></tr></thead><tbody>{data.products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small>{product.category}{product.active ? "" : " · Archived"}</small></td><td><span className={`intelligencePill product-${product.status.toLowerCase().replace(" ", "-")}`}>{product.status}</span></td><td><strong>{product.quantity}</strong></td><td>{product.standaloneQuantity}</td><td>{product.comboQuantity}</td><td>{product.orderCount}</td><td><strong>{money(product.standaloneRevenue)}</strong></td></tr>)}</tbody></table></div>
    </section>
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Topping performance</span><h3>Add-ons customers choose</h3></div></div>
      <div className="intelligenceToppings">{data.toppings.map((topping) => <div key={topping.name}><span>{topping.name}</span><strong>{topping.quantity}</strong><small>{money(topping.revenue)} · {topping.orderCount} orders</small></div>)}{!data.toppings.length ? <p>No topping sales in this range.</p> : null}</div>
    </section>
  </>;
}

function CampaignView({ data }: { data: BusinessIntelligenceData }) {
  return <>
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Promotion analytics</span><h3>From homepage view to completed order</h3><p>Attribution is informational and does not change menu prices.</p></div></div>
      <div className="adminTableWrap"><table className="adminTable intelligenceTable"><thead><tr><th>Promotion</th><th>Status</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Completed orders</th><th>Attributed revenue</th></tr></thead><tbody>{data.promotions.map((promotion) => <tr key={promotion.id}><td><strong>{promotion.title}</strong></td><td><span className={`intelligencePill ${promotion.active ? "positive" : "muted"}`}>{promotion.active ? "Active" : "Hidden"}</span></td><td>{promotion.impressions}</td><td>{promotion.clicks}</td><td><strong>{promotion.clickThroughRate.toFixed(1)}%</strong></td><td>{promotion.attributedOrders}</td><td><strong>{money(promotion.attributedRevenue)}</strong></td></tr>)}{!data.promotions.length ? <tr><td colSpan={7}>No promotions found.</td></tr> : null}</tbody></table></div>
    </section>
    <section className="adminCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Combo analytics</span><h3>Sales and customer value</h3><p>True profitability is intentionally not shown until product cost data exists.</p></div></div>
      <div className="adminTableWrap"><table className="adminTable intelligenceTable"><thead><tr><th>Combo</th><th>Units</th><th>Orders</th><th>Revenue</th><th>Separate price</th><th>Combo price</th><th>Customer savings</th></tr></thead><tbody>{data.combos.map((combo) => <tr key={combo.id}><td><strong>{combo.name}</strong><small>{combo.active ? "Active" : "Archived"}</small></td><td><strong>{combo.quantity}</strong></td><td>{combo.orderCount}</td><td><strong>{money(combo.revenue)}</strong></td><td>{money(combo.regularPrice)}</td><td>{money(combo.comboPrice)}</td><td><strong>{money(combo.customerSavings)}</strong><small>{money(combo.savingsPerCombo)} each</small></td></tr>)}{!data.combos.length ? <tr><td colSpan={7}>No combos found.</td></tr> : null}</tbody></table></div>
    </section>
  </>;
}

function InsightsView({ data }: { data: BusinessIntelligenceData }) {
  return <>
    <section className="adminWelcome intelligenceWelcome">
      <div><span>Explainable business insights</span><h2>Recommendations grounded in LEVIEN sales data.</h2><p>No customer data leaves the project and no paid AI service is required. Every card shows its evidence.</p></div>
      <div className="intelligenceForecast"><span>Next 7 days</span><strong>{money(data.forecast.next7DaysRevenue)}</strong><small>About {data.forecast.expectedOrders} orders at the recent run rate</small></div>
    </section>
    <section className="intelligenceInsights">{data.insights.map((insight) => <article className={`adminCard intelligenceInsight tone-${insight.tone}`} key={insight.id}><span className="intelligenceInsightTone">{insight.tone}</span><h3>{insight.title}</h3><p>{insight.message}</p><div><span>Evidence</span><strong>{insight.evidence}</strong></div><footer><span>Recommended action</span><strong>{insight.action}</strong></footer></article>)}</section>
    <section className="adminCard intelligenceMethod"><span className="adminEyebrow">How it works</span><h3>Simple, auditable rules</h3><p>Insights compare date-range trends, product demand, promotion engagement and customer behavior. The forecast is the selected range's average daily revenue multiplied by seven; it is guidance, not a guarantee.</p></section>
  </>;
}

function BusinessIntelligence({ mode }: { mode: IntelligenceMode }) {
  const today = dateKey(new Date());
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [data, setData] = useState<BusinessIntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/business-intelligence?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const result = await response.json() as BusinessIntelligenceData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load analytics.");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void refresh(); }, [refresh]);

  const exportTable = useMemo(() => data ? intelligenceExport(data, mode) : null, [data, mode]);
  const exportFilename = `levien-${mode}-${from}-to-${to}`;

  return <div className="adminStack businessIntelligence">
    <DateToolbar from={from} to={to} today={today} loading={loading} setFrom={setFrom} setTo={setTo} refresh={() => void refresh()} />
    <section className="adminCard intelligenceExportBar"><div><span className="adminEyebrow">Export report</span><strong>{intelligenceLabels[mode]}</strong><small>{displayDate(from)} – {displayDate(to)} · all rows in the selected range</small></div><div className="reportExportActions"><button className="adminSecondary" type="button" disabled={!exportTable || loading} onClick={() => exportTable && exportCsv(exportTable, exportFilename)}>Export CSV</button><button className="adminPrimary" type="button" disabled={!exportTable || loading} onClick={() => exportTable && exportExcel(exportTable, exportFilename)}>Export Excel</button></div></section>
    <LoadingState error={error} loading={loading} retry={() => void refresh()} />
    {data && !error ? mode === "kpi" ? <KpiView data={data} /> : mode === "customers" ? <CustomerView data={data} /> : mode === "products" ? <ProductView data={data} /> : mode === "campaigns" ? <CampaignView data={data} /> : <InsightsView data={data} /> : null}
  </div>;
}

export function KpiDashboard() { return <BusinessIntelligence mode="kpi" />; }
export function CustomerAnalytics() { return <BusinessIntelligence mode="customers" />; }
export function ProductAnalytics() { return <BusinessIntelligence mode="products" />; }
export function CampaignAnalytics() { return <BusinessIntelligence mode="campaigns" />; }
export function AiBusinessInsights() { return <BusinessIntelligence mode="insights" />; }
