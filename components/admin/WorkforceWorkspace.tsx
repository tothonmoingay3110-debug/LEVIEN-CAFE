"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffRoleLabels, type StaffRole, type StaffSessionSummary } from "@/lib/staff-permissions";

type WorkspaceShift = {
  id: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
  position: string;
  note: string;
  status: "scheduled" | "cancelled";
};

type WorkspaceNotification = {
  id: string;
  type: "schedule" | "swap" | "time_off" | "system";
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
};

type WorkspaceSwap = {
  id: string;
  shiftId: string;
  requesterId: string;
  requesterName: string;
  offeredTo: string;
  offeredName: string;
  note: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  shift: WorkspaceShift | null;
};

type WorkspaceData = {
  canManage: boolean;
  legacy: boolean;
  team: { id: string; fullName: string; role: StaffRole }[];
  shifts: WorkspaceShift[];
  timeOff: { id: string; startDate: string; endDate: string; reason: string; status: string }[];
  notifications: WorkspaceNotification[];
  unreadCount: number;
  swaps: WorkspaceSwap[];
};

const emptyWorkspace: WorkspaceData = { canManage: false, legacy: false, team: [], shifts: [], timeOff: [], notifications: [], unreadCount: 0, swaps: [] };

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function displayDate(value: string) {
  return fromDateKey(value).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function displayDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function shiftHours(shift: WorkspaceShift) {
  return Math.max(0, (minutes(shift.endTime) - minutes(shift.startTime)) / 60);
}

function hours(value: number) {
  return Number.isInteger(value) ? `${value}h` : `${value.toFixed(1)}h`;
}

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LV";
}

export default function WorkforceWorkspace({
  staff,
  notify,
  unreadChanged,
}: {
  staff: StaffSessionSummary;
  notify: (message: string) => void;
  unreadChanged?: (count: number) => void;
}) {
  const [data, setData] = useState<WorkspaceData>(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [actionId, setActionId] = useState("");
  const today = dateKey(new Date());

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/workspace", { cache: "no-store" });
      const result = (await response.json()) as WorkspaceData & { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load My Workspace.");
      const next = {
        canManage: Boolean(result.canManage),
        legacy: Boolean(result.legacy),
        team: result.team || [],
        shifts: result.shifts || [],
        timeOff: result.timeOff || [],
        notifications: result.notifications || [],
        unreadCount: Number(result.unreadCount || 0),
        swaps: result.swaps || [],
      };
      setData(next);
      unreadChanged?.(next.unreadCount);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load My Workspace.");
    } finally {
      setLoading(false);
    }
  }, [unreadChanged]);

  useEffect(() => {
    const sync = () => void refresh();
    sync();
    const timer = window.setInterval(sync, 45_000);
    window.addEventListener("focus", sync);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, [refresh]);

  const nextShift = data.shifts[0];
  const pendingSwaps = data.swaps.filter((swap) => swap.status === "pending");
  const pendingShiftIds = new Set(pendingSwaps.map((swap) => swap.shiftId));
  const offerableShifts = data.shifts.filter((shift) => shift.date >= today && !pendingShiftIds.has(shift.id));
  const scheduledHours = useMemo(() => data.shifts.reduce((total, shift) => total + shiftHours(shift), 0), [data.shifts]);

  async function change(body: Record<string, unknown>, success: string) {
    const id = typeof body.id === "string" ? body.id : "workspace";
    setActionId(id);
    try {
      const response = await fetch("/api/admin/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update My Workspace.");
      notify(success);
      await refresh();
    } catch (changeError) {
      notify(changeError instanceof Error ? changeError.message : "Unable to update My Workspace");
    } finally {
      setActionId("");
    }
  }

  return <div className="adminStack workforceWorkspace">
    <section className="adminWelcome workforceWelcome">
      <div><span>V2.11 staff operations</span><h2>Everything you need for your work week.</h2><p>Schedule updates, coverage requests and availability in one private workspace.</p></div>
      {!data.legacy && <button className="adminPrimary" type="button" onClick={() => setOfferOpen(true)}>Register availability</button>}
    </section>

    <section className="workforceMetrics">
      <div className="adminMetric"><span>Upcoming shifts</span><strong>{data.shifts.length}</strong><small>Next 90 days</small></div>
      <div className="adminMetric"><span>Scheduled hours</span><strong>{hours(scheduledHours)}</strong><small>Upcoming published shifts</small></div>
      <div className="adminMetric"><span>Unread updates</span><strong>{data.unreadCount}</strong><small>Private in-app notifications</small></div>
      <div className="adminMetric"><span>{data.canManage ? "Pending coverage" : "My coverage requests"}</span><strong>{data.canManage ? pendingSwaps.length : data.swaps.filter((swap) => swap.requesterId === staff.id).length}</strong><small>Manager-reviewed changes</small></div>
    </section>

    {error && <div className="scheduleError"><strong>Workspace unavailable</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}
    {data.legacy && <div className="workforceLegacyNote"><strong>Legacy Owner mode</strong><span>Create and use a Supabase Auth Owner account to receive personal notifications or offer your own shifts.</span></div>}

    <div className="workforceOverviewGrid">
      <section className="adminCard workforceShiftCard">
        <div className="adminCardHead"><div><span className="adminEyebrow">My schedule</span><h3>Upcoming shifts</h3></div><span className="adminHint">{nextShift ? `Next: ${displayDate(nextShift.date)}` : "No upcoming shift"}</span></div>
        <div className="workforceShiftList">
          {data.shifts.slice(0, 8).map((shift) => <article key={shift.id}><span className="workforceDateTile"><b>{fromDateKey(shift.date).getDate()}</b><small>{fromDateKey(shift.date).toLocaleDateString("en-US", { month: "short" })}</small></span><div><strong>{displayDate(shift.date)}</strong><small>{shift.startTime}–{shift.endTime} · {hours(shiftHours(shift))}</small>{shift.position && <em>{shift.position}</em>}</div></article>)}
          {!data.shifts.length && <div className="workforceEmpty"><strong>{loading ? "Loading schedule…" : "No upcoming shifts"}</strong><span>Your published work shifts will appear here.</span></div>}
        </div>
      </section>

      <section className="adminCard workforceTimeOffCard">
        <div className="adminCardHead"><div><span className="adminEyebrow">Availability</span><h3>Upcoming time off</h3></div></div>
        <div className="workforceTimeOffList">
          {data.timeOff.slice(0, 6).map((item) => <article key={item.id}><span>OFF</span><div><strong>{displayDate(item.startDate)}{item.endDate !== item.startDate ? ` – ${displayDate(item.endDate)}` : ""}</strong><small>{item.reason || "Approved availability"}</small></div><b>{item.status}</b></article>)}
          {!data.timeOff.length && <div className="workforceEmpty"><strong>No upcoming time off</strong><span>Approved and pending requests will appear here.</span></div>}
        </div>
      </section>
    </div>

    <section className="adminCard workforceNotificationCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Private inbox</span><h3>Schedule notifications</h3></div>{data.unreadCount > 0 && <button className="adminTextButton" type="button" onClick={() => void change({ kind: "notification", action: "read_all" }, "All notifications marked as read")}>Mark all read</button>}</div>
      <div className="workforceNotificationList">
        {data.notifications.map((notification) => <button className={notification.readAt ? "read" : "unread"} type="button" key={notification.id} onClick={() => !notification.readAt && void change({ kind: "notification", action: "read", id: notification.id }, "Notification marked as read")}><span className={`notificationType type-${notification.type}`}>{notification.type === "schedule" ? "CAL" : notification.type === "swap" ? "SWP" : notification.type === "time_off" ? "OFF" : "INFO"}</span><span><strong>{notification.title}</strong><small>{notification.message}</small><em>{displayDateTime(notification.createdAt)}</em></span>{!notification.readAt && <b>New</b>}</button>)}
        {!data.notifications.length && <div className="workforceEmpty"><strong>{loading ? "Loading notifications…" : "No notifications yet"}</strong><span>Schedule and coverage updates will appear here.</span></div>}
      </div>
    </section>

    <section className="adminCard workforceSwapCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Shift coverage</span><h3>{data.canManage ? "Team coverage requests" : "My coverage requests"}</h3></div><span className="adminHint">A manager must approve every reassignment</span></div>
      <div className="workforceSwapList">
        {data.swaps.map((swap) => {
          const busy = actionId === swap.id;
          return <article key={swap.id}>
            <span className="workforceSwapAvatar">{initials(swap.requesterName)}</span>
            <div><strong>{swap.requesterName} → {swap.offeredName}</strong><small>{swap.shift ? `${displayDate(swap.shift.date)} · ${swap.shift.startTime}–${swap.shift.endTime}` : "Original shift unavailable"}</small>{swap.note && <p>{swap.note}</p>}</div>
            <span className={`workforceStatus status-${swap.status}`}>{swap.status}</span>
            <div className="workforceSwapActions">
              {data.canManage && swap.requesterId !== staff.id && swap.status === "pending" && <><button type="button" disabled={busy} onClick={() => void change({ kind: "swap", action: "approve", id: swap.id }, "Coverage request approved")}>Approve</button><button className="danger" type="button" disabled={busy} onClick={() => void change({ kind: "swap", action: "decline", id: swap.id }, "Coverage request declined")}>Decline</button></>}
              {swap.requesterId === staff.id && swap.status === "pending" && <button className="danger" type="button" disabled={busy} onClick={() => void change({ kind: "swap", action: "cancel", id: swap.id }, "Coverage request cancelled")}>Cancel</button>}
            </div>
          </article>;
        })}
        {!data.swaps.length && <div className="workforceEmpty"><strong>No coverage requests</strong><span>Coverage requests will appear here when shift reassignment is enabled.</span></div>}
      </div>
    </section>

    {offerOpen && <AvailabilityModal close={() => setOfferOpen(false)} saved={async () => { setOfferOpen(false); notify("Availability registered"); await refresh(); }} />}
  </div>;
}

function AvailabilityModal({ close, saved }: { close: () => void; saved: () => Promise<void> }) {
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
      if (!response.ok) throw new Error(result.error || "Unable to register availability.");
      await saved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to register availability.");
    } finally {
      setSaving(false);
    }
  }
  const currentDate = dateKey(new Date());
  return <div className="adminModalBackdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) close(); }}><div className="adminModal workforceModal"><header><div><span className="adminEyebrow">Preferred working time</span><h2>Register availability</h2></div><button type="button" onClick={close}>×</button></header><form className="workforceForm" onSubmit={submit}><label>Date<input name="date" type="date" min={currentDate} defaultValue={currentDate} required /></label><label>Start time<input name="startTime" type="time" defaultValue="09:00" required /></label><label>End time<input name="endTime" type="time" defaultValue="17:00" required /></label><label className="wide">Note<textarea name="note" rows={4} maxLength={500} placeholder="Optional availability note" /></label><div className="workforceFormNote wide"><strong>This is availability, not a published shift.</strong><span>Managers can see overlapping employee availability and decide who to schedule.</span></div>{error && <div className="adminLoginError wide">{error}</div>}<div className="adminFormActions wide"><button className="adminSecondary" type="button" onClick={close}>Cancel</button><button className="adminPrimary" type="submit" disabled={saving}>{saving ? "Submitting…" : "Register availability"}</button></div></form></div></div>;
}
