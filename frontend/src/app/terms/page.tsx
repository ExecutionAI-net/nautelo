import type { Metadata } from "next";

import LegalPage from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Terms of use" };

// Draft; the wording needs legal review before launch.
export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of use"
      updated="2026-09"
      intro="These terms govern your use of the Nauta marketplace for boats and nautical services."
      sections={[
        {
          heading: "The marketplace",
          paragraphs: [
            "Nauta connects buyers with sellers, brokers and service professionals. We are not a party to a sale or a service contract and we do not guarantee any listing, price or professional.",
          ],
        },
        {
          heading: "Listings",
          paragraphs: [
            "You must be entitled to sell the boat you list and the information must be accurate. Listings are reviewed before they are published and we may reject, suspend or remove a listing that breaks these terms.",
            "Publishing may require a listing right. Free rights and paid rights are recorded in your account.",
          ],
        },
        {
          heading: "Messaging and contact details",
          paragraphs: [
            "Use inquiry messaging only to discuss a listing or a service. Spam, harassment and off-platform solicitation are not allowed and can lead to a blocked conversation or account.",
          ],
        },
        {
          heading: "Professionals and brokers",
          paragraphs: [
            "Profiles are published after review. Professionals are responsible for the accuracy of their services and for holding any licence their work requires.",
          ],
        },
        {
          heading: "Liability",
          paragraphs: ["The platform is provided as is. To the extent the law allows, Nauta is not liable for losses arising from transactions between users."],
        },
      ]}
    />
  );
}
