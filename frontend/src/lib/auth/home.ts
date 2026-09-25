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
