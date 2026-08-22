import AccountAuthForm from "@/components/account/AccountAuthForm";
import AuthPageShell from "@/components/account/AuthPageShell";

export default function ForgotPasswordPage() {
  return <AuthPageShell><AccountAuthForm mode="forgot" /></AuthPageShell>;
}
