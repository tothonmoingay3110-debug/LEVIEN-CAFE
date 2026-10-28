"use client";

export const moduleNames: Record<string, string> = {
  home: "Home",
  menu: "Menu",
  combos: "Combos",
  story: "Our Story",
  location: "Location",
  "event-booking": "Book an Event",
  franchise: "Franchise",
  catering: "Catering",
  "gift-card": "Gift Cards",
  account: "Account",
  checkout: "Checkout",
};

export function moduleFromLocation(pathname: string, hash = "") {
  if (pathname === "/") {
    const section = hash.replace(/^#/, "");
    return section in moduleNames ? section : "home";
  }
  const firstSegment = pathname.split("/").filter(Boolean)[0] || "";
  return firstSegment in moduleNames ? firstSegment : null;
}

function sessionKey() {
  try {
    const saved = sessionStorage.getItem("levien-web-session");
    const lastSeen = Number(sessionStorage.getItem("levien-web-session-seen") || 0);
    if (saved && /^[\da-f-]{36}$/i.test(saved) && Date.now() - lastSeen < 30 * 60_000) {
      sessionStorage.setItem("levien-web-session-seen", String(Date.now()));
      return saved;
    }
    const key = crypto.randomUUID();
    sessionStorage.setItem("levien-web-session", key);
    sessionStorage.setItem("levien-web-session-seen", String(Date.now()));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function recordWebEngagement(eventType: "page_view" | "module_click" | "product_view" | "product_click", target: string) {
  const payload = eventType.startsWith("product_")
    ? { eventType, productId: target, sessionKey: sessionKey() }
    : { eventType, moduleKey: target, sessionKey: sessionKey() };
  void fetch("/api/web-engagement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
