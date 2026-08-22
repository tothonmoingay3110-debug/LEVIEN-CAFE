import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import CustomerAccountDashboard from "@/components/account/CustomerAccountDashboard";

export default function AccountPage() {
  return <><Header /><main className="accountPage"><CustomerAccountDashboard /></main><Footer /></>;
}
