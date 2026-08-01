"use client";

import { useSiteData } from "@/components/SiteDataProvider";

function embedUrl(address: string) {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

export function MapSection() {
  const { content } = useSiteData();
  return (
    <section className="locationSection" id="location">
      <div className="locationInner">
        <div className="locationCopy">
          <span className="sectionLabel lightLabel">Visit us</span>
          <h2>Good coffee is closer than you think.</h2>
          <div className="locationDetails">
            <div><span>Address</span><p>{content.address}</p></div>
            <div><span>Phone</span><p>{content.phone}</p></div>
            <div><span>Hours</span><p>{content.hours}</p></div>
          </div>
          <a className="button gold" target="_blank" rel="noreferrer" href={content.mapUrl}>Get Directions</a>
        </div>
        <div className="mapFrame">
          <iframe title={`${content.storeName} location`} src={embedUrl(content.address)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </div>
    </section>
  );
}
