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

/** The account's own settings page, inside its own area (a broker never goes to the private seller area). */
export function accountHrefFor(user: Pick<SessionUser, "primary_role"> | null | undefined): string {
  return user?.primary_role === "BROKER" ? "/dashboard/broker/account/" : "/dashboard/private-seller/account/";
}

/** True for a broker account: it has nothing to do with the private seller area. */
export function isBrokerAccount(
  session: { user?: Pick<SessionUser, "primary_role"> | null; broker_memberships?: unknown[] | null } | null | undefined,
): boolean {
  return session?.user?.primary_role === "BROKER" || (session?.broker_memberships?.length ?? 0) > 0;
}
