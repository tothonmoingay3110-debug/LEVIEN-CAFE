import AccountAuthForm from "@/components/account/AccountAuthForm";
import AuthPageShell from "@/components/account/AuthPageShell";

export default function ResetPasswordPage() {
  return <AuthPageShell><AccountAuthForm mode="reset" /></AuthPageShell>;
}
