"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { useSiteData } from "@/components/SiteDataProvider";

export function MenuExplorer() {
  const { products, categories } = useSiteData();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const menuCategories = ["All", ...categories.map((item) => item.name)];

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const requested = parameters.get("category");
    const requestedQuery = parameters.get("q");
    if (requested && menuCategories.includes(requested)) {
      setCategory(requested);
    }
    if (requestedQuery !== null) setQuery(requestedQuery);
    if (requested || requestedQuery) requestAnimationFrame(() => document.querySelector(".menuTools")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [categories.length]);

  useEffect(() => {
    const search = (event: Event) => setQuery(String((event as CustomEvent<string>).detail || ""));
    window.addEventListener("levien-menu-search", search);
    return () => window.removeEventListener("levien-menu-search", search);
  }, []);

  const filtered = useMemo(() => products
    .filter((product) => (category === "All" || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => {
      const priority = (badges: typeof left.badges) => badges.includes("new") ? 0 : badges.includes("best-seller") ? 1 : badges.includes("must-try") ? 2 : 3;
      return priority(left.badges) - priority(right.badges);
    }), [products, category, query]);
  return (
    <>
      <div className="menuTools"><label className="menuSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search coffee, milk tea, food..." /></label><span className="menuResultCount">{filtered.length} items</span></div>
      <div className="menuCategoryTabs">{menuCategories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {filtered.length ? <div className="productGrid menuProductGrid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="noResults"><span>☕</span><h2>No items found</h2><p>Try a different search or category.</p></div>}
    </>
  );
}
