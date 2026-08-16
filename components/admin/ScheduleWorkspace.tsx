"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffRoleLabels, type StaffRole, type StaffSessionSummary } from "@/lib/staff-permissions";

type ScheduleEmployee = {
  id: string;
  fullName: string;
  role: StaffRole;
  active: boolean;
};

type ShiftRequest = {
  id: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  note: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

type WorkShift = {
  id: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string;
  note: string;
  status: "scheduled" | "cancelled";
  sourceRequestId: string | null;
  createdAt: string;
};

type ScheduleData = {
  canManage: boolean;
  team: ScheduleEmployee[];
  shifts: WorkShift[];
  requests: ShiftRequest[];
};

const emptySchedule: ScheduleData = { canManage: false, team: [], shifts: [], requests: [] };

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function durationHours(startTime: string, endTime: string) {
  return Math.max(0, (minutes(endTime) - minutes(startTime)) / 60);
}

function hours(value: number) {
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`;
}

function shortDate(value: string) {
  return fromDateKey(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function longDate(value: string) {
  return fromDateKey(value).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LV";
}

export default function ScheduleWorkspace({ staff, notify }: { staff: StaffSessionSummary; notify: (message: string) => void }) {
  const today = dateKey(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [data, setData] = useState<ScheduleData>(emptySchedule);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestDate, setRequestDate] = useState<string | null>(null);
  const [shiftEditor, setShiftEditor] = useState<{ date: string; shift?: WorkShift } | null>(null);
  const [actionId, setActionId] = useState("");
  const weekEnd = addDays(weekStart, 6);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/schedule?from=${weekStart}&to=${addDays(weekStart, 6)}`, { cache: "no-store" });
      const result = (await response.json()) as ScheduleData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load schedule.");
      setData({ canManage: Boolean(result.canManage), team: result.team || [], shifts: result.shifts || [], requests: result.requests || [] });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => { void refresh(); }, [refresh]);

  const employeeById = useMemo(() => new Map(data.team.map((employee) => [employee.id, employee])), [data.team]);
  const visibleHours = data.shifts.reduce((total, shift) => total + durationHours(shift.startTime, shift.endTime), 0);
  const personalHours = data.shifts.filter((shift) => shift.staffId === staff.id).reduce((total, shift) => total + durationHours(shift.startTime, shift.endTime), 0);
  const pendingRequests = data.requests.filter((request) => request.status === "pending");

  async function change(body: Record<string, unknown>, success: string) {
    const id = typeof body.id === "string" ? body.id : "schedule";
    setActionId(id);
    try {
      const response = await fetch("/api/admin/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update schedule.");
      notify(success);
      await refresh();
    } catch (changeError) {
      notify(changeError instanceof Error ? changeError.message : "Unable to update schedule");
    } finally {
      setActionId("");
    }
  }

  function openForDate(value: string) {
    return value < today ? today : value;
  }

  return <div className="adminStack scheduleWorkspace">
    <section className="adminWelcome scheduleWelcome">
      <div><span>{data.canManage ? "Team scheduling" : "My work schedule"}</span><h2>{data.canManage ? "Build a clear weekly schedule for the team." : "Register preferred shifts and follow your published schedule."}</h2><p>No clock-in or attendance tracking is collected.</p></div>
      <div className="scheduleWelcomeActions">
        {!staff.legacy && <button className="adminSecondary" type="button" onClick={() => setRequestDate(openForDate(today))}>Register my shift</button>}
        {data.canManage && <button className="adminPrimary" type="button" onClick={() => setShiftEditor({ date: openForDate(today) })}>＋ Add work shift</button>}
      </div>
    </section>

    <section className="scheduleMetrics">
      <div className="adminMetric"><span>Week</span><strong>{shortDate(weekStart)}–{shortDate(weekEnd)}</strong><small>Monday through Sunday</small></div>
      <div className="adminMetric"><span>{data.canManage ? "Team hours" : "My hours"}</span><strong>{hours(data.canManage ? visibleHours : personalHours)}</strong><small>Published schedule</small></div>
      <div className="adminMetric"><span>Scheduled shifts</span><strong>{data.shifts.length}</strong><small>{data.canManage ? "Across active employees" : "Assigned to you"}</small></div>
      <div className="adminMetric"><span>Pending requests</span><strong>{pendingRequests.length}</strong><small>{data.canManage ? "Waiting for review" : "Waiting for a manager"}</small></div>
    </section>

    <section className="adminCard scheduleCalendarCard">
      <div className="scheduleToolbar">
        <div><span className="adminEyebrow">Published schedule</span><h3>{shortDate(weekStart)} – {shortDate(weekEnd)}</h3></div>
        <div><button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))}>← Previous</button><button type="button" onClick={() => setWeekStart(mondayOf(today))}>This week</button><button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))}>Next →</button></div>
      </div>
      {error && <div className="scheduleError"><strong>Schedule unavailable</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}
      {!error && <div className="scheduleWeekGrid">
        {weekDays.map((day) => {
          const shifts = data.shifts.filter((shift) => shift.date === day);
          return <article className={`scheduleDay ${day === today ? "today" : ""}`} key={day}>
            <header><div><span>{fromDateKey(day).toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{fromDateKey(day).getDate()}</strong></div>{day >= today && <button type="button" title={data.canManage ? "Add work shift" : "Register preferred shift"} onClick={() => data.canManage ? setShiftEditor({ date: day }) : setRequestDate(day)}>＋</button>}</header>
            <div className="scheduleDayShifts">
              {shifts.map((shift) => {
                const employee = employeeById.get(shift.staffId);
                return <button className="scheduleShift" type="button" key={shift.id} onClick={() => data.canManage && setShiftEditor({ date: shift.date, shift })} disabled={!data.canManage}>
                  {data.canManage && <span className="scheduleShiftAvatar">{initials(employee?.fullName || "Staff")}</span>}
                  <span><strong>{shift.startTime}–{shift.endTime}</strong><small>{data.canManage ? employee?.fullName || "Unknown employee" : shift.position || "Work shift"}</small>{data.canManage && shift.position && <em>{shift.position}</em>}</span>
                </button>;
              })}
              {!shifts.length && <small className="scheduleEmptyDay">{loading ? "Loading…" : "No shifts"}</small>}
            </div>
          </article>;
        })}
      </div>}
    </section>

    <section className="adminCard scheduleRequestsCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Shift registration</span><h3>{data.canManage ? "Employee requests" : "My requests"}</h3></div><span className="adminHint">Requests do not become scheduled until approved</span></div>
      <div className="scheduleRequestList">
        {[...data.requests].sort((left, right) => `${right.date}${right.startTime}`.localeCompare(`${left.date}${left.startTime}`)).map((shiftRequest) => {
          const employee = employeeById.get(shiftRequest.staffId);
          const busy = actionId === shiftRequest.id;
          return <article key={shiftRequest.id}>
            <span className="scheduleRequestAvatar">{initials(employee?.fullName || staff.fullName)}</span>
            <div><strong>{data.canManage ? employee?.fullName || "Unknown employee" : longDate(shiftRequest.date)}</strong><small>{data.canManage ? `${longDate(shiftRequest.date)} · ` : ""}{shiftRequest.startTime}–{shiftRequest.endTime} · {hours(durationHours(shiftRequest.startTime, shiftRequest.endTime))}</small>{shiftRequest.note && <p>{shiftRequest.note}</p>}</div>
            <span className={`scheduleRequestStatus status-${shiftRequest.status}`}>{shiftRequest.status}</span>
            <div className="scheduleRequestActions">
              {data.canManage && shiftRequest.status === "pending" && <><button type="button" disabled={busy} onClick={() => void change({ kind: "request", action: "approve", id: shiftRequest.id }, "Shift request approved")}>Approve</button><button type="button" className="danger" disabled={busy} onClick={() => void change({ kind: "request", action: "decline", id: shiftRequest.id }, "Shift request declined")}>Decline</button></>}
              {!data.canManage && shiftRequest.status === "pending" && <button type="button" className="danger" disabled={busy} onClick={() => void change({ kind: "request", action: "cancel", id: shiftRequest.id }, "Shift request cancelled")}>Cancel</button>}
            </div>
          </article>;
        })}
        {!data.requests.length && <div className="scheduleEmptyRequests"><strong>No shift requests this week</strong><span>{data.canManage ? "New employee registrations will appear here." : "Use Register my shift to send your preferred time."}</span></div>}
      </div>
    </section>

    {requestDate && <ShiftRequestModal date={requestDate} close={() => setRequestDate(null)} saved={async () => { setRequestDate(null); notify("Shift request submitted"); await refresh(); }} />}
    {shiftEditor && <WorkShiftModal staff={staff} date={shiftEditor.date} shift={shiftEditor.shift} team={data.team} close={() => setShiftEditor(null)} saved={async () => { setShiftEditor(null); notify(shiftEditor.shift ? "Work shift updated" : "Work shift published"); await refresh(); }} cancelled={shiftEditor.shift ? async () => { await change({ kind: "shift", action: "cancel", id: shiftEditor.shift?.id }, "Work shift cancelled"); setShiftEditor(null); } : undefined} />}
  </div>;
}

function ShiftRequestModal({ date, close, saved }: { date: string; close: () => void; saved: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "request", date: form.get("date"), startTime: form.get("startTime"), endTime: form.get("endTime"), note: form.get("note") }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to submit shift request.");
      await saved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to submit shift request.");
    } finally {
      setSaving(false);
    }
  }
  return <ScheduleModal title="Register preferred shift" eyebrow="Send to Owner or Manager" close={close}><form className="scheduleForm" onSubmit={submit}><label>Date<input name="date" type="date" min={dateKey(new Date())} defaultValue={date} required /></label><label>Start time<input name="startTime" type="time" defaultValue="09:00" required /></label><label>End time<input name="endTime" type="time" defaultValue="17:00" required /></label><label className="wide">Note<textarea name="note" rows={3} maxLength={500} placeholder="Optional availability note" /></label>{error && <div className="adminLoginError wide">{error}</div>}<div className="adminFormActions wide"><button className="adminSecondary" type="button" onClick={close}>Cancel</button><button className="adminPrimary" type="submit" disabled={saving}>{saving ? "Submitting…" : "Submit request"}</button></div></form></ScheduleModal>;
}

function WorkShiftModal({ staff, date, shift, team, close, saved, cancelled }: { staff: StaffSessionSummary; date: string; shift?: WorkShift; team: ScheduleEmployee[]; close: () => void; saved: () => Promise<void>; cancelled?: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const availableTeam = team.filter((employee) => employee.active && (staff.role === "owner" || employee.role !== "owner"));
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const body = { kind: "shift", ...(shift ? { id: shift.id, action: "update" } : {}), staffId: form.get("staffId"), date: form.get("date"), startTime: form.get("startTime"), endTime: form.get("endTime"), position: form.get("position"), note: form.get("note") };
      const response = await fetch("/api/admin/schedule", { method: shift ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save work shift.");
      await saved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save work shift.");
    } finally {
      setSaving(false);
    }
  }
  return <ScheduleModal title={shift ? "Edit work shift" : "Add work shift"} eyebrow="Published team schedule" close={close}><form className="scheduleForm" onSubmit={submit}><label className="wide">Employee<select name="staffId" defaultValue={shift?.staffId || availableTeam[0]?.id} required>{availableTeam.map((employee) => <option value={employee.id} key={employee.id}>{employee.fullName} · {staffRoleLabels[employee.role]}</option>)}</select></label><label>Date<input name="date" type="date" min={dateKey(new Date())} defaultValue={shift?.date || date} required /></label><label>Start time<input name="startTime" type="time" defaultValue={shift?.startTime || "09:00"} required /></label><label>End time<input name="endTime" type="time" defaultValue={shift?.endTime || "17:00"} required /></label><label>Position / station<input name="position" maxLength={80} defaultValue={shift?.position || ""} placeholder="Bar, kitchen, register…" /></label><label className="wide">Manager note<textarea name="note" rows={3} maxLength={500} defaultValue={shift?.note || ""} /></label>{error && <div className="adminLoginError wide">{error}</div>}<div className="adminFormActions scheduleShiftFormActions wide">{cancelled && <button className="adminDangerButton" type="button" onClick={() => void cancelled()} disabled={saving}>Cancel shift</button>}<span/><button className="adminSecondary" type="button" onClick={close}>Close</button><button className="adminPrimary" type="submit" disabled={saving || !availableTeam.length}>{saving ? "Saving…" : shift ? "Save shift" : "Publish shift"}</button></div></form></ScheduleModal>;
}

function ScheduleModal({ title, eyebrow, close, children }: { title: string; eyebrow: string; close: () => void; children: React.ReactNode }) {
  return <div className="adminModalBackdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><div className="adminModal scheduleModal"><header><div><span className="adminEyebrow">{eyebrow}</span><h2>{title}</h2></div><button type="button" onClick={close}>×</button></header>{children}</div></div>;
}
