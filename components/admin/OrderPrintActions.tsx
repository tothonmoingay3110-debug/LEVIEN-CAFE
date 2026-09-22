"use client";

import { useState } from "react";
import type { CartItem, CustomerOrder } from "@/types";

type StoreDetails = { storeName: string; address: string; phone: string };
type ReceiptSize = "80mm" | "58mm";
type LabelSize = "2x1" | "4x2";

const escapeHtml = (value: unknown) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const money = (value: number) => `$${Number(value || 0).toFixed(2)}`;
const options = (item: Pick<CartItem, "ice" | "sugar" | "toppings" | "note">) => [
  item.ice && `Ice ${item.ice}`,
  item.sugar && `Sugar ${item.sugar}`,
  ...(item.toppings || []).map((topping) => `+ ${topping.name}`),
  item.note && `Note: ${item.note}`,
].filter(Boolean).join(" · ");

function openPrintDocument(title: string, body: string, styles: string) {
  const popup = window.open("", "levien-print", "width=540,height=760");
  if (!popup) {
    window.alert("Please allow pop-ups for this site, then try printing again.");
    return;
  }
  popup.opener = null;
  popup.document.open();
  popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${styles}</style></head><body>${body}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),120));<\/script></body></html>`);
  popup.document.close();
}

function receiptRows(order: CustomerOrder) {
  return order.items.map((item) => {
    const childRows = item.comboItems?.map((child) => `<div class="child"><b>${escapeHtml(child.name)}</b>${options(child) ? `<small>${escapeHtml(options(child))}</small>` : ""}</div>`).join("") || "";
    return `<section class="item"><div class="line"><span>${item.quantity} × ${escapeHtml(item.name)}</span><b>${money(item.unitPrice * item.quantity)}</b></div>${options(item) ? `<small>${escapeHtml(options(item))}</small>` : ""}${childRows}</section>`;
  }).join("");
}

function printReceipt(order: CustomerOrder, store: StoreDetails, size: ReceiptSize) {
  const width = size === "58mm" ? "52mm" : "74mm";
  const body = `<main><header><h1>${escapeHtml(store.storeName)}</h1><p>${escapeHtml(store.address)}</p><p>${escapeHtml(store.phone)}</p></header><div class="rule"></div><section class="meta"><b>Order ${escapeHtml(order.id)}</b><span>${escapeHtml(new Date(order.createdAt).toLocaleString())}</span><span>${escapeHtml(order.type)} · ${escapeHtml(order.customer)}</span><span>${escapeHtml(order.phone)}</span>${order.pickupTime ? `<span>Pickup: ${escapeHtml(order.pickupTime)}</span>` : ""}</section><div class="rule"></div>${receiptRows(order)}<div class="rule"></div><section class="totals"><span>Subtotal <b>${money(order.subtotal)}</b></span>${order.promotionDiscount ? `<span>Promotion <b>−${money(order.promotionDiscount)}</b></span>` : ""}${order.loyaltyDiscount ? `<span>Reward <b>−${money(order.loyaltyDiscount)}</b></span>` : ""}<span>Tax <b>${money(order.tax)}</b></span>${order.deliveryFee ? `<span>Delivery <b>${money(order.deliveryFee)}</b></span>` : ""}<strong>Total <b>${money(order.total)}</b></strong><span>Payment <b>${escapeHtml(order.payment)}</b></span></section>${order.note ? `<div class="note"><b>Order note</b><p>${escapeHtml(order.note)}</p></div>` : ""}<footer>Thank you for choosing ${escapeHtml(store.storeName)}!</footer></main>`;
  openPrintDocument(`${order.id} receipt`, body, `@page{size:${size} auto;margin:3mm}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font:11px/1.35 Arial,sans-serif}main{width:${width};margin:0 auto}header{text-align:center}h1{margin:0 0 3px;font-size:18px}p{margin:2px 0}.rule{margin:7px 0;border-top:1px dashed #000}.meta{display:grid;gap:2px}.meta b{font-size:14px}.item{padding:4px 0}.line,.totals span,.totals strong{display:flex;justify-content:space-between;gap:8px}.item small,.child small{display:block;margin-top:2px}.child{margin:4px 0 0 10px}.totals{display:grid;gap:3px}.totals strong{margin-top:4px;font-size:15px}.note{margin-top:8px;padding:6px;border:1px solid #000}.note p{white-space:pre-wrap}footer{margin-top:10px;text-align:center;font-weight:700}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`);
}

type Label = { name: string; detail: string; note: string };

function orderLabels(order: CustomerOrder): Label[] {
  const labels: Label[] = [];
  order.items.forEach((item) => {
    for (let quantity = 0; quantity < item.quantity; quantity += 1) {
      if (item.itemType === "combo" && item.comboItems?.length) {
        item.comboItems.forEach((child) => labels.push({ name: child.name, detail: options(child), note: item.note || "" }));
      } else {
        labels.push({ name: item.name, detail: options(item), note: item.note || "" });
      }
    }
  });
  return labels;
}

function printLabels(order: CustomerOrder, storeName: string, size: LabelSize) {
  const labels = orderLabels(order);
  if (!labels.length) return;
  const dimensions = size === "2x1" ? { width: "2in", height: "1in", padding: "0.08in" } : { width: "4in", height: "2in", padding: "0.16in" };
  const body = labels.map((label, index) => `<article class="label"><header><b>${escapeHtml(storeName)}</b><strong>${escapeHtml(order.id)}</strong></header><div class="customer">${escapeHtml(order.customer)} · ${escapeHtml(order.type)}</div><h1>${escapeHtml(label.name)}</h1>${label.detail ? `<p>${escapeHtml(label.detail)}</p>` : ""}${label.note && !label.detail.includes(`Note: ${label.note}`) ? `<p class="note">Note: ${escapeHtml(label.note)}</p>` : ""}<footer>${index + 1}/${labels.length} · ${escapeHtml(new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</footer></article>`).join("");
  openPrintDocument(`${order.id} labels`, body, `@page{size:${dimensions.width} ${dimensions.height};margin:0}*{box-sizing:border-box}body{margin:0;color:#000;background:#fff;font-family:Arial,sans-serif}.label{position:relative;width:${dimensions.width};height:${dimensions.height};padding:${dimensions.padding};overflow:hidden;break-after:page;page-break-after:always;border:1px solid transparent}.label:last-child{break-after:auto;page-break-after:auto}header{display:flex;justify-content:space-between;gap:6px;border-bottom:1px solid #000;padding-bottom:3px;font-size:${size === "2x1" ? "7px" : "11px"}}.customer{margin-top:3px;font-size:${size === "2x1" ? "7px" : "11px"};font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}h1{margin:${size === "2x1" ? "3px 0 1px" : "8px 0 4px"};font-size:${size === "2x1" ? "12px" : "22px"};line-height:1.05}p{margin:1px 0;font-size:${size === "2x1" ? "7px" : "12px"};line-height:1.15}.note{font-weight:700}footer{position:absolute;right:${dimensions.padding};bottom:${dimensions.padding};font-size:${size === "2x1" ? "6px" : "9px"};font-weight:700}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}`);
}

export default function OrderPrintActions({ order, store }: { order: CustomerOrder; store: StoreDetails }) {
  const [receiptSize, setReceiptSize] = useState<ReceiptSize>("80mm");
  const [labelSize, setLabelSize] = useState<LabelSize>("2x1");
  return <section className="orderPrintActions" aria-label="Receipt and label printing">
    <div><label>Receipt size<select value={receiptSize} onChange={(event) => setReceiptSize(event.target.value as ReceiptSize)}><option value="80mm">80 mm</option><option value="58mm">58 mm</option></select></label><button className="adminSecondary" type="button" onClick={() => printReceipt(order, store, receiptSize)}>Print Receipt</button></div>
    <div><label>Label size<select value={labelSize} onChange={(event) => setLabelSize(event.target.value as LabelSize)}><option value="2x1">2 × 1 inch</option><option value="4x2">4 × 2 inch</option></select></label><button className="adminPrimary" type="button" onClick={() => printLabels(order, store.storeName, labelSize)}>Print Item Labels</button></div>
    <small>Uses the system print dialog. Select any installed USB, network, or Bluetooth receipt/label printer.</small>
  </section>;
}
