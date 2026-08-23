"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useCustomerSession } from "@/components/CustomerSessionProvider";
import PasswordInput from "@/components/PasswordInput";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "sign-in" | "sign-up" | "forgot" | "reset";

const modeContent: Record<AuthMode, { eyebrow: string; title: string; text: string; submit: string }> = {
  "sign-in": { eyebrow: "Welcome back", title: "Sign in to LEVIEN", text: "View orders, rewards, Gift Cards and your member card.", submit: "Sign In" },
  "sign-up": { eyebrow: "LEVIEN membership", title: "Create your account", text: "Your verified email safely connects eligible past and future orders.", submit: "Create Account" },
  forgot: { eyebrow: "Account recovery", title: "Reset your password", text: "We will send a secure recovery link if the email is registered.", submit: "Send Reset Link" },
  reset: { eyebrow: "Choose a new password", title: "Secure your account", text: "Use at least 8 characters with uppercase, lowercase, a number and a symbol.", submit: "Save New Password" },
};

function strongPassword(value: string) {
  return value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export default function AccountAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const { refresh } = useCustomerSession();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const content = modeContent[mode];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    setError("");
    setMessage("");

    if (mode === "sign-up" || mode === "reset") {
      if (!strongPassword(password)) return setError("Use at least 8 characters with uppercase, lowercase, a number and a symbol.");
      if (password !== confirmation) return setError("Passwords do not match.");
    }
    if (mode === "sign-up" && (!firstName || !lastName)) return setError("First and last name are required.");

    setSaving(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      if (mode === "sign-in") {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        await refresh();
        router.replace("/account");
        router.refresh();
      } else if (mode === "sign-up") {
        const result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=/account`,
            data: {
              account_type: "customer",
              first_name: firstName,
              last_name: lastName,
              phone,
              marketing_opt_in: form.get("marketingOptIn") === "on",
            },
          },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          await refresh();
          router.replace("/account");
          router.refresh();
        } else {
          setMessage("Account created. Check your email and open the verification link to activate membership.");
        }
      } else if (mode === "forgot") {
        const result = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${origin}/auth/callback?next=/account/reset-password`,
        });
        if (result.error) throw result.error;
        setMessage("If this email is registered, a password reset link is on the way.");
      } else {
        const result = await supabase.auth.updateUser({ password });
        if (result.error) throw result.error;
        setMessage("Password updated. Redirecting to your account…");
        await refresh();
        window.setTimeout(() => router.replace("/account"), 700);
      }
    } catch (authError) {
      const detail = authError instanceof Error ? authError.message : "Unable to complete this request.";
      setError(mode === "sign-in" ? "Incorrect email or password." : detail);
    } finally {
      setSaving(false);
    }
  }

  return <section className="customerAuthCard">
    <div className="customerAuthIntro">
      <span className="sectionLabel">{content.eyebrow}</span>
      <h1>{content.title}</h1>
      <p>{content.text}</p>
    </div>
    <form onSubmit={submit} className="customerAuthForm">
      {mode === "sign-up" && <div className="customerAuthSplit">
        <label><span>First name</span><input name="firstName" autoComplete="given-name" maxLength={100} required /></label>
        <label><span>Last name</span><input name="lastName" autoComplete="family-name" maxLength={100} required /></label>
      </div>}
      {mode !== "reset" && <label><span>Email address</span><input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
      {mode === "sign-up" && <label><span>Phone <small>Optional</small></span><input name="phone" type="tel" autoComplete="tel" maxLength={30} /></label>}
      {(mode === "sign-in" || mode === "sign-up" || mode === "reset") && <label><span>{mode === "reset" ? "New password" : "Password"}</span><PasswordInput name="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={mode === "sign-in" ? undefined : 8} required /></label>}
      {(mode === "sign-up" || mode === "reset") && <label><span>Confirm password</span><PasswordInput name="confirmation" autoComplete="new-password" minLength={8} required /></label>}
      {mode === "sign-up" && <label className="customerAuthConsent"><input name="marketingOptIn" type="checkbox" /><span>Send me occasional LEVIEN offers. Account and order emails are always sent when required.</span></label>}
      {error && <div className="customerAuthError" role="alert">{error}</div>}
      {message && <div className="customerAuthSuccess" role="status">{message}</div>}
      <button className="button primary full" type="submit" disabled={saving}>{saving ? "Please wait…" : content.submit}</button>
    </form>
    <div className="customerAuthLinks">
      {mode === "sign-in" && <><Link href="/account/forgot-password">Forgot password?</Link><span>New here? <Link href="/account/sign-up">Create an account</Link></span></>}
      {mode === "sign-up" && <span>Already a member? <Link href="/account/sign-in">Sign in</Link></span>}
      {(mode === "forgot" || mode === "reset") && <Link href="/account/sign-in">Back to sign in</Link>}
    </div>
  </section>;
}
