import type { Metadata } from "next";

import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.meta.register.title"), description: t("auth.meta.register.description") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
