"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ComboCustomizer } from "@/components/ComboCustomizer";
import { useSiteData } from "@/components/SiteDataProvider";

function AutoDesignedProductImage({ src }: { src: string }) {
  const [shape, setShape] = useState<"portrait" | "landscape" | "square">("square");
  const [scale, setScale] = useState(1);

  return <img
    className={`comboAutoImage ${shape}`}
    src={src}
    alt=""
    crossOrigin="anonymous"
    style={{ "--combo-image-scale": scale } as CSSProperties}
    onLoad={(event) => {
      const image = event.currentTarget;
      let visibleWidth = image.naturalWidth;
      let visibleHeight = image.naturalHeight;
      try {
        const size = 128;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (context) {
          const fit = Math.min(size / image.naturalWidth, size / image.naturalHeight);
          const width = image.naturalWidth * fit;
          const height = image.naturalHeight * fit;
          const offsetX = (size - width) / 2;
          const offsetY = (size - height) / 2;
          context.drawImage(image, offsetX, offsetY, width, height);
          const pixels = context.getImageData(0, 0, size, size).data;
          let minX = size, minY = size, maxX = -1, maxY = -1;
          for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
            if (pixels[(y * size + x) * 4 + 3] > 20) {
              minX = Math.min(minX, x); minY = Math.min(minY, y);
              maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
            }
          }
          if (maxX >= minX && maxY >= minY) {
            visibleWidth = maxX - minX + 2;
            visibleHeight = maxY - minY + 2;
            const occupancy = Math.max(visibleWidth, visibleHeight) / size;
            setScale(Math.min(1.65, Math.max(1, 0.98 / Math.max(0.01, occupancy))));
          }
        }
      } catch { setScale(1); }
      const ratio = visibleWidth / Math.max(1, visibleHeight);
      setShape(ratio > 1.18 ? "landscape" : ratio < 0.82 ? "portrait" : "square");
    }}
  />;
}

export function ComboCard() {
  const { combos, products } = useSiteData();
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);
  const [comboIndex, setComboIndex] = useState(0);
  useEffect(() => {
    if (comboIndex >= combos.length) setComboIndex(0);
  }, [comboIndex, combos.length]);
  const combo = combos[comboIndex];
  const selectedCombo = combos.find((item) => item.id === selectedComboId);
  const comboProducts = useMemo(() => combo ? combo.productIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) : [], [combo, products]);
  if (!combo) return null;

  const regularPrice = comboProducts.reduce((sum, product) => sum + Number(product?.price || 0), 0);
  const unavailable = comboProducts.length !== combo.productIds.length || comboProducts.some((product) => product?.soldOut);
  const previous = () => setComboIndex((current) => (current - 1 + combos.length) % combos.length);
  const next = () => setComboIndex((current) => (current + 1) % combos.length);

  return <>
    <article className={`comboCard ${unavailable ? "comboSoldOut" : ""}`}>
      <div className="comboArt" aria-hidden="true">
        {comboProducts.length ? <div className={`comboShowcase count-${Math.min(2,comboProducts.length)}`}>{comboProducts.slice(0,2).map((product,index)=><div className="comboShowcaseItem" key={product!.id}>{index>0&&<span className="comboShowcasePlus">+</span>}<figure className="comboProductStage">{product!.image?<AutoDesignedProductImage src={product!.image}/>:<b>{product!.emoji}</b>}</figure></div>)}</div> : combo.image ? <img src={combo.image} alt="" /> : <span className="comboFallback">LEVIEN COMBO</span>}
      </div>
      <div className="comboCopy">
        <div className="comboCardTop"><span className="eyebrow darkText">Fixed combo</span>{combos.length > 1 && <div className="comboNavigation"><button type="button" onClick={previous} aria-label="Previous combo">Previous</button><span>{comboIndex + 1} / {combos.length}</span><button type="button" onClick={next} aria-label="Next combo">Next</button></div>}</div>
        <h2>{combo.name}</h2>
        <p>{combo.description}</p>
        {!!comboProducts.length && <div className="comboIncludes">{comboProducts.map((product) => <span key={product!.id}>{product!.emoji} {product!.name}</span>)}</div>}
        <div className="comboSavings"><span>Regular ${regularPrice.toFixed(2)}</span>{regularPrice > combo.price && <strong>Save ${(regularPrice - combo.price).toFixed(2)}</strong>}</div>
        <div className="comboBottom"><strong>${Number(combo.price).toFixed(2)}</strong><button className="button gold" disabled={unavailable} onClick={() => setSelectedComboId(combo.id)}>{unavailable ? "Unavailable" : "Customize Combo"}</button></div>
      </div>
    </article>
    {selectedCombo && <ComboCustomizer combo={selectedCombo} products={products} close={() => setSelectedComboId(null)} />}
  </>;
}
