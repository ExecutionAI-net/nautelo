import type { Metadata } from "next";

import LegalPage from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Privacy notice" };

// Draft covering the processing listed in spec 33.2; the wording needs legal review before launch.
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy notice"
      updated="2026-09"
      intro="This notice explains which personal data Nautelo processes when you browse boats, contact sellers, brokers and professionals, or publish listings, and why."
      sections={[
        {
          heading: "Data we process",
          paragraphs: [
            "Account data: email address, name, language and role. Listing data you publish, including photos and the contact details you choose to show.",
            "Inquiry messaging: the messages you send through the platform, with a snapshot of your name, email and phone number at the time of sending, and the version of this notice you accepted.",
            "Contact reveal: when a broker or professional contact is unlocked we record who viewed it and when.",
            "Views: listing views are counted with a keyed hash of the visitor address. The hash is pseudonymous data, is restricted to staff and is never shown to sellers.",
            "Payments: card payments are handled by our payment processor. We store the payment reference and status, not card numbers.",
          ],
        },
        {
          heading: "What we do not do",
          paragraphs: ["We do not use browser fingerprinting and we do not sell personal data."],
        },
        {
          heading: "Retention and deletion",
          paragraphs: [
            "Messages follow the conversation retention period. If you ask us to delete your account we anonymise your personal data and keep only the payment and audit records we are legally or operationally required to keep, under a pseudonym.",
          ],
        },
        {
          heading: "Your rights",
          paragraphs: ["You can request access, correction, export or deletion of your data through the contact page."],
        },
      ]}
    />
  );
}
