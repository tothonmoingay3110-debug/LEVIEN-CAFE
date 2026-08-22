"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffRoleLabels, type StaffRole, type StaffSessionSummary } from "@/lib/staff-permissions";

type TimeOffEmployee = {
  id: string;
  fullName: string;
  role: StaffRole;
  active: boolean;
};

type TimeOffRequest = {
  id: string;
  staffId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type TimeOffData = {
  canManage: boolean;
  team: TimeOffEmployee[];
  requests: TimeOffRequest[];
};

type StatusFilter = "all" | TimeOffRequest["status"];

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

function displayDate(value: string) {
  return fromDateKey(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LV";
}

export default function TimeOffWorkspace({ staff, notify }: { staff: StaffSessionSummary; notify: (message: string) => void }) {
  const today = dateKey(new Date());
  const [data, setData] = useState<TimeOffData>({ canManage: false, team: [], requests: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const [actionId, setActionId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/time-off?from=${addDays(today, -30)}&to=${addDays(today, 180)}`, { cache: "no-store" });
      const result = (await response.json()) as TimeOffData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load time off.");
      setData({ canManage: Boolean(result.canManage), team: result.team || [], requests: result.requests || [] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load time off.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { void refresh(); }, [refresh]);

  const employeeById = useMemo(() => new Map(data.team.map((employee) => [employee.id, employee])), [data.team]);
  const filtered = data.requests.filter((request) => filter === "all" || request.status === filter).sort((left, right) => right.startDate.localeCompare(left.startDate));
  const pending = data.requests.filter((request) => request.status === "pending");
  const approvedUpcoming = data.requests.filter((request) => request.status === "approved" && request.endDate >= today);
  const approvedDays = approvedUpcoming.reduce((total, request) => total + request.days, 0);
  const peopleOff = new Set(approvedUpcoming.map((request) => request.staffId)).size;

  function canManageRequest(request: TimeOffRequest) {
    const target = employeeById.get(request.staffId);
    return staff.role === "owner" || target?.role !== "owner";
  }

  async function change(request: TimeOffRequest, action: "approve" | "decline" | "cancel", message: string) {
    setActionId(request.id);
    try {
      const response = await fetch("/api/admin/time-off", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: request.id, action }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update time off.");
      notify(message);
      await refresh();
    } catch (changeError) {
      notify(changeError instanceof Error ? changeError.message : "Unable to update time off");
    } finally {
      setActionId("");
    }
  }

  const filters: StatusFilter[] = ["all", "pending", "approved", "declined", "cancelled"];

  return <div className="adminStack timeOffWorkspace">
    <section className="adminWelcome timeOffWelcome">
      <div><span>{data.canManage ? "Team availability" : "My availability"}</span><h2>{data.canManage ? "Review time off before publishing the schedule." : "Request time away and follow its approval status."}</h2><p>Time off records availability only; paid leave and payroll are not calculated.</p></div>
      {!staff.legacy && <button className="adminPrimary" type="button" onClick={() => setRequestOpen(true)}>＋ Request time off</button>}
    </section>

    <section className="timeOffMetrics">
      <div className="adminMetric"><span>Pending</span><strong>{pending.length}</strong><small>{data.canManage ? "Waiting for review" : "Waiting for management"}</small></div>
      <div className="adminMetric"><span>Approved upcoming</span><strong>{approvedUpcoming.length}</strong><small>Active date ranges</small></div>
      <div className="adminMetric"><span>Approved days</span><strong>{approvedDays}</strong><small>Calendar days in view</small></div>
      <div className="adminMetric"><span>{data.canManage ? "People away" : "My requests"}</span><strong>{data.canManage ? peopleOff : data.requests.length}</strong><small>{data.canManage ? "Upcoming approved leave" : "Last 30 / next 180 days"}</small></div>
    </section>

    <section className="adminToolbar timeOffToolbar"><div className="adminTabs">{filters.map((status) => <button type="button" className={filter === status ? "active" : ""} key={status} onClick={() => setFilter(status)}>{status === "all" ? "All" : status[0].toUpperCase() + status.slice(1)}<span>{status === "all" ? data.requests.length : data.requests.filter((request) => request.status === status).length}</span></button>)}</div><button className="adminSecondary" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button></section>

    <section className="adminCard timeOffListCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Availability requests</span><h3>{filtered.length} {filter === "all" ? "requests" : filter}</h3></div><span className="adminHint">Approved dates block overlapping work shifts</span></div>
      {error && <div className="scheduleError"><strong>Time off unavailable</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}
      {!error && <div className="timeOffList">
        {filtered.map((request) => {
          const employee = employeeById.get(request.staffId);
          const busy = actionId === request.id;
          const manageable = canManageRequest(request);
          return <article key={request.id}>
            <span className="timeOffAvatar">{initials(employee?.fullName || staff.fullName)}</span>
            <div className="timeOffIdentity"><strong>{data.canManage ? employee?.fullName || "Unknown employee" : "My time off"}</strong><small>{data.canManage && employee ? `${staffRoleLabels[employee.role]} · ` : ""}Submitted {displayDate(request.createdAt.slice(0, 10))}</small></div>
            <div className="timeOffDates"><strong>{displayDate(request.startDate)}{request.endDate !== request.startDate ? ` – ${displayDate(request.endDate)}` : ""}</strong><small>{request.days} calendar day{request.days === 1 ? "" : "s"}</small></div>
            <p>{request.reason || "No reason provided."}</p>
            <span className={`timeOffStatus status-${request.status}`}>{request.status}</span>
            <div className="timeOffActions">
              {data.canManage && manageable && request.status === "pending" && <><button type="button" disabled={busy} onClick={() => void change(request, "approve", "Time off approved")}>Approve</button><button type="button" className="danger" disabled={busy} onClick={() => void change(request, "decline", "Time off declined")}>Decline</button></>}
              {data.canManage && manageable && request.status === "approved" && <button type="button" className="danger" disabled={busy} onClick={() => void change(request, "cancel", "Approved time off cancelled")}>Cancel approval</button>}
              {data.canManage && !manageable && <span className="adminHint">Owner only</span>}
              {!data.canManage && request.status === "pending" && <button type="button" className="danger" disabled={busy} onClick={() => void change(request, "cancel", "Time-off request cancelled")}>Cancel request</button>}
            </div>
          </article>;
        })}
        {!filtered.length && <div className="scheduleEmptyRequests"><strong>{loading ? "Loading requests…" : "No time-off requests found"}</strong><span>{filter === "all" ? "Use Request time off to create the first request." : "Choose another status filter."}</span></div>}
      </div>}
    </section>

    {requestOpen && <TimeOffModal close={() => setRequestOpen(false)} saved={async () => { setRequestOpen(false); notify("Time-off request submitted"); await refresh(); }} />}
  </div>;
}

function TimeOffModal({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
  const today = dateKey(new Date());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/time-off", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startDate: form.get("startDate"), endDate: form.get("endDate"), reason: form.get("reason") }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to request time off.");
      await saved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to request time off.");
    } finally {
      setSaving(false);
    }
  }
  return <div className="adminModalBackdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><div className="adminModal timeOffModal"><header><div><span className="adminEyebrow">Employee availability</span><h2>Request time off</h2></div><button type="button" onClick={close}>×</button></header><form className="timeOffForm" onSubmit={submit}><label>First day<input name="startDate" type="date" min={today} defaultValue={today} required /></label><label>Last day<input name="endDate" type="date" min={today} defaultValue={today} required /></label><label className="wide">Reason or note<textarea name="reason" rows={4} maxLength={500} placeholder="Optional note for the manager" /></label><div className="timeOffFormNote wide"><strong>Maximum 31 calendar days per request.</strong><span>Approved time off prevents work shifts from being assigned during this range.</span></div>{error && <div className="adminLoginError wide">{error}</div>}<div className="adminFormActions wide"><button className="adminSecondary" type="button" onClick={close}>Cancel</button><button className="adminPrimary" type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit request"}</button></div></form></div></div>;
}
