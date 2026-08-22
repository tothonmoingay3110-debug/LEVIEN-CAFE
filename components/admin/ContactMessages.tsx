"use client";

import { useEffect, useMemo, useState } from "react";

type ContactStatus = "new" | "in_progress" | "resolved" | "archived";
type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: ContactStatus;
  adminNote: string;
  handledBy: string | null;
  handledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const statusLabels: Record<ContactStatus, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  archived: "Archived",
};
const statuses = Object.keys(statusLabels) as ContactStatus[];

export default function ContactMessages({ notify }: { notify: (message: string) => void }) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"active" | "all" | ContactStatus>("active");
  const [savingId, setSavingId] = useState("");

  async function loadMessages(silent = false) {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/admin/contact-messages", { cache: "no-store" });
      const result = (await response.json()) as { messages?: ContactMessage[]; error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to load contact messages.");
      setMessages(result.messages || []);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load contact messages.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void loadMessages();
    const refresh = () => void loadMessages(true);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, []);

  const filteredMessages = useMemo(() => {
    const term = query.trim().toLowerCase();
    return messages.filter((item) => {
      const matchesFilter = filter === "all" || (filter === "active" ? item.status !== "archived" : item.status === filter);
      const matchesQuery = !term || `${item.name} ${item.email} ${item.phone} ${item.subject} ${item.message}`.toLowerCase().includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [filter, messages, query]);

  function editMessage(id: string, changes: Partial<ContactMessage>) {
    setMessages((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));
  }

  async function saveMessage(item: ContactMessage) {
    setSavingId(item.id);
    try {
      const response = await fetch("/api/admin/contact-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, status: item.status, adminNote: item.adminNote }),
      });
      const result = (await response.json()) as { message?: Partial<ContactMessage> & { id: string }; error?: string };
      if (!response.ok || !result.message) throw new Error(result.error || "Unable to save contact message.");
      editMessage(item.id, result.message);
      notify(`Message from ${item.name} updated`);
    } catch (saveError) {
      notify(saveError instanceof Error ? saveError.message : "Unable to save contact message");
    } finally {
      setSavingId("");
    }
  }

  const newCount = messages.filter((item) => item.status === "new").length;
  const progressCount = messages.filter((item) => item.status === "in_progress").length;
  const resolvedCount = messages.filter((item) => item.status === "resolved").length;

  return <div className="adminStack contactInbox">
    <section className="adminWelcome contactInboxWelcome"><div><span>Customer care</span><h2>Keep every conversation moving.</h2><p>Messages are private and available only to Owner and Manager accounts.</p></div><button className="adminPrimary" type="button" onClick={() => void loadMessages()} disabled={loading}>{loading ? "Loading…" : "Refresh inbox"}</button></section>
    <section className="adminMetrics contactInboxMetrics"><div className="adminMetric"><span>New</span><strong>{newCount}</strong><small>Waiting for review</small></div><div className="adminMetric"><span>In progress</span><strong>{progressCount}</strong><small>Being handled</small></div><div className="adminMetric"><span>Resolved</span><strong>{resolvedCount}</strong><small>Completed conversations</small></div><div className="adminMetric"><span>Total</span><strong>{messages.length}</strong><small>Latest 300 messages</small></div></section>
    <section className="adminToolbar contactInboxToolbar">
      <div className="adminSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, subject, or message…" /></div>
      <div className="adminTabs">{(["active", "new", "in_progress", "resolved", "archived", "all"] as const).map((item) => <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "active" ? "Active" : item === "all" ? "All" : statusLabels[item]}</button>)}</div>
    </section>
    {error && <div className="adminLoginError">{error}</div>}
    <section className="contactMessageList">
      {filteredMessages.map((item) => <article className={`contactMessageCard status-${item.status}`} key={item.id}>
        <header><div className="contactMessageAvatar">{item.name.trim().charAt(0).toUpperCase() || "?"}</div><div><span>{item.subject}</span><h3>{item.name}</h3><small>{new Date(item.createdAt).toLocaleString()}</small></div><b>{statusLabels[item.status]}</b></header>
        <div className="contactMessageDetails"><a href={`mailto:${item.email}`}>{item.email}</a>{item.phone && <a href={`tel:${item.phone.replace(/[^+\d]/g, "")}`}>{item.phone}</a>}</div>
        <p>{item.message}</p>
        <div className="contactMessageManage">
          <label>Status<select value={item.status} onChange={(event) => editMessage(item.id, { status: event.target.value as ContactStatus })}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label>
          <label>Internal note<textarea value={item.adminNote} maxLength={1000} rows={2} placeholder="Add a private follow-up note…" onChange={(event) => editMessage(item.id, { adminNote: event.target.value })} /></label>
          <button className="adminPrimary" type="button" disabled={savingId === item.id} onClick={() => void saveMessage(item)}>{savingId === item.id ? "Saving…" : "Save"}</button>
        </div>
      </article>)}
      {!loading && !filteredMessages.length && <div className="contactInboxEmpty"><span>✉</span><strong>No messages found</strong><p>New customer messages will appear here automatically.</p></div>}
    </section>
  </div>;
}
