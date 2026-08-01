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
    const requested = new URLSearchParams(window.location.search).get("category");
    if (requested && menuCategories.includes(requested)) {
      setCategory(requested);
      requestAnimationFrame(() => document.querySelector(".menuTools")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [categories.length]);

  const filtered = useMemo(() => products.filter((product) => (category === "All" || product.category === category) && `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase())), [products, category, query]);
  return (
    <>
      <div className="menuTools"><label className="menuSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search coffee, milk tea, food..." /></label><span className="menuResultCount">{filtered.length} items</span></div>
      <div className="menuCategoryTabs">{menuCategories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      {filtered.length ? <div className="productGrid menuProductGrid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="noResults"><span>☕</span><h2>No items found</h2><p>Try a different search or category.</p></div>}
    </>
  );
}
