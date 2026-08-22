"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomerProfileView } from "@/types/account";

type CustomerSessionContextValue = {
  loading: boolean;
  authenticated: boolean;
  profile: CustomerProfileView | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfileView | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/account/session", { cache: "no-store" });
      const result = (await response.json()) as { authenticated?: boolean; profile?: CustomerProfileView | null };
      setProfile(response.ok && result.authenticated ? result.profile || null : null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => void refresh(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(() => ({
    loading,
    authenticated: Boolean(profile),
    profile,
    refresh,
    signOut,
  }), [loading, profile, refresh, signOut]);

  return <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomerSession() {
  const context = useContext(CustomerSessionContext);
  if (!context) throw new Error("useCustomerSession must be used inside CustomerSessionProvider");
  return context;
}

