"use client";

import { useCallback, useEffect, useState } from "react";
import { moduleNames } from "@/lib/web-engagement";

type Report = {
  visits: number;
  pageViews: number;
  moduleClicks: number;
  productViews: number;
  productClicks: number;
  modules: { key: string; pageViews: number; clicks: number }[];
  products: { id: string; name: string; views: number; clicks: number }[];
  daily: { date: string; visits: number; pageViews: number }[];
};

function storeDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const read = (name: string) => parts.find((part) => part.type === name)?.value || "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadReport(report: Report, from: string, to: string) {
  const rows: (string | number)[][] = [
    ["LEVIEN website engagement", `${from} to ${to}`],
    ["Metric", "Count"],
    ["Visits (browser sessions)", report.visits],
    ["Page views", report.pageViews],
    ["Module clicks", report.moduleClicks],
    ["Product views", report.productViews],
    ["Product clicks", report.productClicks],
    [], ["Module", "Page views", "Clicks"],
    ...report.modules.map((row): (string | number)[] => [moduleNames[row.key] || row.key, row.pageViews, row.clicks]),
    [], ["Product", "Views", "Clicks"],
    ...report.products.map((row): (string | number)[] => [row.name, row.views, row.clicks]),
    [], ["Date (Philadelphia)", "Visits", "Page views"],
    ...report.daily.map((row): (string | number)[] => [row.date, row.visits, row.pageViews]),
  ];
  const url = URL.createObjectURL(new Blob(["\uFEFF", rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `levien-web-engagement-${from}-to-${to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const number = (value: number) => new Intl.NumberFormat("en-US").format(value);

export default function WebEngagementReport() {
  const today = storeDate(new Date());
  const [from, setFrom] = useState(storeDate(new Date(Date.now() - 29 * 86_400_000)));
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/web-engagement?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { cache: "no-store" });
      const body = await response.json() as Report & { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load website engagement.");
      setReport(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load website engagement.");
      setReport(null);
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { void load(); }, [load]);

  return <div className="adminStack webEngagementReport">
    <section className="adminToolbar intelligenceToolbar">
      <div><span className="adminEyebrow">Website engagement</span><h2>Visits, modules & products</h2><small>Reporting dates use Philadelphia time. Tracking starts when this feature is deployed; historical visits cannot be recovered.</small></div>
      <div className="reportsDateRange"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} max={today} onChange={(event) => setTo(event.target.value)} /></label><button className="adminSecondary" type="button" disabled={loading} onClick={() => void load()}>{loading ? "Loading…" : "Refresh"}</button><button className="adminPrimary" type="button" disabled={!report || loading} onClick={() => report && downloadReport(report, from, to)}>Export CSV</button></div>
    </section>
    {error && <div className="scheduleError"><strong>Report unavailable</strong><span>{error}</span><button type="button" onClick={() => void load()}>Try again</button></div>}
    {loading && <section className="adminCard intelligenceLoading">Loading website activity…</section>}
    {report && !error && <>
      <section className="webEngagementMetrics">
        {([ ["Website visits", report.visits, "Distinct browser sessions"], ["Page views", report.pageViews, "Public page opens"], ["Module clicks", report.moduleClicks, "Links to site sections"], ["Product views", report.productViews, "Cards visible for 0.7 seconds"], ["Product clicks", report.productClicks, "Add or customize taps"] ] as const).map(([label, value, detail]) => <div className="adminMetric" key={label}><span>{label}</span><strong>{number(value)}</strong><small>{detail}</small></div>)}
      </section>
      <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Modules</span><h3>Pages and section clicks</h3><p>Page views count opens; clicks count internal links to each module.</p></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Module</th><th>Page views</th><th>Clicks</th></tr></thead><tbody>{report.modules.map((row) => <tr key={row.key}><td><strong>{moduleNames[row.key] || row.key}</strong></td><td>{number(row.pageViews)}</td><td>{number(row.clicks)}</td></tr>)}{!report.modules.length && <tr><td colSpan={3}>No activity in this date range.</td></tr>}</tbody></table></div></section>
      <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Products</span><h3>Most viewed products</h3><p>A view is counted when at least half the product card stays on screen for 0.7 seconds. Clicks are add/customize taps. Views are deduplicated per session and product for 30 minutes.</p></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Product</th><th>Views</th><th>Clicks</th><th>Click rate</th></tr></thead><tbody>{report.products.map((row) => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{number(row.views)}</td><td>{number(row.clicks)}</td><td>{row.views ? `${(row.clicks / row.views * 100).toFixed(1)}%` : "—"}</td></tr>)}{!report.products.length && <tr><td colSpan={4}>No product views yet.</td></tr>}</tbody></table></div></section>
      <section className="adminCard"><div className="adminCardHead"><div><span className="adminEyebrow">Trend</span><h3>Daily visits</h3></div></div><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Date</th><th>Visits</th><th>Page views</th></tr></thead><tbody>{report.daily.map((row) => <tr key={row.date}><td>{row.date}</td><td>{number(row.visits)}</td><td>{number(row.pageViews)}</td></tr>)}{!report.daily.length && <tr><td colSpan={3}>No visits yet.</td></tr>}</tbody></table></div></section>
    </>}
  </div>;
}
