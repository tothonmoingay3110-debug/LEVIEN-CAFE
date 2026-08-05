import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type CountCardProps = {
  label: string;
  value: number;
};

function CountCard({ label, value }: CountCardProps) {
  return (
    <div style={styles.countCard}>
      <strong style={styles.countValue}>{value}</strong>
      <span style={styles.countLabel}>{label}</span>
    </div>
  );
}

export default async function SupabaseTestPage() {
  try {
    const supabase = await createClient();

    const [contentResult, categoryResult, productResult, toppingResult, promotionResult, comboResult] = await Promise.all([
      supabase
        .from("site_content")
        .select("store_name, tagline, address")
        .eq("singleton_key", "main")
        .maybeSingle(),
      supabase.from("categories").select("id", { count: "exact", head: true }),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("toppings").select("id", { count: "exact", head: true }),
      supabase.from("promotions").select("id", { count: "exact", head: true }),
      supabase.from("combos").select("id", { count: "exact", head: true }),
    ]);

    const firstError = [
      contentResult.error,
      categoryResult.error,
      productResult.error,
      toppingResult.error,
      promotionResult.error,
      comboResult.error,
    ].find(Boolean);

    if (firstError) throw firstError;

    const data = contentResult.data;

    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <span style={styles.badge}>Sprint 5.2</span>
          <h1 style={styles.title}>Catalog connected</h1>
          <p style={styles.success}>
            Website catalog and public RLS policies are working with Supabase.
          </p>

          <div style={styles.countGrid}>
            <CountCard label="Categories" value={categoryResult.count ?? 0} />
            <CountCard label="Products" value={productResult.count ?? 0} />
            <CountCard label="Toppings" value={toppingResult.count ?? 0} />
            <CountCard label="Promotions" value={promotionResult.count ?? 0} />
            <CountCard label="Combos" value={comboResult.count ?? 0} />
          </div>

          <dl style={styles.details}>
            <div><dt>Store</dt><dd>{data?.store_name ?? "LEVIEN CAFE"}</dd></div>
            <div><dt>Tagline</dt><dd>{data?.tagline ?? "CAFE & EATERY"}</dd></div>
            <div><dt>Address</dt><dd>{data?.address ?? "Not configured"}</dd></div>
          </dl>

          <div style={styles.actions}>
            <Link href="/menu" style={styles.link}>Open Supabase Menu</Link>
            <Link href="/" style={styles.secondaryLink}>Return to store</Link>
          </div>
        </section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Supabase error";

    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <span style={{ ...styles.badge, background: "#fee4e2", color: "#b42318" }}>
            Sprint 5.2 failed
          </span>
          <h1 style={styles.title}>Catalog connection failed</h1>
          <p style={styles.error}>{message}</p>
          <ol style={styles.steps}>
            <li>Run the Sprint 5.2 SQL migration in Supabase SQL Editor.</li>
            <li>Confirm both variables exist in <code>.env.local</code>.</li>
            <li>Restart the server with <code>npm.cmd run dev</code>.</li>
          </ol>
        </section>
      </main>
    );
  }
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#f7f4ed",
    color: "#14271f",
  },
  card: {
    width: "min(760px, 100%)",
    padding: 38,
    border: "1px solid #d9e1dc",
    borderRadius: 28,
    background: "white",
    boxShadow: "0 24px 70px rgba(20,78,56,.12)",
  },
  badge: {
    display: "inline-flex",
    padding: "7px 11px",
    borderRadius: 999,
    background: "#e4f5eb",
    color: "#12613e",
    fontWeight: 800,
    fontSize: 12,
    letterSpacing: ".08em",
    textTransform: "uppercase",
  },
  title: {
    margin: "18px 0 8px",
    fontSize: "clamp(34px, 6vw, 58px)",
    lineHeight: 1,
    fontFamily: "Georgia, serif",
  },
  success: { color: "#12613e", fontWeight: 700, fontSize: 17 },
  error: {
    padding: 14,
    borderRadius: 12,
    background: "#fff4f2",
    color: "#b42318",
    overflowWrap: "anywhere",
  },
  countGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: 12,
    margin: "28px 0",
  },
  countCard: {
    display: "grid",
    gap: 4,
    padding: 16,
    borderRadius: 16,
    background: "#f5faf7",
    border: "1px solid #d8e9df",
  },
  countValue: { fontSize: 28, color: "#14573f" },
  countLabel: { fontSize: 13, color: "#617069", fontWeight: 700 },
  details: { display: "grid", gap: 12, margin: "28px 0" },
  steps: { display: "grid", gap: 12, paddingLeft: 22, lineHeight: 1.6 },
  actions: { display: "flex", flexWrap: "wrap", gap: 10 },
  link: {
    display: "inline-flex",
    padding: "12px 18px",
    borderRadius: 12,
    background: "#14573f",
    color: "white",
    textDecoration: "none",
    fontWeight: 800,
  },
  secondaryLink: {
    display: "inline-flex",
    padding: "12px 18px",
    borderRadius: 12,
    border: "1px solid #cbd8d1",
    color: "#14573f",
    textDecoration: "none",
    fontWeight: 800,
  },
};
