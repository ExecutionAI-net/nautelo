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
  "staff.broker.auto_approval": {
    en: "Automatic approval",
    it: "Approvazione automatica",
    es: "Aprobación automática",
  },
  "staff.broker.auto_approval.on": { en: "On", it: "Attiva", es: "Activada" },
  "staff.broker.auto_approval.off": {
    en: "Off",
    it: "Disattivata",
    es: "Desactivada",
  },
  "staff.broker.auto_approval.enable": {
    en: "Turn on automatic approval",
    it: "Attiva l'approvazione automatica",
    es: "Activar la aprobación automática",
  },
  "staff.broker.auto_approval.disable": {
    en: "Turn off automatic approval",
    it: "Disattiva l'approvazione automatica",
    es: "Desactivar la aprobación automática",
  },
  "staff.broker.auto_approval.last_changed": {
    en: "Last changed by",
    it: "Ultima modifica di",
    es: "Última modificación por",
  },
  "staff.broker.auto_approval.never_changed": {
    en: "Never changed.",
    it: "Mai modificata.",
    es: "Nunca modificada.",
  },
  "staff.broker.auto_approval.readonly": {
    en: "Only a staff administrator can change this policy.",
    it: "Solo un amministratore dello staff può modificare questa politica.",
    es: "Solo un administrador del equipo puede cambiar esta política.",
  },
  "staff.broker.auto_approval.confirm_title": {
    en: "Confirm the policy change",
    it: "Conferma la modifica della politica",
    es: "Confirma el cambio de política",
  },
  "staff.broker.auto_approval.confirm_enable": {
    // Spec §21 rule 5, said in the confirmation modal spec §21 requires.
    en: "Turning this on affects future submissions only. Submissions already waiting for a moderator stay in the queue until somebody decides them.",
    it: "L'attivazione riguarda solo gli invii futuri. Gli invii già in attesa di un moderatore restano in coda finché qualcuno non li decide.",
    es: "Activarla afecta solo a los envíos futuros. Los envíos que ya esperan a un moderador permanecen en la cola hasta que alguien los decida.",
  },
  "staff.broker.auto_approval.confirm_disable": {
    // Spec §21 rule 6.
    en: "Turning this off affects future submissions only. Listings that are already published stay live unless they are moderated.",
    it: "La disattivazione riguarda solo gli invii futuri. Gli annunci già pubblicati restano online salvo moderazione.",
    es: "Desactivarla afecta solo a los envíos futuros. Los anuncios ya publicados siguen visibles salvo que se moderen.",
  },
  "staff.broker.reason_label": {
    en: "Reason (required)",
    it: "Motivo (obbligatorio)",
    es: "Motivo (obligatorio)",
  },
  "staff.broker.reason_required": {
    en: "Enter a reason before confirming.",
    it: "Inserisci un motivo prima di confermare.",
    es: "Introduce un motivo antes de confirmar.",
  },
  "staff.broker.confirm": { en: "Confirm", it: "Conferma", es: "Confirmar" },
  "staff.broker.cancel": { en: "Cancel", it: "Annulla", es: "Cancelar" },
  "staff.broker.saving": {
    en: "Saving…",
    it: "Salvataggio…",
    es: "Guardando…",
  },
  "staff.broker.save_failed": {
    en: "The change could not be saved.",
    it: "Impossibile salvare la modifica.",
    es: "No se ha podido guardar el cambio.",
  },
  "staff.broker.no_change": {
    en: "The policy was already in that state. Nothing changed.",
    it: "La politica era già in questo stato. Nessuna modifica.",
    es: "La política ya estaba en ese estado. No ha cambiado nada.",
  },
};

export function tStaffBroker(locale: Locale, key: string): string {
  const translations = STAFF_BROKER_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown staff broker message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}

/**
 * A timestamp in the reader's locale, for a screen that is otherwise fully
 * EN/IT/ES (spec §37).
 *
 * A raw ISO string is not a spec §37 violation — it is a timestamp, not
 * translatable copy — but it is the only thing on this screen that ignores the
 * locale the rest of it obeys, and staff read these stamps next to translated
 * action labels and staff-authored reasons. There is no existing date-format
 * convention to follow: as of this phase `frontend/src` contains no
 * `Intl.DateTimeFormat`, `toLocaleDateString` or `formatDate` call at all
 * (verify with `grep -rn "Intl\.\|toLocale" src/` before writing this), so this
 * is the convention's first definition rather than a deviation from one. `Intl`
 * is a platform built-in; no dependency is added.
 *
 * `timeZone: "UTC"` is deliberate on both counts: every stamp the backend sends
 * is timezone-aware UTC (spec §11 preamble) and staff compare these against the
 * audit trail, so a stamp that silently shifted to the reader's machine clock
 * would be worse than useless during an incident — and a fixed zone keeps the
 * component tests deterministic on any CI box.
 */
export function formatStaffTimestamp(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(iso));
}
