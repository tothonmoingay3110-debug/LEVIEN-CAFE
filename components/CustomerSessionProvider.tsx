"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomerProfileView } from "@/types/account";

export type FavoriteItem = { productId: string; selection: { ice?: string; sugar?: string; toppingIds?: string[]; note?: string }; updatedAt: string };

type CustomerSessionContextValue = {
  loading: boolean;
  authenticated: boolean;
  profile: CustomerProfileView | null;
  favorites: FavoriteItem[];
  saveFavorite: (productId: string, selection: FavoriteItem["selection"]) => Promise<void>;
  removeFavorite: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const CustomerSessionContext = createContext<CustomerSessionContextValue | null>(null);

export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfileView | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  const refreshFavorites = useCallback(async () => {
    const response = await fetch("/api/account/favorites", { cache: "no-store" });
    if (!response.ok) { setFavorites([]); return; }
    const result = await response.json() as { favorites: FavoriteItem[] };
    setFavorites(result.favorites || []);
  }, []);

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

  useEffect(() => {
    if (profile) void refreshFavorites(); else setFavorites([]);
  }, [profile?.id, refreshFavorites]);

  const saveFavorite = useCallback(async (productId: string, selection: FavoriteItem["selection"]) => {
    const response = await fetch("/api/account/favorites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, selection }) });
    if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "Unable to save favorite.");
    await refreshFavorites();
  }, [refreshFavorites]);

  const removeFavorite = useCallback(async (productId: string) => {
    const response = await fetch(`/api/account/favorites?productId=${encodeURIComponent(productId)}`, { method: "DELETE" });
    if (!response.ok) throw new Error(((await response.json()) as { error?: string }).error || "Unable to remove favorite.");
    await refreshFavorites();
  }, [refreshFavorites]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo(() => ({
    loading,
    authenticated: Boolean(profile),
    profile,
    favorites,
    saveFavorite,
    removeFavorite,
    refresh,
    signOut,
  }), [loading, profile, favorites, refresh, signOut, saveFavorite, removeFavorite]);

  return <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>;
}

export function useCustomerSession() {
  const context = useContext(CustomerSessionContext);
  if (!context) throw new Error("useCustomerSession must be used inside CustomerSessionProvider");
  return context;
}

