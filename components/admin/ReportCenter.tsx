"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ReportTab = "sales" | "orders" | "customers" | "products" | "promotions" | "combos";
type ReportData = {
  from: string;
  to: string;
  summary: { sales: number; orders: number; customers: number; itemsSold: number };
  sales: { date: string; orders: number; sales: number }[];
  orders: { orderNumber: string; date: string; customer: string; type: string; status: string; total: number }[];
  customers: { id: string; name: string; phone: string; email: string; orders: number; spent: number; lastOrder: string }[];
  products: { id: string; name: string; quantity: number; comboQuantity: number; sales: number; orderCount: number }[];
  promotions: { id: string; title: string; eyebrow: string; position: number; active: boolean }[];
  combos: { id: string; name: string; quantity: number; sales: number; orderCount: number }[];
};

type ReportRow = Array<string | number>;

const tabs: { id: ReportTab; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "orders", label: "Orders" },
  { id: "customers", label: "Customers" },
  { id: "products", label: "Products" },
  { id: "promotions", label: "Promotions" },
  { id: "combos", label: "Combos" },
];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function displayDate(value: string) {
  return new Date(value.includes("T") ? value : `${value}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function htmlCell(value: string | number) {
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

function exportCsv(headers: string[], rows: ReportRow[], filename: string) {
  const content = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  download(["\uFEFF", content], "text/csv;charset=utf-8", `${filename}.csv`);
}

function exportExcel(headers: string[], rows: ReportRow[], filename: string) {
  const head = headers.map((value) => `<th>${htmlCell(value)}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((value) => `<td>${htmlCell(value)}</td>`).join("")}</tr>`).join("");
  const workbook = `<html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  download(["\uFEFF", workbook], "application/vnd.ms-excel;charset=utf-8", `${filename}.xls`);
}

function reportTable(data: ReportData, tab: ReportTab): { headers: string[]; rows: ReportRow[] } {
  if (tab === "sales") return {
    headers: ["Date", "Completed Orders", "Sales"],
    rows: data.sales.map((row) => [displayDate(row.date), row.orders, money(row.sales)]),
  };
  if (tab === "orders") return {
    headers: ["Order", "Date", "Customer", "Type", "Status", "Sales"],
    rows: data.orders.map((row) => [row.orderNumber, displayDate(row.date), row.customer, row.type, row.status, money(row.total)]),
  };
  if (tab === "customers") return {
    headers: ["Customer", "Phone", "Email", "Completed Orders", "Spent", "Last Order"],
    rows: data.customers.map((row) => [row.name, row.phone, row.email || "—", row.orders, money(row.spent), displayDate(row.lastOrder)]),
  };
  if (tab === "products") return {
    headers: ["Product", "Quantity Sold", "Included in Combos", "Orders", "Standalone Sales"],
    rows: data.products.map((row) => [row.name, row.quantity, row.comboQuantity, row.orderCount, money(row.sales)]),
  };
  if (tab === "promotions") return {
    headers: ["Promotion", "Label", "Slide", "Status"],
    rows: data.promotions.map((row) => [row.title, row.eyebrow, row.position, row.active ? "Active" : "Hidden"]),
  };
  return {
    headers: ["Combo", "Quantity Sold", "Orders", "Sales"],
    rows: data.combos.map((row) => [row.name, row.quantity, row.orderCount, money(row.sales)]),
  };
}

export default function ReportCenter() {
  const today = dateKey(new Date());
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [tab, setTab] = useState<ReportTab>("sales");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/report-center?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const result = await response.json() as ReportData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load reports.");
      setData(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void refresh(); }, [refresh]);

  const table = useMemo(() => data ? reportTable(data, tab) : { headers: [], rows: [] }, [data, tab]);
  const maxSales = Math.max(1, ...(data?.sales.map((day) => day.sales) || [0]));
  const filename = `levien-${tab}-report-${from}-to-${to}`;

  function preset(days: number) {
    setFrom(addDays(today, -(days - 1)));
    setTo(today);
  }

  function thisMonth() {
    const date = new Date();
    setFrom(dateKey(new Date(date.getFullYear(), date.getMonth(), 1)));
    setTo(today);
  }

  return <div className="adminStack reportCenter">
    <section className="adminWelcome reportCenterWelcome">
      <div><span>V3 Report Center</span><h2>Simple reports for daily business decisions.</h2><p>Choose a date range, open a report, then export the same rows to CSV or Excel.</p></div>
      <div className="reportExportActions"><button className="adminSecondary" type="button" disabled={!data || !table.rows.length} onClick={() => exportCsv(table.headers, table.rows, filename)}>Export CSV</button><button className="adminPrimary" type="button" disabled={!data || !table.rows.length} onClick={() => exportExcel(table.headers, table.rows, filename)}>Export Excel</button></div>
    </section>

    <section className="adminMetrics reportCenterMetrics">
      <div className="adminMetric"><span>Sales</span><strong>{money(data?.summary.sales || 0)}</strong><small>Completed order subtotal</small></div>
      <div className="adminMetric"><span>Orders</span><strong>{data?.summary.orders || 0}</strong><small>Completed in range</small></div>
      <div className="adminMetric"><span>Customers</span><strong>{data?.summary.customers || 0}</strong><small>Unique customers</small></div>
      <div className="adminMetric"><span>Items sold</span><strong>{data?.summary.itemsSold || 0}</strong><small>Products and combos</small></div>
    </section>

    <section className="adminToolbar reportCenterToolbar">
      <div className="reportPresets"><button type="button" onClick={() => preset(1)}>Today</button><button type="button" onClick={() => preset(7)}>7 days</button><button type="button" onClick={() => preset(30)}>30 days</button><button type="button" onClick={thisMonth}>This month</button></div>
      <div className="reportsDateRange"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label><button className="adminSecondary" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
    </section>

    {error ? <div className="scheduleError"><strong>Reports unavailable</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div> : null}

    <section className="adminCard reportCenterCard">
      <div className="reportTabs" role="tablist" aria-label="Business reports">{tabs.map((item) => <button type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} key={item.id}>{item.label}</button>)}</div>

      {tab === "sales" && data ? <div className="salesMiniChart" aria-label="Daily sales chart">{data.sales.map((day) => <div key={day.date} title={`${displayDate(day.date)}: ${money(day.sales)}`}><span><i style={{ height: `${Math.max(day.sales ? 8 : 2, day.sales / maxSales * 100)}%` }} /></span><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></div>)}</div> : null}

      <div className="adminTableWrap"><table className="adminTable reportCenterTable"><thead><tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{table.rows.slice(0, 200).map((row, rowIndex) => <tr key={`${tab}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}><strong>{cell}</strong></td>)}</tr>)}{!table.rows.length ? <tr><td colSpan={Math.max(1, table.headers.length)}><div className="workforceEmpty"><strong>{loading ? "Loading report…" : "No report data"}</strong><span>Try another date range.</span></div></td></tr> : null}</tbody></table></div>
      {table.rows.length > 200 ? <p className="reportRowLimit">Showing the first 200 rows. CSV and Excel exports include all {table.rows.length} rows.</p> : null}
      {tab === "promotions" ? <p className="reportRowLimit">This report lists promotion content and publishing status. Open Promotion & Combo Analytics for impressions, clicks and attributed completed orders.</p> : null}
    </section>
  </div>;
}
