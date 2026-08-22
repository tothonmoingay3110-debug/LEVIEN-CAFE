import AccountAuthForm from "@/components/account/AccountAuthForm";
import AuthPageShell from "@/components/account/AuthPageShell";

export default function SignUpPage() {
  return <AuthPageShell><AccountAuthForm mode="sign-up" /></AuthPageShell>;
}
