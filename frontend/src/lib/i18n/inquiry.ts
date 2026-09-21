// Spec 37: every new UI string has EN/IT/ES and no English is hard-coded inside
// a component. Same typed-dictionary shape as lib/i18n/directory.ts.
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const INQUIRY_MESSAGES: Record<string, Translations> = {
  // Spec 37 names these three explicitly.
  "inquiry.email": { en: "Email", it: "Email", es: "Correo electrónico" },
  "inquiry.send": { en: "Send message", it: "Invia messaggio", es: "Enviar mensaje" },
  "inquiry.sent": {
    en: "Your message has been sent.",
    it: "Il tuo messaggio è stato inviato.",
    es: "Tu mensaje ha sido enviado.",
  },

  "inquiry.heading": {
    en: "Send a message",
    it: "Invia un messaggio",
    es: "Enviar un mensaje",
  },
  "inquiry.full_name": { en: "Full name", it: "Nome completo", es: "Nombre completo" },
  "inquiry.guest_hint": {
    en: "You will be asked to sign in or create a free account before the message is sent. What you write here is kept for you.",
    it: "Ti verrà chiesto di accedere o creare un account gratuito prima dell'invio. Quello che scrivi qui viene conservato.",
    es: "Se te pedirá iniciar sesión o crear una cuenta gratuita antes de enviar. Lo que escribas aquí se guarda.",
  },
  "inquiry.email_hint": {
    // Spec 15.1's "Update in account". Rendered as text, not a link, until an
    // /account/ page exists - see the comment at its render site.
    en: "Messages are sent from your account email. Change it in your account settings.",
    it: "I messaggi vengono inviati dall'email del tuo account. Modificala nelle impostazioni.",
    es: "Los mensajes se envían desde el correo de tu cuenta. Cámbialo en los ajustes.",
  },
  "inquiry.phone": {
    en: "Phone (optional)",
    it: "Telefono (facoltativo)",
    es: "Teléfono (opcional)",
  },
  "inquiry.phone_hint": {
    en: "International format, for example +390000000000.",
    it: "Formato internazionale, ad esempio +390000000000.",
    es: "Formato internacional, por ejemplo +390000000000.",
  },
  "inquiry.subject": { en: "Subject", it: "Oggetto", es: "Asunto" },
  "inquiry.subject_default": {
    en: "Question about {context}",
    it: "Domanda su {context}",
    es: "Consulta sobre {context}",
  },
  "inquiry.message": { en: "Message", it: "Messaggio", es: "Mensaje" },
  "inquiry.privacy_consent": {
    en: "I accept the privacy policy (version {version}).",
    it: "Accetto l'informativa sulla privacy (versione {version}).",
    es: "Acepto la política de privacidad (versión {version}).",
  },
  "inquiry.marketing_consent": {
    en: "Send me occasional updates from NAUTA.",
    it: "Inviami aggiornamenti occasionali da NAUTA.",
    es: "Enviarme novedades ocasionales de NAUTA.",
  },
  "inquiry.sending": { en: "Sending…", it: "Invio…", es: "Enviando…" },
  // Rendered wherever a message's `sender.display_name` is the empty string -
  // which is what the backend stores for a replier whose account has no name,
  // rather than leaking their email address. Phase 19's thread UI consumes it.
  "inquiry.sender_unnamed": {
    en: "A NAUTA user",
    it: "Un utente NAUTA",
    es: "Un usuario de NAUTA",
  },
  "inquiry.sign_in_to_send": {
    en: "Sign in to send",
    it: "Accedi per inviare",
    es: "Inicia sesión para enviar",
  },
  "inquiry.draft_restored": {
    en: "Your message was saved. Check it and press Send.",
    it: "Il tuo messaggio è stato salvato. Controllalo e premi Invia.",
    es: "Tu mensaje se ha guardado. Revísalo y pulsa Enviar.",
  },
  "inquiry.verify_email_first": {
    en: "Verify your email address before sending a message.",
    it: "Verifica il tuo indirizzo email prima di inviare un messaggio.",
    es: "Verifica tu dirección de correo antes de enviar un mensaje.",
  },
  "inquiry.error.generic": {
    en: "Your message could not be sent. Please try again.",
    it: "Impossibile inviare il messaggio. Riprova.",
    es: "No se ha podido enviar el mensaje. Inténtalo de nuevo.",
  },
  "inquiry.error.validation": {
    en: "Please check the highlighted fields.",
    it: "Controlla i campi evidenziati.",
    es: "Revisa los campos indicados.",
  },
  "inquiry.error.rate_limited": {
    en: "You are sending messages too quickly. Please try again shortly.",
    it: "Stai inviando messaggi troppo rapidamente. Riprova tra poco.",
    es: "Estás enviando mensajes demasiado rápido. Inténtalo en unos minutos.",
  },
  "inquiry.error.recipient_unavailable": {
    en: "This recipient cannot receive messages right now.",
    it: "Questo destinatario non può ricevere messaggi al momento.",
    es: "Este destinatario no puede recibir mensajes ahora mismo.",
  },
  "inquiry.error.consent_required": {
    en: "Accept the privacy policy to send your message.",
    it: "Accetta l'informativa sulla privacy per inviare il messaggio.",
    es: "Acepta la política de privacidad para enviar tu mensaje.",
  },
  "inquiry.error.self_inquiry": {
    en: "You cannot send a message to your own listing or profile.",
    it: "Non puoi inviare un messaggio al tuo annuncio o profilo.",
    es: "No puedes enviar un mensaje a tu propio anuncio o perfil.",
  },
  "inquiry.error.feature_disabled": {
    en: "Messaging is temporarily unavailable.",
    it: "La messaggistica non è temporaneamente disponibile.",
    es: "La mensajería no está disponible temporalmente.",
  },
  "inquiry.error.draft_expired": {
    en: "Your saved message expired. Please retype it.",
    it: "Il messaggio salvato è scaduto. Riscrivilo.",
    es: "Tu mensaje guardado ha caducado. Vuelve a escribirlo.",
  },
};

export function tInquiry(locale: Locale, key: string): string {
  const translations = INQUIRY_MESSAGES[key];
  if (!translations) {
    throw new Error(`Unknown inquiry message key: ${key}`);
  }
  return translations[locale] || translations[DEFAULT_LOCALE];
}

/** Replaces {name} placeholders. An unmatched placeholder is left as written,
 *  so a missing value is visible in review rather than rendering "undefined". */
export function formatInquiryMessage(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : match,
  );
}
