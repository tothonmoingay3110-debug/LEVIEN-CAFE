import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SupabaseTestPage() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_content")
      .select("store_name, tagline, address, updated_at")
      .eq("singleton_key", "main")
      .maybeSingle();

    if (error) throw error;

    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <span style={styles.badge}>Sprint 5.1</span>
          <h1 style={styles.title}>Supabase connected</h1>
          <p style={styles.success}>Database connection and public RLS policy are working.</p>
          <dl style={styles.details}>
            <div><dt>Store</dt><dd>{data?.store_name ?? "LEVIEN CAFE"}</dd></div>
            <div><dt>Tagline</dt><dd>{data?.tagline ?? "CAFE & EATERY"}</dd></div>
            <div><dt>Address</dt><dd>{data?.address ?? "Not configured"}</dd></div>
          </dl>
          <Link href="/" style={styles.link}>Return to store</Link>
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error";
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <span style={{ ...styles.badge, background: "#fee4e2", color: "#b42318" }}>Connection failed</span>
          <h1 style={styles.title}>Supabase needs one more step</h1>
          <p style={styles.error}>{message}</p>
          <ol style={styles.steps}>
            <li>Run the Sprint 5.1 SQL file in Supabase SQL Editor.</li>
            <li>Confirm both variables exist in <code>.env.local</code>.</li>
            <li>Restart the server with <code>npm.cmd run dev</code>.</li>
          </ol>
        </section>
      </main>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#f7f4ed", color: "#14271f" },
  card: { width: "min(680px, 100%)", padding: 38, border: "1px solid #d9e1dc", borderRadius: 28, background: "white", boxShadow: "0 24px 70px rgba(20,78,56,.12)" },
  badge: { display: "inline-flex", padding: "7px 11px", borderRadius: 999, background: "#e4f5eb", color: "#12613e", fontWeight: 800, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" },
  title: { margin: "18px 0 8px", fontSize: "clamp(34px, 6vw, 58px)", lineHeight: 1, fontFamily: "Georgia, serif" },
  success: { color: "#12613e", fontWeight: 700, fontSize: 17 },
  error: { padding: 14, borderRadius: 12, background: "#fff4f2", color: "#b42318", overflowWrap: "anywhere" },
  details: { display: "grid", gap: 12, margin: "28px 0" },
  steps: { display: "grid", gap: 12, paddingLeft: 22, lineHeight: 1.6 },
  link: { display: "inline-flex", padding: "12px 18px", borderRadius: 12, background: "#14573f", color: "white", textDecoration: "none", fontWeight: 800 },
};
