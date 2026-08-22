"use client";

import { CategoryCard } from "@/components/CategoryCard";
import { ComboCard } from "@/components/ComboCard";
import { ContactSection } from "@/components/ContactSection";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { MapSection } from "@/components/MapSection";
import { ProductCard } from "@/components/ProductCard";
import { PromotionSlider } from "@/components/PromotionSlider";
import { useSiteData } from "@/components/SiteDataProvider";

export default function HomePage() {
  const { products, categories, content } = useSiteData();
  return (
    <>
      <Header />
      <main id="home">
        <div className="heroWrap"><PromotionSlider /></div>

        <section className="section categorySection">
          <div className="sectionHeading compactHeading"><div><span className="sectionLabel">Find your favorite</span><h2>Browse by Category</h2></div><a className="textLink" href="/menu">View full menu →</a></div>
          <div className="categoryGrid">{categories.map((category) => <CategoryCard key={category.id} name={category.name} icon={category.icon} caption="Made fresh" />)}</div>
        </section>

        <section className="section" id="best-sellers">
          <div className="sectionHeading"><div><span className="sectionLabel">Customer favorites</span><h2>Best Sellers</h2></div><p>Handcrafted drinks and fresh food our guests return for again and again.</p></div>
          <div className="productGrid">{products.filter((item) => item.badges.includes("best-seller")).map((product) => <ProductCard product={product} key={product.id} />)}</div><div className="sectionCta"><a className="button primary" href="/menu">Explore Full Menu</a></div>
        </section>

        <section className="fullWidthSection mustTrySection">
          <div className="section mustTryInner">
            <div className="sectionHeading"><div><span className="sectionLabel">Signature picks</span><h2>Must Try at LEVIEN</h2></div><p>A short list of drinks that express our Vietnamese roots and playful modern style.</p></div>
            <div className="productGrid">{products.filter((item) => item.badges.includes("must-try")).map((product) => <ProductCard product={product} key={product.id} />)}</div>
          </div>
        </section>

        <section className="section" id="combos"><ComboCard /></section>

        <section className="section storySection" id="story">
          <div className="storyVisual">{content.aboutImage ? <img src={content.aboutImage} alt={content.aboutTitle} /> : <div className="storyArch"><span>FROM VIETNAM<br/>TO PHILADELPHIA</span><div className="storyCounter"><div className="storyCup">LV</div></div></div>}</div>
          <div className="storyCopy"><span className="sectionLabel">Our Story</span><h2>{content.aboutTitle}</h2><p>{content.aboutText}</p><a className="textLink" href="/#location">Come visit us →</a></div>
        </section>

        <ContactSection />
        <MapSection />
      </main>
      <Footer />
    </>
  );
}
