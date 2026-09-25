"use client";

import Link from "next/link";
import { useSiteData } from "@/components/SiteDataProvider";

export default function ScanLandingPage() {
  const { content } = useSiteData();

  return <main className="scanLandingPage">
    <section className="scanLandingCard">
      <div className={`scanLandingLogo ${content.logo ? "hasLogo" : ""}`}>
        {content.logo ? <img src={content.logo} alt={`${content.storeName} logo`} /> : <b>LV</b>}
      </div>
      <span className="eyebrow">Welcome to {content.storeName}</span>
      <h1>How can we help?</h1>
      <p>Choose an option below to plan your event or explore our catering menu.</p>
      <div className="scanLandingChoices">
        <Link href="/event-booking" className="scanChoice eventChoice">
          <span aria-hidden="true">◇</span>
          <div><strong>Book an Event</strong><small>Tell us about your celebration, meeting or private event.</small></div>
          <b aria-hidden="true">→</b>
        </Link>
        <Link href="/catering" className="scanChoice cateringChoice">
          <span aria-hidden="true">▦</span>
          <div><strong>View Catering Menu</strong><small>Browse catering trays, drinks and add-ons.</small></div>
          <b aria-hidden="true">→</b>
        </Link>
      </div>
      <small className="scanLandingAddress">{content.address}</small>
    </section>
  </main>;
}
