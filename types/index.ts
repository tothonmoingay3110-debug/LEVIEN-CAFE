export type ProductBadge = "best-seller" | "must-try" | "featured" | "new";

export type ProductTopping = {
  id: string;
  name: string;
  price: number;
  image?: string;
};

export type Product = {
  id: string;
  categoryId?: string;
  name: string;
  vietnameseName?: string;
  description: string;
  price: number;
  category: string;
  image: string;
  emoji: string;
  badges: ProductBadge[];
  soldOut?: boolean;
  allowIce?: boolean;
  allowSugar?: boolean;
  allowToppings?: boolean;
  toppings?: ProductTopping[];
};

export type Combo = {
  id: string;
  name: string;
  description: string;
  price: number;
  productIds: string[];
  image: string;
  active: boolean;
};

export type Promotion = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  priceText: string;
  image: string;
  mobileImage?: string;
  displayMode?: "designed" | "full_image";
  linkUrl?: string;
  startDate?: string;
  endDate?: string | null;
};

export type ProductSelection = {
  quantity?: number;
  ice?: string;
  sugar?: string;
  toppings?: ProductTopping[];
  note?: string;
};

export type ComboProductSelection = {
  productId: string;
  name: string;
  emoji: string;
  ice?: string;
  sugar?: string;
  toppings: ProductTopping[];
  note?: string;
};

export type CartItem = {
  lineId: string;
  itemType?: "product" | "combo";
  productId: string;
  comboId?: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  quantity: number;
  emoji: string;
  ice?: string;
  sugar?: string;
  toppings: ProductTopping[];
  note?: string;
  comboItems?: ComboProductSelection[];
};

export type OrderStatus = "Pending Payment" | "New" | "Preparing" | "Ready" | "Completed" | "Cancelled";
export type FulfillmentType = "Pickup" | "Delivery";

export type CustomerOrder = {
  id: string;
  trackingToken?: string;
  customer: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  type: FulfillmentType;
  pickupTime?: string;
  address?: string;
  city?: string;
  zip?: string;
  apartment?: string;
  payment: string;
  paymentStatus?: "unpaid" | "pending" | "paid" | "failed" | "expired" | "refunded";
  paymentProvider?: "offline" | "stripe" | "gift_card" | "mixed";
  giftCardAmount?: number;
  giftCardLastFour?: string;
  amountDue?: number;
  loyaltyDiscount?: number;
  loyaltyRewardId?: string;
  salesPromotionId?: string;
  salesPromotionName?: string;
  promotionDiscount?: number;
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  status: OrderStatus;
  createdAt: string;
  note: string;
  items: CartItem[];
};
