// Spec 37: all new UI text has EN/IT/ES translation keys and no English is
// hard-coded inside components. A typed dictionary, not an i18n framework —
// see the ruling in Task 13 of the Phase 5 plan.
import type { Locale } from "@/lib/api/directory";

// Locale is declared once, in lib/api/directory.ts (it is the API contract's
// ?locale= parameter), and re-exported here so a component can import the type
// from the same module as t(). Do NOT redeclare the union in this file: two
// structurally identical unions compile but are two sources of truth.
export type { Locale };

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "it", "es"];
export const DEFAULT_LOCALE: Locale = "en";

export function resolveLocale(raw: string | undefined | null): Locale {
  const candidate = raw?.trim().toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(candidate ?? "")
    ? (candidate as Locale)
    : DEFAULT_LOCALE;
}

type Translations = Record<Locale, string>;

export const DIRECTORY_MESSAGES: Record<string, Translations> = {
  "nav.services_professionals": {
    en: "Services / Professionals",
    it: "Servizi / Professionisti",
    es: "Servicios / Profesionales",
  },
  "directory.services_professionals.title": {
    // Spec 1 fixes this H1 exactly.
    en: "Nautical Services & Professionals",
    it: "Servizi e professionisti nautici",
    es: "Servicios y profesionales náuticos",
  },
  "directory.intro": {
    en: "Find nautical service providers across Spain and Italy.",
    it: "Trova fornitori di servizi nautici in Spagna e in Italia.",
    es: "Encuentra proveedores de servicios náuticos en España e Italia.",
  },
  "directory.search.text": { en: "Search", it: "Cerca", es: "Buscar" },
  "directory.search.category": { en: "Category", it: "Categoria", es: "Categoría" },
  "directory.search.category.all": {
    en: "All categories",
    it: "Tutte le categorie",
    es: "Todas las categorías",
  },
  "directory.search.location": { en: "Location", it: "Località", es: "Ubicación" },
  "directory.search.sort": { en: "Sort", it: "Ordina", es: "Ordenar" },
  "directory.search.submit": { en: "Search", it: "Cerca", es: "Buscar" },
  "directory.sort.recommended": {
    en: "Recommended",
    it: "Consigliati",
    es: "Recomendados",
  },
  "directory.sort.alphabetical": { en: "A–Z", it: "A–Z", es: "A–Z" },
  "directory.categories.heading": {
    en: "Service categories",
    it: "Categorie di servizi",
    es: "Categorías de servicios",
  },
  "directory.categories.empty": {
    en: "No service categories are published yet.",
    it: "Nessuna categoria di servizi è ancora pubblicata.",
    es: "Todavía no hay categorías de servicios publicadas.",
  },
  "directory.results.heading": {
    en: "Professionals",
    it: "Professionisti",
    es: "Profesionales",
  },
  "directory.results.empty": {
    en: "No matching professionals.",
    it: "Nessun professionista corrispondente.",
    es: "No hay profesionales que coincidan.",
  },
  "directory.results.count": {
    en: "results",
    it: "risultati",
    es: "resultados",
  },
  "directory.seo.heading": {
    en: "Service pages",
    it: "Pagine dei servizi",
    es: "Páginas de servicios",
  },
  "directory.pagination.next": { en: "Next", it: "Successivi", es: "Siguientes" },
  "directory.pagination.previous": {
    en: "Previous",
    it: "Precedenti",
    es: "Anteriores",
  },
  "professional.about.heading": { en: "About", it: "Chi siamo", es: "Acerca de" },
  "professional.services.heading": {
    en: "Services offered",
    it: "Servizi offerti",
    es: "Servicios ofrecidos",
  },
  "professional.service_area.heading": {
    en: "Service area",
    it: "Area di servizio",
    es: "Zona de servicio",
  },
  "professional.related.heading": {
    en: "Related professionals",
    it: "Professionisti correlati",
    es: "Profesionales relacionados",
  },
  "professional.status.active": {
    // Spec 14.2: short verified/profile status language that does not imply a
    // government certification. Backed by a real field (status === ACTIVE).
    en: "Listed NAUTA profile, reviewed by NAUTA staff. NAUTA is not a licensing body and does not certify qualifications.",
    it: "Profilo NAUTA pubblicato, verificato dallo staff NAUTA. NAUTA non è un ente di rilascio di licenze e non certifica qualifiche.",
    es: "Perfil NAUTA publicado, revisado por el equipo de NAUTA. NAUTA no es un organismo de licencias y no certifica cualificaciones.",
  },
  "category.browse_professionals": {
    en: "Browse professionals in this category",
    it: "Sfoglia i professionisti di questa categoria",
    es: "Ver profesionales de esta categoría",
  },
};

export function t(locale: Locale, key: string): string {
  const translations = DIRECTORY_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown directory message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}
