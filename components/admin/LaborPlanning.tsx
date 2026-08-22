"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffRoleLabels, type StaffRole } from "@/lib/staff-permissions";

type LaborEmployee = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole;
  active: boolean;
  plannedHours: number;
  scheduledHours: number;
  varianceHours: number;
  hourlyRate: number;
  plannedCost: number;
  forecastCost: number;
  shiftCount: number;
  currency: string;
};

type DailyLabor = {
  date: string;
  shiftCount: number;
  employeeCount: number;
  scheduledHours: number;
  forecastCost: number;
};

type LaborReport = {
  from: string;
  to: string;
  rangeDays: number;
  currency: string;
  totals: {
    plannedHours: number;
    scheduledHours: number;
    varianceHours: number;
    plannedCost: number;
    forecastCost: number;
    shiftCount: number;
  };
  employees: LaborEmployee[];
  daily: DailyLabor[];
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function mondayOf(value: string) {
  const date = fromDateKey(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return dateKey(date);
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function hours(value: number) {
  return `${value.toFixed(1)}h`;
}

function shortDate(value: string) {
  return fromDateKey(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportReport(report: LaborReport) {
  const headers = ["Employee", "Email", "Role", "Status", "Planned Hours", "Scheduled Hours", "Variance Hours", "Hourly Rate", "Planned Cost", "Forecast Cost", "Shifts"];
  const rows = report.employees.map((employee) => [employee.fullName, employee.email, staffRoleLabels[employee.role], employee.active ? "Active" : "Locked", employee.plannedHours.toFixed(2), employee.scheduledHours.toFixed(2), employee.varianceHours.toFixed(2), employee.hourlyRate.toFixed(2), employee.plannedCost.toFixed(2), employee.forecastCost.toFixed(2), employee.shiftCount]);
  rows.push(["TOTAL", "", "", "", report.totals.plannedHours.toFixed(2), report.totals.scheduledHours.toFixed(2), report.totals.varianceHours.toFixed(2), "", report.totals.plannedCost.toFixed(2), report.totals.forecastCost.toFixed(2), report.totals.shiftCount]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `levien-labor-forecast-${report.from}-to-${report.to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function LaborPlanning() {
  const today = dateKey(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [report, setReport] = useState<LaborReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const weekEnd = addDays(weekStart, 6);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/labor?from=${weekStart}&to=${addDays(weekStart, 6)}`, { cache: "no-store" });
      const result = (await response.json()) as LaborReport & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load labor planning.");
      setReport(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load labor planning.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { void refresh(); }, [refresh]);

  const employees = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return report?.employees || [];
    return (report?.employees || []).filter((employee) => employee.fullName.toLowerCase().includes(term) || employee.email.toLowerCase().includes(term) || staffRoleLabels[employee.role].toLowerCase().includes(term));
  }, [query, report]);

  const variance = report?.totals.varianceHours || 0;
  const costVariance = (report?.totals.forecastCost || 0) - (report?.totals.plannedCost || 0);

  return <div className="adminStack laborWorkspace">
    <section className="adminWelcome laborWelcome">
      <div><span>Private management report</span><h2>Plan weekly staffing hours and labor cost.</h2><p>Forecasts use published shifts, not attendance or clock-in records.</p></div>
      <button className="adminPrimary" type="button" disabled={!report} onClick={() => report && exportReport(report)}>Export CSV</button>
    </section>

    <section className="laborMetrics">
      <div className="adminMetric"><span>Planned hours</span><strong>{hours(report?.totals.plannedHours || 0)}</strong><small>Employee weekly targets</small></div>
      <div className="adminMetric"><span>Scheduled hours</span><strong>{hours(report?.totals.scheduledHours || 0)}</strong><small>{report?.totals.shiftCount || 0} published shifts</small></div>
      <div className="adminMetric"><span>Labor forecast</span><strong>{money(report?.totals.forecastCost || 0)}</strong><small>{costVariance >= 0 ? "+" : ""}{money(costVariance)} vs plan</small></div>
      <div className={`adminMetric laborVarianceMetric ${variance > 0 ? "over" : variance < 0 ? "under" : "balanced"}`}><span>Hours variance</span><strong>{variance > 0 ? "+" : ""}{hours(variance)}</strong><small>{variance > 0 ? "Above planned hours" : variance < 0 ? "Below planned hours" : "Schedule matches plan"}</small></div>
    </section>

    <section className="adminCard laborDailyCard">
      <div className="laborToolbar"><div><span className="adminEyebrow">Daily coverage</span><h3>{shortDate(weekStart)} – {shortDate(weekEnd)}</h3></div><div><button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Previous</button><button type="button" onClick={() => setWeekStart(mondayOf(today))}>This week</button><button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button></div></div>
      {error && <div className="scheduleError"><strong>Labor report unavailable</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}
      {!error && <div className="laborDailyGrid">{(report?.daily || Array.from({ length: 7 }, (_, index) => ({ date: addDays(weekStart, index), shiftCount: 0, employeeCount: 0, scheduledHours: 0, forecastCost: 0 }))).map((day) => <article className={day.date === today ? "today" : ""} key={day.date}><header><span>{fromDateKey(day.date).toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{fromDateKey(day.date).getDate()}</strong></header><b>{loading ? "—" : hours(day.scheduledHours)}</b><small>{day.employeeCount} employees · {day.shiftCount} shifts</small><em>{money(day.forecastCost)}</em></article>)}</div>}
    </section>

    <section className="adminCard laborTableCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Planned vs scheduled</span><h3>Employee labor summary</h3></div><div className="adminSearch laborSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees…" /></div></div>
      <div className="adminTableWrap"><table className="adminTable laborTable"><thead><tr><th>Employee</th><th>Planned</th><th>Scheduled</th><th>Variance</th><th>Hourly pay</th><th>Forecast</th><th>Shifts</th></tr></thead><tbody>
        {employees.map((employee) => <tr key={employee.id}><td><div><strong>{employee.fullName}</strong><small>{employee.email} · {staffRoleLabels[employee.role]}{employee.active ? "" : " · Locked"}</small></div></td><td><strong>{hours(employee.plannedHours)}</strong><small>{money(employee.plannedCost)} planned</small></td><td><strong>{hours(employee.scheduledHours)}</strong></td><td><span className={`laborVariance ${employee.varianceHours > 0 ? "over" : employee.varianceHours < 0 ? "under" : "balanced"}`}>{employee.varianceHours > 0 ? "+" : ""}{hours(employee.varianceHours)}</span></td><td><strong>{money(employee.hourlyRate)}</strong></td><td><strong>{money(employee.forecastCost)}</strong></td><td><strong>{employee.shiftCount}</strong></td></tr>)}
        {!employees.length && <tr><td colSpan={7}><div className="customerEmpty"><strong>{loading ? "Loading labor report…" : "No employees found"}</strong><span>Adjust the search or add employee compensation data.</span></div></td></tr>}
      </tbody></table></div>
      <div className="laborPrivacyNote"><strong>Management-only forecast</strong><span>Hourly pay and labor cost are returned only after server-side Owner/Manager authorization. Values represent scheduled estimates before taxes and adjustments.</span></div>
    </section>
  </div>;
}
