import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Join NAUTA as a private seller, broker or nautical professional.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
