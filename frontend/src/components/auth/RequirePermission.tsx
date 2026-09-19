"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import ForbiddenScreen from "@/components/auth/ForbiddenScreen";
import { safeNextUrl } from "@/lib/auth/next-url";
import { useSession } from "@/lib/auth/session";
import type { PermissionKey } from "@/lib/auth/types";

interface Props {
  /** Optional. When omitted the component is only the sign-in guard: authorization
   * for conversations is server-side (no PermissionKey exists for it in spec 5). */
  permission?: PermissionKey;
  children: React.ReactNode;
}

export default function RequirePermission({ permission, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, can } = useSession();

  const authenticated = session?.authenticated === true;
  const allowed = permission === undefined || can(permission);

  useEffect(() => {
    if (loading || authenticated) return;
    const next = encodeURIComponent(safeNextUrl(pathname));
    router.replace(`/login?next=${next}`);
  }, [loading, authenticated, pathname, router]);

  if (loading) {
    return (
      <p className="p-space-lg font-body-md text-on-surface-variant" aria-busy="true">
        Loading…
      </p>
    );
  }
  if (!authenticated) return null;
  if (!allowed) return <ForbiddenScreen />;
  return <>{children}</>;
}
