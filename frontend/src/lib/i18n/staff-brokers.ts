// Spec §37: all new UI text has EN/IT/ES keys and no English is hard-coded
// inside a component. Same typed-dictionary pattern as lib/i18n/directory.ts —
// a dictionary, not an i18n framework (Phase 5's ruling).
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const STAFF_BROKER_MESSAGES: Record<string, Translations> = {
  "staff.broker.loading": {
    en: "Loading…",
    it: "Caricamento…",
    es: "Cargando…",
  },
  // Every failure message opens with the same sentence and then names the
  // cause: the screen always says plainly that nothing was loaded (spec §2.1 —
  // a real state, never an empty screen), and staff still learn whether to sign
  // in again, check the address or wait. The backend's own message is never
  // rendered: it can name a person or a request id that spec §21 does not put
  // on this screen.
  "staff.broker.load_failed": {
    en: "This broker could not be loaded. Check your connection and try again.",
    it: "Impossibile caricare questo broker. Controlla la connessione e riprova.",
    es: "No se ha podido cargar este bróker. Comprueba la conexión e inténtalo de nuevo.",
  },
  "staff.broker.error.unauthenticated": {
    en: "This broker could not be loaded. Your session has expired — sign in again.",
    it: "Impossibile caricare questo broker. La sessione è scaduta: accedi di nuovo.",
    es: "No se ha podido cargar este bróker. Tu sesión ha caducado: inicia sesión de nuevo.",
  },
  "staff.broker.error.forbidden": {
    en: "This broker could not be loaded. Your account does not have staff access to it.",
    it: "Impossibile caricare questo broker. Il tuo account non ha accesso staff a questo broker.",
    es: "No se ha podido cargar este bróker. Tu cuenta no tiene acceso de personal a este bróker.",
  },
  "staff.broker.error.not_found": {
    en: "This broker could not be loaded. No broker matches this address.",
    it: "Impossibile caricare questo broker. Nessun broker corrisponde a questo indirizzo.",
    es: "No se ha podido cargar este bróker. Ningún bróker coincide con esta dirección.",
  },
  "staff.broker.error.rate_limited": {
    en: "This broker could not be loaded. Too many requests — wait a moment and try again.",
    it: "Impossibile caricare questo broker. Troppe richieste: attendi un momento e riprova.",
    es: "No se ha podido cargar este bróker. Demasiadas solicitudes: espera un momento e inténtalo de nuevo.",
  },
  "staff.broker.error.server": {
    en: "This broker could not be loaded. The server is unavailable — try again shortly.",
    it: "Impossibile caricare questo broker. Il server non è disponibile: riprova tra poco.",
    es: "No se ha podido cargar este bróker. El servidor no está disponible: inténtalo de nuevo en unos instantes.",
  },
  "staff.broker.account_status": {
    en: "Account status",
    it: "Stato dell'account",
    es: "Estado de la cuenta",
  },
  "staff.broker.status.DRAFT": { en: "Draft", it: "Bozza", es: "Borrador" },
  "staff.broker.status.PENDING": {
    en: "Pending",
    it: "In attesa",
    es: "Pendiente",
  },
  "staff.broker.status.ACTIVE": { en: "Active", it: "Attivo", es: "Activo" },
  "staff.broker.status.SUSPENDED": {
    en: "Suspended",
    it: "Sospeso",
    es: "Suspendido",
  },
  "staff.broker.listing_counts": {
    en: "Listings by status",
    it: "Annunci per stato",
    es: "Anuncios por estado",
  },
  "staff.broker.listing_status.DRAFT": {
    en: "Draft",
    it: "Bozza",
    es: "Borrador",
  },
  "staff.broker.listing_status.PENDING_APPROVAL": {
    en: "Pending approval",
    it: "In attesa di approvazione",
    es: "Pendiente de aprobación",
  },
  "staff.broker.listing_status.PUBLISHED": {
    en: "Published",
    it: "Pubblicati",
    es: "Publicados",
  },
  "staff.broker.listing_status.REJECTED": {
    en: "Rejected",
    it: "Rifiutati",
    es: "Rechazados",
  },
  "staff.broker.listing_status.SUSPENDED": {
    en: "Suspended",
    it: "Sospesi",
    es: "Suspendidos",
  },
  "staff.broker.listing_status.EXPIRED": {
    en: "Expired",
    it: "Scaduti",
    es: "Caducados",
  },
  "staff.broker.listing_status.ARCHIVED": {
    en: "Archived",
    it: "Archiviati",
    es: "Archivados",
  },
  "staff.broker.listing_counts.total": {
    en: "Total",
    it: "Totale",
    es: "Total",
  },
  "staff.broker.no_quota": {
    // Spec §21 rule 1, stated on the screen so staff do not go looking for a
    // quota control that does not exist.
    en: "Broker organisations have no listing quota.",
    it: "Le organizzazioni broker non hanno un limite di annunci.",
    es: "Las organizaciones de bróker no tienen límite de anuncios.",
  },
};

export function tStaffBroker(locale: Locale, key: string): string {
  const translations = STAFF_BROKER_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown staff broker message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}
