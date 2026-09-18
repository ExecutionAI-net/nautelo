export type PermissionKey =
  | "browse_public_content"
  | "submit_inquiry"
  | "reveal_contact_after_inquiry"
  | "reveal_any_contact"
  | "create_private_listing"
  | "create_broker_listing"
  | "create_listing_on_behalf"
  | "enable_listing_finance_flag"
  | "approve_listings_and_revisions"
  | "configure_broker_auto_approval"
  | "configure_products_and_settings"
  | "manage_taxonomy";

export type PermissionMap = Record<PermissionKey, boolean>;

export type UserRole =
  | "BUYER"
  | "PRIVATE_SELLER"
  | "BROKER"
  | "SERVICE_PROVIDER"
  | "STAFF";

export type LocaleCode = "EN" | "IT" | "ES";

export type EntityStatus = "DRAFT" | "PENDING" | "ACTIVE" | "SUSPENDED";

export type BrokerMembershipRole = "ADMIN" | "MANAGER" | "AGENT" | "VIEWER";

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  primary_role: UserRole;
  locale: LocaleCode;
  email_verified: boolean;
  is_active: boolean;
}

export interface BrokerMembershipSummary {
  broker_id: string;
  broker_name: string;
  broker_slug: string;
  broker_status: EntityStatus;
  role: BrokerMembershipRole;
  can_edit_listings: boolean;
  can_manage_team: boolean;
  can_read_messages: boolean;
}

export interface ProfessionalProfileSummary {
  id: string;
  slug: string;
  display_name: string;
  status: EntityStatus;
}

export interface SessionPayload {
  authenticated: boolean;
  user: SessionUser | null;
  locale: LocaleCode;
  permissions: PermissionMap;
  broker_memberships: BrokerMembershipSummary[];
  professional_profile: ProfessionalProfileSummary | null;
  staff: { is_staff_moderator: boolean; is_staff_admin: boolean };
}

export interface LoginResponse {
  access: string;
  user: SessionUser;
}
