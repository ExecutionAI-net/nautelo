import { notFound } from "next/navigation";

import RequirePermission from "@/components/auth/RequirePermission";
import AreaShell from "@/components/layout/AreaShell";
import EmailTemplateEditor from "@/components/staff/EmailTemplateEditor";
import type { EmailLocale } from "@/lib/api/emailTemplates";

const LOCALES: EmailLocale[] = ["EN", "IT", "ES"];

export default async function StaffEmailTemplateEditorPage({
  params,
}: {
  params: Promise<{ key: string; locale: string }>;
}) {
  const { key, locale } = await params;
  if (!LOCALES.includes(locale as EmailLocale)) notFound();

  return (
    <AreaShell area="staff" active="/dashboard/staff/email-templates/">
      <RequirePermission permission="configure_products_and_settings">
        <EmailTemplateEditor templateKey={key} locale={locale as EmailLocale} />
      </RequirePermission>
    </AreaShell>
  );
}
