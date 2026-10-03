import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "levien-cafe",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-03",
    compatibilityFlags: ["nodejs_compat"],
    assets: { notFoundHandling: "none" },
    env: {
      ASSETS: bindings.assets(),
      NEXT_PUBLIC_SITE_URL: bindings.text("https://leviencafe.com"),
      NEXT_PUBLIC_SUPABASE_URL: bindings.text("https://hvlsahxqfdinvgosegmo.supabase.co"),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: bindings.text("sb_publishable_CW9aPggAnmGNEqAq-aOlog_tHKa5BOq"),
      NEXT_PUBLIC_ENABLE_ONLINE_GIFT_CARD_PURCHASE: bindings.text("false"),
      NEXT_PUBLIC_ENABLE_ONLINE_ORDER_PAYMENT: bindings.text("false"),
    },
  }),
});
