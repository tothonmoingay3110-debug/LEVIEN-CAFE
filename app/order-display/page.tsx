import type { Metadata } from "next";
import { OrderDisplayBoard } from "@/components/OrderDisplayBoard";

export const metadata: Metadata = {
  title: "Live Order Status | LEVIEN CAFE",
  description: "Live pickup order status for LEVIEN CAFE.",
  robots: { index: false, follow: false },
};

export default function OrderDisplayPage() {
  return <OrderDisplayBoard />;
}
