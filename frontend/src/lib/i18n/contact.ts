// Spec 37: EN/IT/ES for every string, none hard-coded in a component. A sibling
// of lib/i18n/directory.ts rather than an edit to it — Phase 5's contract rule 9
// explicitly allows "a sibling dictionary", and keeping this phase's copy in its
// own module means a concurrent phase editing the directory dictionary never
// collides with this one.
import type { Locale } from "@/lib/api/directory";

// Locale is declared once, in lib/api/directory.ts (Phase 5 contract rule 12).
export type { Locale };

type Translations = Record<Locale, string>;

export const CONTACT_MESSAGES: Record<string, Translations> = {
  "contact.heading": {
    en: "Business contact",
    it: "Contatto aziendale",
    es: "Contacto profesional",
  },
  "contact.locked_explanation": {
    // Spec 16 fixes this sentence exactly.
    en: "Send a message through NAUTA to unlock business contact details.",
    it: "Invia un messaggio tramite NAUTA per sbloccare i dati di contatto aziendali.",
    es: "Envía un mensaje a través de NAUTA para desbloquear los datos de contacto profesionales.",
  },
  "contact.unlocked": {
    en: "Contact details unlocked",
    it: "Dati di contatto sbloccati",
    es: "Datos de contacto desbloqueados",
  },
  "contact.email_label": { en: "Email", it: "Email", es: "Correo electrónico" },
  "contact.phone_label": { en: "Phone", it: "Telefono", es: "Teléfono" },
  "contact.website_label": { en: "Website", it: "Sito web", es: "Sitio web" },
  "contact.unavailable": {
    // Spec 16: "suspended entity contact becomes unavailable". Deliberately
    // says nothing about why — a suspension is not the visitor's business.
    en: "Contact details are not available for this profile right now.",
    it: "I dati di contatto non sono disponibili per questo profilo al momento.",
    es: "Los datos de contacto no están disponibles para este perfil en este momento.",
  },
  "contact.loading": {
    en: "Loading contact details…",
    it: "Caricamento dei dati di contatto…",
    es: "Cargando los datos de contacto…",
  },
  "contact.error": {
    en: "Contact details could not be loaded. Please try again.",
    it: "Impossibile caricare i dati di contatto. Riprova.",
    es: "No se han podido cargar los datos de contacto. Inténtalo de nuevo.",
  },
  "contact.granted_on": { en: "Unlocked on", it: "Sbloccato il", es: "Desbloqueado el" },
};

export function tContact(locale: Locale, key: string): string {
  const translations = CONTACT_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown contact message key: ${key}`);
  }
  return translations[locale] || translations.en;
}
