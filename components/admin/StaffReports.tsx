"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffRoleLabels, type StaffRole } from "@/lib/staff-permissions";

type StaffReport = {
  from: string;
  to: string;
  rangeDays: number;
  totals: { employees: number; shiftCount: number; scheduledHours: number; approvedTimeOffDays: number; coverageRequests: number };
  employees: {
    id: string; fullName: string; email: string; role: StaffRole; active: boolean; shiftCount: number;
    scheduledDays: number; scheduledHours: number; approvedTimeOffDays: number; coverageRequests: number; coverageAccepted: number;
  }[];
  daily: { date: string; employeeCount: number; shiftCount: number; scheduledHours: number }[];
};

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mondayOf(value: string) {
  const date = fromDateKey(value);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return dateKey(date);
}

function addDays(value: string, days: number) {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function displayDate(value: string) {
  return fromDateKey(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function hours(value: number) {
  return `${value.toFixed(1)}h`;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportCsv(report: StaffReport) {
  const rows: unknown[][] = [["Employee", "Email", "Role", "Status", "Scheduled Days", "Shifts", "Scheduled Hours", "Approved Time Off Days", "Coverage Requested", "Coverage Accepted"]];
  report.employees.forEach((employee) => rows.push([employee.fullName, employee.email, staffRoleLabels[employee.role], employee.active ? "Active" : "Locked", employee.scheduledDays, employee.shiftCount, employee.scheduledHours.toFixed(2), employee.approvedTimeOffDays, employee.coverageRequests, employee.coverageAccepted]));
  rows.push(["TOTAL", "", "", "", "", report.totals.shiftCount, report.totals.scheduledHours.toFixed(2), report.totals.approvedTimeOffDays, report.totals.coverageRequests, ""]);
  const blob = new Blob(["\uFEFF", rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `levien-staff-report-${report.from}-to-${report.to}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function StaffReports() {
  const today = dateKey(new Date());
  const initialFrom = mondayOf(today);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(addDays(initialFrom, 6));
  const [report, setReport] = useState<StaffReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/reports?from=${from}&to=${to}`, { cache: "no-store" });
      const result = (await response.json()) as StaffReport & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load staff report.");
      setReport(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load staff report.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { void refresh(); }, [refresh]);

  const employees = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return report?.employees || [];
    return (report?.employees || []).filter((employee) => employee.fullName.toLowerCase().includes(term) || employee.email.toLowerCase().includes(term) || staffRoleLabels[employee.role].toLowerCase().includes(term));
  }, [query, report]);

  function setWeek() {
    const start = mondayOf(today);
    setFrom(start);
    setTo(addDays(start, 6));
  }

  function setMonth() {
    const date = new Date();
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    setFrom(dateKey(start));
    setTo(dateKey(end));
  }

  return <div className="adminStack staffReportsWorkspace">
    <section className="adminWelcome reportsWelcome"><div><span>Owner & Manager report</span><h2>Understand scheduled staffing by week or month.</h2><p>These are published schedule hours—not attendance, clock-in or payroll.</p></div><button className="adminPrimary" type="button" disabled={!report} onClick={() => report && exportCsv(report)}>Export CSV</button></section>

    <section className="reportsMetrics">
      <div className="adminMetric"><span>Active employees</span><strong>{report?.totals.employees || 0}</strong><small>Current active accounts</small></div>
      <div className="adminMetric"><span>Scheduled hours</span><strong>{hours(report?.totals.scheduledHours || 0)}</strong><small>{report?.totals.shiftCount || 0} published shifts</small></div>
      <div className="adminMetric"><span>Approved time off</span><strong>{report?.totals.approvedTimeOffDays || 0}</strong><small>Calendar days in range</small></div>
      <div className="adminMetric"><span>Coverage requests</span><strong>{report?.totals.coverageRequests || 0}</strong><small>Requests tied to range shifts</small></div>
    </section>

    <section className="adminToolbar reportsToolbar">
      <div className="reportsPresets"><button type="button" onClick={setWeek}>This week</button><button type="button" onClick={setMonth}>This month</button></div>
      <div className="reportsDateRange"><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" min={from} value={to} onChange={(event) => setTo(event.target.value)} /></label><button className="adminSecondary" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Loading…" : "Refresh"}</button></div>
    </section>

    {error && <div className="scheduleError"><strong>Report unavailable</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}

    <section className="adminCard reportsCoverageCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Daily coverage</span><h3>{displayDate(from)} – {displayDate(to)}</h3></div><span className="adminHint">{report?.rangeDays || 0} calendar days</span></div>
      <div className="reportsDailyGrid">{(report?.daily || []).map((day) => <article key={day.date}><span>{fromDateKey(day.date).toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{fromDateKey(day.date).getDate()}</strong><b>{hours(day.scheduledHours)}</b><small>{day.employeeCount} staff · {day.shiftCount} shifts</small></article>)}{!report?.daily.length && <div className="workforceEmpty"><strong>{loading ? "Loading coverage…" : "No dates found"}</strong></div>}</div>
    </section>

    <section className="adminCard reportsTableCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Employee summary</span><h3>Published schedule totals</h3></div><div className="adminSearch reportsSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees…" /></div></div>
      <div className="adminTableWrap"><table className="adminTable reportsTable"><thead><tr><th>Employee</th><th>Scheduled days</th><th>Shifts</th><th>Hours</th><th>Time off</th><th>Coverage</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td><div><strong>{employee.fullName}</strong><small>{employee.email} · {staffRoleLabels[employee.role]}{employee.active ? "" : " · Locked"}</small></div></td><td><strong>{employee.scheduledDays}</strong></td><td><strong>{employee.shiftCount}</strong></td><td><strong>{hours(employee.scheduledHours)}</strong></td><td><strong>{employee.approvedTimeOffDays}d</strong></td><td><strong>{employee.coverageRequests} out · {employee.coverageAccepted} in</strong></td></tr>)}{!employees.length && <tr><td colSpan={6}><div className="workforceEmpty"><strong>{loading ? "Loading report…" : "No employees found"}</strong><span>Adjust the search or report range.</span></div></td></tr>}</tbody></table></div>
      <div className="reportsPrivacyNote"><strong>Schedule-based report</strong><span>No attendance or payroll values are stored here. Hourly pay remains protected inside Employee Management and Labor Planning.</span></div>
    </section>
  </div>;
}
