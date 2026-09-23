import type { Metadata } from "next";

import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.meta.reset.title"), description: t("auth.meta.reset.description") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
