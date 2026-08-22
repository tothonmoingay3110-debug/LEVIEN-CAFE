import type { Metadata } from "next";
import "./globals.css";
import { StoreProvider } from "@/components/StoreProvider";
import { CartDrawer } from "@/components/CartDrawer";
import { SiteDataProvider } from "@/components/SiteDataProvider";
import { CustomerSessionProvider } from "@/components/CustomerSessionProvider";

export const metadata: Metadata = { title: "LEVIEN CAFE | Philadelphia", description: "Vietnamese coffee, handcrafted drinks and fresh food in Philadelphia." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><CustomerSessionProvider><SiteDataProvider><StoreProvider>{children}<CartDrawer /></StoreProvider></SiteDataProvider></CustomerSessionProvider></body></html>;
}
