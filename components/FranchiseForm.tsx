"use client";

import { useState } from "react";

export function FranchiseForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setState("sending"); setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = Object.fromEntries(data.entries()) as Record<string, unknown>;
    payload.products = data.getAll("products");
    try {
      const response = await fetch("/api/franchise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send your franchise inquiry.");
      form.reset(); setState("sent");
    } catch (cause) { setState("idle"); setError(cause instanceof Error ? cause.message : "Unable to send your franchise inquiry."); }
  }
  return <form className="contactForm franchiseForm" onSubmit={submit}>
    <div className="contactFormHeading"><span>Franchise message</span><strong>Tell us about your plan</strong></div>
    <div className="contactFormGrid">
      <label>Full name *<input name="name" required maxLength={100} autoComplete="name" /></label>
      <label>Phone number *<input name="phone" required type="tel" maxLength={30} autoComplete="tel" /></label>
      <label>Email <small>Optional</small><input name="email" type="email" maxLength={254} autoComplete="email" /></label>
      <label>Proposed location *<input name="location" required maxLength={180} placeholder="City, state, or neighborhood" /></label>
      <label>Franchise model *<select name="franchiseModel" required defaultValue=""><option value="" disabled>Select a model</option><option>Café / dine-in shop</option><option>Takeaway / express shop</option><option>Food truck</option><option>Mobile cart / trailer</option><option>Kiosk</option><option>Shop-in-shop / food court</option><option>Drive-thru</option></select></label>
      <fieldset className="franchiseProducts"><legend>Products of interest *</legend><label><input type="checkbox" name="products" value="Bánh mì" /> Bánh mì</label><label><input type="checkbox" name="products" value="Coffee" /> Coffee</label></fieldset>
      <label className="wide">Message <small>Optional</small><textarea name="message" maxLength={2000} placeholder="Anything else you would like us to know?" /></label>
      <label className="contactHoneypot" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off" /></label>
    </div>
    {error && <div className="contactFormError" role="alert">{error}</div>}
    {state === "sent" && <div className="contactFormSuccess" role="status"><span>✓</span><div><strong>Inquiry received</strong><small>The LEVIEN team will contact you soon.</small></div></div>}
    <button className="button primary contactSubmit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send Franchise Inquiry"}</button>
    <small className="contactPrivacy">Your details are used only to evaluate and respond to this franchise inquiry.</small>
  </form>;
}
