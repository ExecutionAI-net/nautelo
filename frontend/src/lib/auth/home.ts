import type { SessionUser } from "@/lib/auth/types";

/** Where an account lands after signing in when no ?next= was asked for: its own dashboard, not the home page. */
export function dashboardHomeFor(user: Pick<SessionUser, "primary_role"> | null | undefined): string {
  switch (user?.primary_role) {
    case "BROKER":
      return "/dashboard/broker/";
    case "PROFESSIONAL":
      return "/dashboard/service-provider/";
    case "STAFF":
      return "/dashboard/staff/";
    case "PRIVATE_SELLER":
      return "/dashboard/private-seller/";
    default:
      return "/";
  }
}

/** The account's own settings page, inside its own area (a business account never goes to the private seller area). */
export function accountHrefFor(user: Pick<SessionUser, "primary_role"> | null | undefined): string {
  switch (user?.primary_role) {
    case "BROKER":
      return "/dashboard/broker/account/";
    case "PROFESSIONAL":
      return "/dashboard/service-provider/account/";
    default:
      return "/dashboard/private-seller/account/";
  }
}

type SessionLike =
  | { user?: Pick<SessionUser, "primary_role"> | null; broker_memberships?: unknown[] | null }
  | null
  | undefined;

/** True for a broker account: it has nothing to do with the private seller area. */
export function isBrokerAccount(session: SessionLike): boolean {
  return session?.user?.primary_role === "BROKER" || (session?.broker_memberships?.length ?? 0) > 0;
}

/** Which business area owns this account, or null for a private seller (or anyone else). */
export function businessAreaFor(session: SessionLike): "broker" | "provider" | null {
  if (isBrokerAccount(session)) return "broker";
  if (session?.user?.primary_role === "PROFESSIONAL") return "provider";
  return null;
}
