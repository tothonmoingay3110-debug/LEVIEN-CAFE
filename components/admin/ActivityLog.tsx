"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { staffRoleLabels, type StaffRole } from "@/lib/staff-permissions";

type ActivityEvent = {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: StaffRole | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: unknown;
  createdAt: string;
};

function initials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LV";
}

function actionLabel(action: string) {
  return action.split(".").map((part) => part.replaceAll("_", " ")).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" · ");
}

export default function ActivityLog() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/activity?limit=200", { cache: "no-store" });
      const result = (await response.json()) as { events?: ActivityEvent[]; error?: string };
      if (!response.ok || !result.events) throw new Error(result.error || "Unable to load activity history.");
      setEvents(result.events);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load activity history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const entityTypes = useMemo(() => [...new Set(events.map((event) => event.entityType))].sort(), [events]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return events.filter((event) => (filter === "all" || event.entityType === filter) && (!term || event.actorName.toLowerCase().includes(term) || event.summary.toLowerCase().includes(term) || event.action.toLowerCase().includes(term)));
  }, [events, filter, query]);

  return <div className="adminStack activityWorkspace">
    <section className="adminWelcome activityWelcome"><div><span>Owner & Manager audit</span><h2>Know who changed the staff schedule.</h2><p>Append-only operational events support accountability without tracking attendance.</p></div><button className="adminPrimary" type="button" onClick={() => void refresh()} disabled={loading}>{loading ? "Refreshing…" : "Refresh activity"}</button></section>
    <section className="activityMetrics"><div className="adminMetric"><span>Recent events</span><strong>{events.length}</strong><small>Latest 200 records</small></div><div className="adminMetric"><span>Schedule actions</span><strong>{events.filter((event) => event.entityType === "shift" || event.entityType === "schedule").length}</strong><small>Create, update, cancel and copy</small></div><div className="adminMetric"><span>Coverage actions</span><strong>{events.filter((event) => event.action.startsWith("swap.")).length}</strong><small>Requests and reviews</small></div><div className="adminMetric"><span>Time-off actions</span><strong>{events.filter((event) => event.action.startsWith("time_off.")).length}</strong><small>Requests and reviews</small></div></section>
    <section className="adminToolbar activityToolbar"><div className="adminTabs"><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All<span>{events.length}</span></button>{entityTypes.map((type) => <button type="button" className={filter === type ? "active" : ""} onClick={() => setFilter(type)} key={type}>{type.replaceAll("_", " ")}<span>{events.filter((event) => event.entityType === type).length}</span></button>)}</div><div className="adminSearch activitySearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity…" /></div></section>
    {error && <div className="scheduleError"><strong>Activity unavailable</strong><span>{error}</span><button type="button" onClick={() => void refresh()}>Try again</button></div>}
    <section className="adminCard activityCard"><div className="adminCardHead"><div><span className="adminEyebrow">Operational history</span><h3>{filtered.length} events</h3></div><span className="adminHint">Newest first</span></div><div className="activityList">{filtered.map((event) => <article key={event.id}><span className="activityAvatar">{initials(event.actorName)}</span><div><strong>{event.actorName}</strong><small>{event.actorRole ? staffRoleLabels[event.actorRole] : "System"} · {new Date(event.createdAt).toLocaleString()}</small><p>{event.summary}</p></div><span className="activityAction">{actionLabel(event.action)}</span></article>)}{!filtered.length && <div className="workforceEmpty"><strong>{loading ? "Loading activity…" : "No matching activity"}</strong><span>New schedule, coverage and time-off actions will appear here.</span></div>}</div></section>
  </div>;
}
