import { apiFetch } from "@/lib/api/client";

export type TranslationLang = "en" | "it" | "es";
export type TranslatedText = { title: string; description: string };

export async function fetchTranslationEnabled(): Promise<boolean> {
  try {
    const body = await apiFetch<{ enabled: boolean }>("/api/v1/translate/status/");
    return Boolean(body.enabled);
  } catch {
    return false;
  }
}

export async function translateListingText(input: {
  title: string;
  description: string;
  source: TranslationLang;
  targets: TranslationLang[];
}): Promise<Partial<Record<TranslationLang, TranslatedText>>> {
  const body = await apiFetch<{ translations: Partial<Record<TranslationLang, TranslatedText>> }>("/api/v1/translate/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return body.translations;
}
