import type { Metadata } from "next";

import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("auth.meta.login.title"), description: t("auth.meta.login.description") };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
