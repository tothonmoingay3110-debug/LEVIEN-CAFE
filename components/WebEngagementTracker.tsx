"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { moduleFromLocation, recordWebEngagement } from "@/lib/web-engagement";

export function WebEngagementTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const moduleKey = moduleFromLocation(pathname);
    if (moduleKey) recordWebEngagement("page_view", moduleKey);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (location.pathname.startsWith("/admin")) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!anchor || anchor.hasAttribute("download")) return;
      try {
        const url = new URL(anchor.getAttribute("href") || "", location.href);
        if (url.origin !== location.origin) return;
        const moduleKey = moduleFromLocation(url.pathname, url.hash);
        if (moduleKey) recordWebEngagement("module_click", moduleKey);
      } catch {
        // Ignore malformed links; navigation should continue normally.
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
