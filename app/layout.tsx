import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/StoreProvider";
import { CartDrawer } from "@/components/CartDrawer";
import { SiteDataProvider } from "@/components/SiteDataProvider";
import { SalesPromotionProvider } from "@/components/SalesPromotionProvider";
import { CustomerSessionProvider } from "@/components/CustomerSessionProvider";

export const metadata: Metadata = { title: "LEVIEN CAFE | Philadelphia", description: "Vietnamese coffee, handcrafted drinks and fresh food in Philadelphia." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CustomerSessionProvider><SiteDataProvider><SalesPromotionProvider><StoreProvider>{children}<CartDrawer /></StoreProvider></SalesPromotionProvider></SiteDataProvider></CustomerSessionProvider></body></html>;
}
