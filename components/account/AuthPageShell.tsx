import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function AuthPageShell({ children }: { children: React.ReactNode }) {
  return <><Header /><main className="customerAuthPage"><div className="customerAuthBackdrop"><span>LV</span><strong>Good coffee.<br />Better rewards.</strong><small>LEVIEN CAFE MEMBERSHIP</small></div>{children}</main><Footer /></>;
}

