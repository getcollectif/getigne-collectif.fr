import React, { useCallback, useEffect, useState } from "react";
import LoadingSpinner from "@/components/ui/loading";
import SetupPage from "@/pages/SetupPage";

type Props = {
  children: React.ReactNode;
};

export function SetupGuard({ children }: Props) {
  const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);

  const refetch = useCallback(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/setup-status`;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${key}` },
    })
      .then((res) => (res.ok ? res.json() : { hasAdmin: true }))
      .then((data) => setHasAdmin(data?.hasAdmin === true))
      .catch(() => setHasAdmin(true));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (hasAdmin === null) {
    return <LoadingSpinner />;
  }

  if (!hasAdmin) {
    return <SetupPage onFirstAdminCreated={refetch} />;
  }

  return <>{children}</>;
}
