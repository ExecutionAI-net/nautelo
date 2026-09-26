// Spec 37: all new UI text has EN/IT/ES translation keys and no English is
// hard-coded inside a component. A typed dictionary, not an i18n framework —
// the same shape lib/i18n/directory.ts established in Phase 5.
//
// `Locale` is imported, never redeclared (Phase 5 contract rule 12): it is
// declared once in lib/api/directory.ts and re-exported by lib/i18n/directory.
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const CONVERSATION_MESSAGES: Record<string, Translations> = {
  // Spec 37 names this key literally.
  "broker.messages": { en: "Messages", it: "Messaggi", es: "Mensajes" },
  "broker.dashboard": {
    en: "Dashboard",
    it: "Pannello",
    es: "Panel",
  },
  "messages.title": { en: "Messages", it: "Messaggi", es: "Mensajes" },
  "messages.intro": {
    en: "Conversations started from your listings and profile.",
    it: "Conversazioni avviate dai tuoi annunci e dal tuo profilo.",
    es: "Conversaciones iniciadas desde tus anuncios y tu perfil.",
  },

  // Spec 28's five filters, verbatim.
  "messages.filter.all": { en: "All", it: "Tutti", es: "Todos" },
  "messages.filter.unread": { en: "Unread", it: "Non letti", es: "No leídos" },
  "messages.filter.listing_inquiries": {
    en: "Listing inquiries",
    it: "Richieste sugli annunci",
    es: "Consultas de anuncios",
  },
  "messages.filter.profile_inquiries": {
    en: "Profile inquiries",
    it: "Richieste dal profilo",
    es: "Consultas del perfil",
  },
  "messages.filter.archived": {
    en: "Archived",
    it: "Archiviati",
    es: "Archivados",
  },
  "messages.filter.label": { en: "Filter", it: "Filtro", es: "Filtro" },

  "messages.empty": {
    en: "Nothing here yet. Enquiries from buyers appear here once your listings are live, so keep your vessels and public page complete.",
    it: "Ancora niente qui. Le richieste degli acquirenti arrivano qui quando i tuoi annunci sono online: tieni completi imbarcazioni e pagina pubblica.",
    es: "Todavía no hay nada. Las consultas de los compradores llegan aquí cuando tus anuncios estén publicados: mantén completos tus embarcaciones y tu página pública.",
  },
  "messages.loading": { en: "Loading…", it: "Caricamento…", es: "Cargando…" },
  "messages.unread_count": {
    en: "{count} unread",
    it: "{count} non letti",
    es: "{count} sin leer",
  },
  "messages.context.LISTING": { en: "Listing", it: "Annuncio", es: "Anuncio" },
  "messages.context.BROKER": { en: "Broker", it: "Broker", es: "Bróker" },
  "messages.context.PROFESSIONAL": {
    en: "Professional",
    it: "Professionista",
    es: "Profesional",
  },
  "messages.context.SUPPORT": { en: "Support", it: "Assistenza", es: "Soporte" },

  "messages.archive": { en: "Archive", it: "Archivia", es: "Archivar" },
  "messages.unarchive": {
    en: "Move to inbox",
    it: "Sposta in arrivo",
    es: "Mover a recibidos",
  },
  "messages.archived_badge": {
    en: "Archived",
    it: "Archiviata",
    es: "Archivada",
  },
  "messages.blocked_badge": {
    // A distinct state, not a synonym for archived. Spec 36.6 makes BLOCKED a
    // moderation outcome; nothing in this phase produces it (ruling 4), but a
    // thread that reaches it must not be mislabelled "Archived".
    en: "Blocked",
    it: "Bloccata",
    es: "Bloqueada",
  },
  "messages.closed_badge": {
    // The seller's account changed type (joined a brokerage or a professional
    // team), so the thread takes no new messages. Not a moderation outcome.
    en: "Closed – account changed",
    it: "Chiusa – account modificato",
    es: "Cerrada – cuenta modificada",
  },

  "messages.thread.back": {
    en: "Back to messages",
    it: "Torna ai messaggi",
    es: "Volver a mensajes",
  },
  "messages.thread.context_heading": {
    en: "About",
    it: "Riguarda",
    es: "Acerca de",
  },
  "messages.thread.open_context": {
    en: "Open",
    it: "Apri",
    es: "Abrir",
  },
  "messages.thread.you": { en: "You", it: "Tu", es: "Tú" },
  "messages.thread.system_note": {
    en: "System note",
    it: "Nota di sistema",
    es: "Nota del sistema",
  },
  "messages.thread.empty": {
    en: "This conversation has no messages yet.",
    it: "Questa conversazione non ha ancora messaggi.",
    es: "Esta conversación aún no tiene mensajes.",
  },
  "messages.reply.label": { en: "Reply", it: "Rispondi", es: "Responder" },
  "messages.reply.placeholder": {
    en: "Write your reply…",
    it: "Scrivi la tua risposta…",
    es: "Escribe tu respuesta…",
  },
  "messages.reply.send": { en: "Send", it: "Invia", es: "Enviar" },
  "messages.reply.sending": {
    en: "Sending…",
    it: "Invio in corso…",
    es: "Enviando…",
  },
  "messages.reply.too_short": {
    // Spec 15.1's Message rule applies to a reply too: 20-4000 characters. The
    // server is the authority (spec 2.2); this is usability only.
    en: "A reply must be at least 20 characters.",
    it: "Una risposta deve contenere almeno 20 caratteri.",
    es: "Una respuesta debe tener al menos 20 caracteres.",
  },
  "messages.reply.too_long": {
    en: "A reply may be at most 4000 characters.",
    it: "Una risposta può contenere al massimo 4000 caratteri.",
    es: "Una respuesta puede tener como máximo 4000 caracteres.",
  },

  // Spec 30.2 asks for a localized, user-safe message. The backend's strings are
  // English-only today (Phase 6 Known Limitation 13), so the client maps
  // error.code to its own copy and never renders error.message.
  "messages.error.feature_disabled": {
    en: "Messages are not available yet.",
    it: "I messaggi non sono ancora disponibili.",
    es: "Los mensajes aún no están disponibles.",
  },
  "messages.error.authentication_required": {
    en: "Sign in to see your messages.",
    it: "Accedi per vedere i tuoi messaggi.",
    es: "Inicia sesión para ver tus mensajes.",
  },
  "messages.error.rate_limited": {
    en: "Too many requests. Try again in a moment.",
    it: "Troppe richieste. Riprova tra poco.",
    es: "Demasiadas solicitudes. Inténtalo de nuevo en un momento.",
  },
  "messages.error.conversation_closed": {
    en: "This conversation is closed.",
    it: "Questa conversazione è chiusa.",
    es: "Esta conversación está cerrada.",
  },
  "messages.error.conversation_superseded": {
    en: "A newer conversation about this already exists.",
    it: "Esiste già una conversazione più recente su questo argomento.",
    es: "Ya existe una conversación más reciente sobre esto.",
  },
  "messages.error.invalid_conversation_status": {
    en: "That change is not allowed.",
    it: "Questa modifica non è consentita.",
    es: "Ese cambio no está permitido.",
  },
  "messages.error.conversation_filing_forbidden": {
    // Ruling 5: one shared `status` column means only the recipient may file.
    en: "Only the recipient of a conversation can archive it.",
    it: "Solo il destinatario di una conversazione può archiviarla.",
    es: "Solo el destinatario de una conversación puede archivarla.",
  },
  "messages.error.not_broker_member": {
    // Ruling 15: the session lists a membership whose organization may be
    // SUSPENDED (accounts/selectors.py:63-65 does not filter on broker status,
    // while accounts/services.py:150-159 requires ACTIVE). Name both real causes
    // instead of showing "Something went wrong".
    en: "This broker organization is not available to your account. It may be suspended, or your membership may have been removed.",
    it: "Questa organizzazione broker non è disponibile per il tuo account. Potrebbe essere sospesa oppure la tua iscrizione potrebbe essere stata rimossa.",
    es: "Esta organización de bróker no está disponible para tu cuenta. Puede estar suspendida o tu membresía puede haberse eliminado.",
  },
  "messages.error.not_found": {
    en: "This conversation is not available.",
    it: "Questa conversazione non è disponibile.",
    es: "Esta conversación no está disponible.",
  },
  "messages.error.validation_error": {
    en: "Check the highlighted field and try again.",
    it: "Controlla il campo evidenziato e riprova.",
    es: "Revisa el campo resaltado e inténtalo de nuevo.",
  },
  "messages.error.unexpected_error": {
    en: "Something went wrong. Try again.",
    it: "Qualcosa è andato storto. Riprova.",
    es: "Algo salió mal. Inténtalo de nuevo.",
  },

  // Broker home (spec 28 "Dashboard metrics").
  "broker.dashboard.title": {
    en: "Broker dashboard",
    it: "Pannello broker",
    es: "Panel del bróker",
  },
  "broker.dashboard.metric.published_listings": {
    en: "Published listings",
    it: "Annunci pubblicati",
    es: "Anuncios publicados",
  },
  "broker.dashboard.metric.pending_approvals": {
    en: "Awaiting review",
    it: "In attesa di revisione",
    es: "Pendientes de revisión",
  },
  "broker.dashboard.metric.pending_approvals_help": {
    en: "Vessels waiting for staff approval",
    it: "Imbarcazioni in attesa dell'approvazione dello staff",
    es: "Embarcaciones a la espera de la aprobación del equipo",
  },
  "messages.thread.about_profile": {
    en: "About your brokerage profile",
    it: "Riguarda il profilo della tua agenzia",
    es: "Sobre el perfil de tu agencia",
  },
  "messages.thread.about": { en: "About", it: "Riguarda", es: "Sobre" },
  "broker.dashboard.metric.unread_messages": {
    en: "Unread messages",
    it: "Messaggi non letti",
    es: "Mensajes sin leer",
  },
  "broker.dashboard.metric.new_inquiries": {
    en: "New inquiries",
    it: "Nuove richieste",
    es: "Consultas nuevas",
  },
  "broker.dashboard.metric.new_inquiries_help": {
    // The window is the backend's `new_inquiries_7d`; the label states it so the
    // screen cannot describe a period the server did not compute (spec 2.1).
    en: "Last 7 days",
    it: "Ultimi 7 giorni",
    es: "Últimos 7 días",
  },
  "broker.dashboard.messages_locked": {
    en: "Your team role does not include reading this organization's messages.",
    it: "Il tuo ruolo nel team non include la lettura dei messaggi di questa organizzazione.",
    es: "Tu rol en el equipo no incluye leer los mensajes de esta organización.",
  },
  "broker.dashboard.messages_unavailable": {
    en: "Messaging is not enabled yet.",
    it: "La messaggistica non è ancora attiva.",
    es: "La mensajería aún no está activada.",
  },
  "broker.dashboard.no_organization": {
    en: "Your account is not a member of a broker organization.",
    it: "Il tuo account non appartiene a un'organizzazione broker.",
    es: "Tu cuenta no pertenece a una organización de bróker.",
  },
};

export function tConversations(locale: Locale, key: string): string {
  const translations = CONVERSATION_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown conversation message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}

/** Substitute `{name}` placeholders. An unknown placeholder is left in place
 * rather than replaced with "undefined": a visible `{count}` is a bug report,
 * `undefined` on a screen is a mystery. */
export function formatConversationMessage(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
