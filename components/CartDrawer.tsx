"use client";

import Link from "next/link";
import { useStore } from "@/components/StoreProvider";

export function CartDrawer() {
  const { cart, cartOpen, subtotal, closeCart, changeQuantity, removeItem } = useStore();
  return (
    <div className={`cartOverlay ${cartOpen ? "open" : ""}`} aria-hidden={!cartOpen}>
      <button className="cartBackdrop" onClick={closeCart} aria-label="Close order drawer" />
      <aside className="cartDrawer" aria-label="My order">
        <div className="cartDrawerHeader"><div><span className="sectionLabel">Your selection</span><h2>My Order</h2></div><button className="drawerClose" onClick={closeCart} aria-label="Close">×</button></div>
        <div className="cartDrawerBody">
          {cart.length === 0 ? <div className="emptyCart"><span>☕</span><h3>Your order is empty</h3><p>Explore the menu and add something delicious.</p><Link className="button primary" href="/menu" onClick={closeCart}>Explore Menu</Link></div> : cart.map((item) => (
            <article className={`cartLine ${item.itemType === "combo" ? "comboCartLine" : ""}`} key={item.lineId}>
              <div className="cartLineIcon">{item.itemType === "combo" ? "🎁" : item.emoji}</div>
              <div className="cartLineInfo">
                <strong>{item.name}</strong>
                <span>${item.unitPrice.toFixed(2)} each</span>
                {item.itemType === "combo" && item.comboItems?.length ? <div className="cartComboItems">
                  {item.comboItems.map((comboItem) => <div key={comboItem.productId}>
                    <b>{comboItem.emoji} {comboItem.name}</b>
                    <div className="cartCustomization">
                      {comboItem.ice && <small>Ice: {comboItem.ice}</small>}
                      {comboItem.sugar && <small>Sugar: {comboItem.sugar}</small>}
                      {comboItem.toppings.map((topping) => <small key={topping.id}>+ {topping.name}</small>)}
                    </div>
                    {comboItem.note && <small className="cartNote">Note: {comboItem.note}</small>}
                  </div>)}
                </div> : <>
                  {(item.ice || item.sugar || item.toppings.length > 0) && <div className="cartCustomization">{item.ice && <small>Ice: {item.ice}</small>}{item.sugar && <small>Sugar: {item.sugar}</small>}{item.toppings.map((topping) => <small key={topping.id}>+ {topping.name}</small>)}</div>}
                  {item.note && <small className="cartNote">Note: {item.note}</small>}
                </>}
                <div className="quantityControl"><button onClick={() => changeQuantity(item.lineId, -1)}>−</button><b>{item.quantity}</b><button onClick={() => changeQuantity(item.lineId, 1)}>+</button></div>
              </div>
              <div className="cartLineEnd"><strong>${(item.unitPrice * item.quantity).toFixed(2)}</strong><button onClick={() => removeItem(item.lineId)}>Remove</button></div>
            </article>
          ))}
        </div>
        <div className="cartDrawerFooter"><div className="cartSubtotal"><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div><p>Taxes and any delivery fees are calculated at checkout.</p><Link className={`button primary full ${!cart.length ? "disabled" : ""}`} aria-disabled={!cart.length} href={cart.length ? "/checkout" : "#"} onClick={(event) => { if (!cart.length) event.preventDefault(); else closeCart(); }}>Continue to Checkout</Link></div>
      </aside>
    </div>
  );
}
