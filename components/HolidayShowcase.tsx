"use client";

import { useSiteData } from "@/components/SiteDataProvider";
import { type HolidayTheme } from "@/lib/holiday-theme";

const scenes: Partial<Record<HolidayTheme, { kicker: string; title: string; subtitle: string }>> = {
  christmas: { kicker: "THE HOLIDAY SEASON", title: "Merry Christmas", subtitle: "Warm wishes from the LEVIEN CAFE family." },
  "new-year": { kicker: "A FRESH START", title: "Happy New Year", subtitle: "Here's to new moments shared over coffee." },
  valentines: { kicker: "MADE WITH LOVE", title: "Happy Valentine's Day", subtitle: "Share something sweet with someone special." },
  easter: { kicker: "SPRING IS HERE", title: "Happy Easter", subtitle: "A little springtime joy from our cafe to you." },
  "independence-day": { kicker: "JULY FOURTH", title: "Happy Independence Day", subtitle: "Celebrating together in Philadelphia." },
  halloween: { kicker: "SPOOKY SEASON", title: "Happy Halloween", subtitle: "Come in for a treat. No tricks required." },
  thanksgiving: { kicker: "SEASON OF GRATITUDE", title: "Happy Thanksgiving", subtitle: "Thankful for every moment around the table." },
};

export function HolidayShowcase() {
  const { content } = useSiteData();
  const scene = scenes[content.holidayTheme];
  if (!scene) return null;

  return <section className="holidayShowcase" data-theme={content.holidayTheme} aria-label={scene.title}>
    <div className="holidayShowcaseText"><span>{scene.kicker}</span><h2>{scene.title}</h2><p>{scene.subtitle}</p></div>
    <img className="holidayShowcaseFigure" src={`/generated/holiday-scenes/${content.holidayTheme}.webp`} alt="" aria-hidden="true" fetchPriority="high" />
  </section>;
}
