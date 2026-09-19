import type { Metadata } from "next";

import LegalPage from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Cookie notice" };

// Draft; the wording needs legal review before launch.
export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie notice"
      updated="2026-09"
      intro="Nauta uses only the cookies it needs to keep you signed in and to protect your account."
      sections={[
        {
          heading: "Essential cookies",
          paragraphs: [
            "A refresh cookie keeps your session active. It is HttpOnly, is not readable by scripts and is removed when you sign out.",
          ],
        },
        {
          heading: "Analytics and advertising",
          paragraphs: [
            "We do not set advertising or cross-site tracking cookies. Listing views are counted on the server without storing an identifier in your browser.",
          ],
        },
      ]}
    />
  );
}
