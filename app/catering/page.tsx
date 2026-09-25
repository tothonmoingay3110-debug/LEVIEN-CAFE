"use client";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { useSiteData } from "@/components/SiteDataProvider";

export default function CateringPage() {
  const { products, ready } = useSiteData();
  const cateringProducts = products.filter((product) => product.category === "Catering Menu");

  return <>
    <Header />
    <main className="cateringPage">
      <section className="cateringHero">
        <span className="eyebrow">Catering by LEVIEN</span>
        <h1>Made for sharing.</h1>
        <p>Explore catering trays and large-format drinks for meetings, celebrations and special gatherings.</p>
        <a href="/event-booking" className="button primary">Book an Event</a>
      </section>
      <section className="section cateringCatalog">
        <div className="sectionHeading"><div><span className="sectionLabel">Catering menu</span><h2>Choose your favorites</h2></div><p>{cateringProducts.length} catering items currently available.</p></div>
        {!ready ? <div className="noResults"><h2>Loading catering menu…</h2></div> : cateringProducts.length
          ? <div className="productGrid menuProductGrid">{cateringProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          : <div className="noResults"><span>🍽️</span><h2>Catering menu coming soon</h2><p>Please contact our team for current catering options.</p></div>}
      </section>
    </main>
    <Footer />
  </>;
}
