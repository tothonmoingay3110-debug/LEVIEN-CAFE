import AccountAuthForm from "@/components/account/AccountAuthForm";
import AuthPageShell from "@/components/account/AuthPageShell";

export default function SignInPage() {
  return <AuthPageShell><AccountAuthForm mode="sign-in" /></AuthPageShell>;
}
