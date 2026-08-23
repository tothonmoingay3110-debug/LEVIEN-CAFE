export type BusinessRange = { from: string; to: string; days: number };

export type BusinessIntelligenceData = {
  range: BusinessRange;
  kpis: {
    revenue: number;
    completedOrders: number;
    averageOrderValue: number;
    itemsSold: number;
    bestSeller: { name: string; quantity: number } | null;
    lowSeller: { name: string; quantity: number } | null;
    newCustomers: number;
    returningCustomers: number;
    activePromotions: number;
  };
  trend: { date: string; revenue: number; orders: number }[];
  customers: {
    id: string;
    name: string;
    email: string;
    phone: string;
    orders: number;
    spent: number;
    averageOrder: number;
    firstOrder: string;
    lastOrder: string;
    favoriteProduct: string;
    favoriteQuantity: number;
    frequencyDays: number | null;
    segment: "New" | "Returning" | "Loyal" | "VIP";
  }[];
  segments: { name: "New" | "Returning" | "Loyal" | "VIP"; customers: number; revenue: number }[];
  products: {
    id: string;
    name: string;
    category: string;
    quantity: number;
    standaloneQuantity: number;
    comboQuantity: number;
    standaloneRevenue: number;
    orderCount: number;
    status: "Best seller" | "Steady" | "Slow mover";
    active: boolean;
  }[];
  toppings: { name: string; quantity: number; revenue: number; orderCount: number }[];
  combos: {
    id: string;
    name: string;
    quantity: number;
    revenue: number;
    orderCount: number;
    regularPrice: number;
    comboPrice: number;
    savingsPerCombo: number;
    customerSavings: number;
    active: boolean;
  }[];
  promotions: {
    id: string;
    title: string;
    impressions: number;
    clicks: number;
    clickThroughRate: number;
    attributedOrders: number;
    attributedRevenue: number;
    active: boolean;
  }[];
  forecast: { next7DaysRevenue: number; expectedOrders: number; averageDailyRevenue: number };
  insights: {
    id: string;
    tone: "positive" | "watch" | "opportunity" | "info";
    title: string;
    message: string;
    evidence: string;
    action: string;
  }[];
};
