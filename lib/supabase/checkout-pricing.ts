import type { CartItem, ComboProductSelection, ProductTopping } from "@/types";
import type { Database } from "@/types/database.types";
import type { createAdminClient } from "./admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ComboRow = Database["public"]["Tables"]["combos"]["Row"];
type ToppingRow = Database["public"]["Tables"]["toppings"]["Row"];
type ProductToppingRow = Database["public"]["Tables"]["product_toppings"]["Row"];
type ComboProductRow = Database["public"]["Tables"]["combo_products"]["Row"];

export class InvalidCheckoutCatalogError extends Error {}

const currency = (value: number) => Math.round(value * 100) / 100;
function invalid(message: string): never {
  throw new InvalidCheckoutCatalogError(message);
}

export async function validateAndPriceOrderItems(supabase: AdminClient, items: CartItem[]) {
  const productIds = [...new Set(items.flatMap((item) =>
    item.itemType === "combo"
      ? (item.comboItems || []).map((child) => child.productId)
      : [item.productId],
  ))];
  const comboIds = [...new Set(items.filter((item) => item.itemType === "combo").map((item) => item.comboId || ""))].filter(Boolean);
  const toppingIds = [...new Set(items.flatMap((item) => [
    ...item.toppings.map((topping) => topping.id),
    ...(item.comboItems || []).flatMap((child) => child.toppings.map((topping) => topping.id)),
  ]))];

  const productResult = await supabase
    .from("products")
    .select("id,name,price,emoji,active,sold_out,allow_ice,allow_sugar,allow_toppings")
    .in("id", productIds);
  if (productResult.error) throw productResult.error;
  const products = (productResult.data || []) as ProductRow[];

  let combos: ComboRow[] = [];
  let comboProducts: ComboProductRow[] = [];
  if (comboIds.length) {
    const [comboResult, comboProductResult] = await Promise.all([
      supabase.from("combos").select("id,name,price,active").in("id", comboIds),
      supabase.from("combo_products").select("combo_id,product_id,position").in("combo_id", comboIds).order("position"),
    ]);
    if (comboResult.error) throw comboResult.error;
    if (comboProductResult.error) throw comboProductResult.error;
    combos = (comboResult.data || []) as ComboRow[];
    comboProducts = (comboProductResult.data || []) as ComboProductRow[];
  }

  let toppings: ToppingRow[] = [];
  if (toppingIds.length) {
    const toppingResult = await supabase
      .from("toppings")
      .select("id,name,price,active")
      .in("id", toppingIds);
    if (toppingResult.error) throw toppingResult.error;
    toppings = (toppingResult.data || []) as ToppingRow[];
  }

  const productToppingResult = await supabase
    .from("product_toppings")
    .select("product_id,topping_id")
    .in("product_id", productIds);
  if (productToppingResult.error) throw productToppingResult.error;
  const productToppings = (productToppingResult.data || []) as ProductToppingRow[];

  const productMap = new Map(products.map((product) => [product.id, product]));
  const comboMap = new Map(combos.map((combo) => [combo.id, combo]));
  const toppingMap = new Map(toppings.map((topping) => [topping.id, topping]));
  const allowedToppings = new Map<string, Set<string>>();
  productToppings.forEach((link) => {
    const current = allowedToppings.get(link.product_id) || new Set<string>();
    current.add(link.topping_id);
    allowedToppings.set(link.product_id, current);
  });

  const canonicalizeProduct = (
    productId: string,
    selection: Pick<ComboProductSelection, "ice" | "sugar" | "toppings" | "note">,
  ): ComboProductSelection => {
    const product = productMap.get(productId);
    if (!product) invalid("A product is unavailable.");
    if (!product.active || product.sold_out) invalid("A product is unavailable.");
    if (selection.ice && !product.allow_ice) invalid("Ice customization is not available for this product.");
    if (selection.sugar && !product.allow_sugar) invalid("Sugar customization is not available for this product.");
    if (selection.toppings.length && !product.allow_toppings) invalid("Toppings are not available for this product.");

    const seen = new Set<string>();
    const canonicalToppings = selection.toppings.map<ProductTopping>((requested) => {
      if (seen.has(requested.id)) invalid("Duplicate topping selection.");
      seen.add(requested.id);
      const topping = toppingMap.get(requested.id);
      if (!topping) invalid("A topping is unavailable for this product.");
      if (!topping.active || !allowedToppings.get(productId)?.has(topping.id)) {
        invalid("A topping is unavailable for this product.");
      }
      return { id: topping.id, name: topping.name, price: Number(topping.price) };
    });

    return {
      productId: product.id,
      name: product.name,
      emoji: product.emoji,
      ice: selection.ice,
      sugar: selection.sugar,
      toppings: canonicalToppings,
      note: selection.note || "",
    };
  };

  return items.map<CartItem>((item) => {
    if (item.itemType !== "combo") {
      const product = canonicalizeProduct(item.productId, item);
      const productRow = productMap.get(product.productId)!;
      const toppingTotal = product.toppings.reduce((sum, topping) => sum + Number(topping.price), 0);
      return {
        ...item,
        itemType: "product",
        productId: product.productId,
        comboId: undefined,
        name: product.name,
        emoji: product.emoji,
        basePrice: Number(productRow.price),
        unitPrice: currency(Number(productRow.price) + toppingTotal),
        ice: product.ice,
        sugar: product.sugar,
        toppings: product.toppings,
        note: product.note,
        comboItems: undefined,
      };
    }

    const comboId = item.comboId || "";
    const combo = comboMap.get(comboId);
    if (!combo) invalid("This combo is unavailable.");
    if (!combo.active) invalid("This combo is unavailable.");
    if (item.toppings.length) invalid("Invalid combo topping selection.");

    const configuredProductIds = comboProducts
      .filter((link) => link.combo_id === comboId)
      .sort((left, right) => left.position - right.position)
      .map((link) => link.product_id);
    const selections = item.comboItems || [];
    if (configuredProductIds.length !== selections.length ||
        configuredProductIds.some((productId, index) => selections[index]?.productId !== productId)) {
      invalid("Combo items do not match the current menu.");
    }

    const canonicalSelections = selections.map((selection) => canonicalizeProduct(selection.productId, selection));
    const toppingTotal = canonicalSelections.reduce(
      (sum, selection) => sum + selection.toppings.reduce((itemSum, topping) => itemSum + Number(topping.price), 0),
      0,
    );
    return {
      ...item,
      itemType: "combo",
      productId: combo.id,
      comboId: combo.id,
      name: combo.name,
      basePrice: Number(combo.price),
      unitPrice: currency(Number(combo.price) + toppingTotal),
      toppings: [],
      comboItems: canonicalSelections,
    };
  });
}
