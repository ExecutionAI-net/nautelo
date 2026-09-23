// EN/IT/ES copy for the "feature your listing" pop-up.
import type { Locale } from "@/lib/i18n/directory";

type Entry = Record<Locale, string>;

const PROMO: Record<string, Entry> = {
  "promo.title": {
    en: "Put your boat in front of more buyers",
    it: "Metti la tua barca davanti a più acquirenti",
    es: "Pon tu barco delante de más compradores",
  },
  "promo.lead": {
    en: "Featured boats appear on the Nautelo home page and are shown first to people who are looking.",
    it: "Le barche in evidenza compaiono nella home di Nautelo e vengono mostrate per prime a chi cerca.",
    es: "Los barcos destacados aparecen en la página de inicio de Nautelo y se muestran primero a quien busca.",
  },
  "promo.point1": {
    en: "A place on the home page, in the moving Featured strip",
    it: "Un posto nella home, nella fascia In evidenza in movimento",
    es: "Un lugar en la página de inicio, en la franja Destacados en movimiento",
  },
  "promo.point2": {
    en: "A Featured badge that makes your listing stand out in search",
    it: "Un badge In evidenza che fa risaltare il tuo annuncio nelle ricerche",
    es: "Una insignia Destacado que hace que tu anuncio resalte en las búsquedas",
  },
  "promo.point3": {
    en: "Your promotion starts when your listing goes live, not before",
    it: "La promozione parte quando il tuo annuncio è online, non prima",
    es: "La promoción empieza cuando tu anuncio está publicado, no antes",
  },
  "promo.preview": { en: "How it will look", it: "Come apparirà", es: "Así se verá" },
  "promo.badge": { en: "Featured", it: "In evidenza", es: "Destacado" },
  "promo.popular": { en: "Most popular", it: "Più scelto", es: "Más elegido" },
  "promo.days": { en: "{count} days", it: "{count} giorni", es: "{count} días" },
  "promo.cta": { en: "Promote my boat for {price}", it: "Promuovi la mia barca a {price}", es: "Promocionar mi barco por {price}" },
  "promo.skip": { en: "Skip, continue without promotion", it: "Salta, continua senza promozione", es: "Omitir, continuar sin promoción" },
  "promo.secure": { en: "Secure payment with Stripe.", it: "Pagamento sicuro con Stripe.", es: "Pago seguro con Stripe." },
  "promo.error": {
    en: "Payment could not be opened. You can skip this and promote later.",
    it: "Impossibile aprire il pagamento. Puoi saltare e promuovere più tardi.",
    es: "No se pudo abrir el pago. Puedes omitir y promocionar más tarde.",
  },
  "promo.paid": {
    en: "Promotion paid. It starts as soon as your listing goes live.",
    it: "Promozione pagata. Parte non appena il tuo annuncio è online.",
    es: "Promoción pagada. Empieza en cuanto tu anuncio esté publicado.",
  },
  "promo.later": { en: "Promote", it: "Promuovi", es: "Promocionar" },
};

export function tPromo(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const entry = PROMO[key];
  if (!entry) throw new Error(`Unknown promo message key: ${key}`);
  return (entry[locale] || entry.en).replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : m));
}
