"use client";

import { useState } from "react";
import { useSiteData } from "@/components/SiteDataProvider";

type FormState = "idle" | "sending" | "sent";

export function ContactSection() {
  const { content } = useSiteData();
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formState === "sending") return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setFormState("sending");
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          subject: data.get("subject"),
          message: data.get("message"),
          company: data.get("company"),
        }),
      });
      const result = (await response.json()) as { received?: boolean; error?: string };
      if (!response.ok || !result.received) throw new Error(result.error || "Unable to send your message.");
      form.reset();
      setFormState("sent");
    } catch (submitError) {
      setFormState("idle");
      setError(submitError instanceof Error ? submitError.message : "Unable to send your message.");
    }
  }

  return <section className="contactSection" id="contact">
    <div className="contactInner">
      <div className="contactIntro">
        <span className="sectionLabel">Contact us</span>
        <h2>We’d love to hear from you.</h2>
        <p>Questions about an order, catering, or something on the menu? Send us a message and our team will get back to you.</p>
        <div className="contactInfoGrid">
          <a href={`mailto:${content.email}`}><span>Email</span><strong>{content.email}</strong></a>
          <a href={`tel:${content.phone.replace(/[^+\d]/g, "")}`}><span>Phone</span><strong>{content.phone}</strong></a>
          <div><span>Response time</span><strong>Usually within one business day</strong></div>
        </div>
      </div>

      <form className="contactForm" onSubmit={submit}>
        <div className="contactFormHeading"><span>Send a message</span><strong>How can we help?</strong></div>
        <div className="contactFormGrid">
          <label>Name <span>*</span><input name="name" type="text" minLength={2} maxLength={100} autoComplete="name" required /></label>
          <label>Email <span>*</span><input name="email" type="email" maxLength={254} autoComplete="email" required /></label>
          <label>Phone <small>Optional</small><input name="phone" type="tel" maxLength={30} autoComplete="tel" /></label>
          <label>Subject <span>*</span><select name="subject" defaultValue="General question" required><option>General question</option><option>Order support</option><option>Catering</option><option>Feedback</option><option>Other</option></select></label>
          <label className="wide">Message <span>*</span><textarea name="message" minLength={10} maxLength={2000} rows={6} required placeholder="Tell us how we can help…" /></label>
          <label className="contactHoneypot" aria-hidden="true">Company<input name="company" type="text" tabIndex={-1} autoComplete="off" /></label>
        </div>
        {error && <div className="contactFormError" role="alert">{error}</div>}
        {formState === "sent" && <div className="contactFormSuccess" role="status"><span>✓</span><div><strong>Message sent</strong><small>Thanks for reaching out. We’ll get back to you soon.</small></div></div>}
        <button className="button primary contactSubmit" type="submit" disabled={formState === "sending"}>{formState === "sending" ? "Sending…" : "Send Message"}</button>
        <small className="contactPrivacy">Your contact details are used only to respond to this message.</small>
      </form>
    </div>
  </section>;
}
