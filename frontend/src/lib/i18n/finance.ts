// Spec §37: all new UI text has EN/IT/ES translation keys and no English is
// hard-coded inside components. A typed dictionary, not an i18n framework —
// the same ruling as Phase 5's Task 13. Separate from DIRECTORY_MESSAGES
// because this one interpolates and because finance copy changes for finance
// reasons.
//
// Spec §2.5: no string here may present the estimate as a lender decision.
// finance.test.ts fails the build if "approved", "pre-approved", "guaranteed",
// "offer" or "your rate" (or their Italian/Spanish stems) appears in the EN, IT
// or ES copy; only the spec-mandated disclaimer sentence is exempt.
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/directory";

type Translations = Record<Locale, string>;

export const FINANCE_MESSAGES: Record<string, Translations> = {
  // Spec §18.1 fixes the English label.
  "finance.estimated_payment": {
    en: "Estimated payment",
    it: "Rata stimata",
    es: "Cuota estimada",
  },
  "finance.per_month": { en: "/month", it: "/mese", es: "/mes" },
  // Spec §18.1 fixes the English CTA.
  "finance.calculate": {
    en: "Calculate your financing",
    it: "Calcola il tuo finanziamento",
    es: "Calcula tu financiación",
  },
  // Spec §2.5 mandates this sentence on every result; the English is verbatim.
  // The IT/ES lines carry the same three ideas: illustrative, not a credit
  // offer, taxes/fees/lender conditions excluded.
  "finance.illustrative_disclaimer": {
    en: "Illustrative estimate only. Not a credit offer. Taxes, fees and lender conditions are not included.",
    it: "Stima puramente indicativa. Non è un'offerta di credito. Imposte, commissioni e condizioni del finanziatore non sono incluse.",
    es: "Estimación meramente ilustrativa. No es una oferta de crédito. No se incluyen impuestos, comisiones ni condiciones de la entidad financiera.",
  },
  "finance.months": { en: "{count} months", it: "{count} mesi", es: "{count} meses" },
  "finance.details.show": {
    en: "Show assumptions",
    it: "Mostra le ipotesi",
    es: "Mostrar los supuestos",
  },
  "finance.details.hide": {
    en: "Hide assumptions",
    it: "Nascondi le ipotesi",
    es: "Ocultar los supuestos",
  },
  "finance.details.loading": {
    en: "Calculating…",
    it: "Calcolo in corso…",
    es: "Calculando…",
  },
  "finance.details.error": {
    en: "The estimate could not be calculated right now.",
    it: "Al momento non è stato possibile calcolare la stima.",
    es: "Ahora mismo no se ha podido calcular la estimación.",
  },
  "finance.down_payment": { en: "Down payment", it: "Anticipo", es: "Entrada" },
  "finance.amount_financed": {
    en: "Amount financed",
    it: "Importo finanziato",
    es: "Importe financiado",
  },
  "finance.term": { en: "Term", it: "Durata", es: "Plazo" },
  "finance.annual_rate": { en: "Annual rate", it: "Tasso annuo", es: "Tipo de interés anual" },
  "finance.total_installments": {
    en: "Total installments",
    it: "Totale delle rate",
    es: "Total de las cuotas",
  },
  "finance.total_interest": {
    en: "Total interest",
    it: "Interessi totali",
    es: "Intereses totales",
  },
  // Spec §17.4: "The UI may separately show overall_cash_outlay =
  // total_payment + down_payment_amount but must label it clearly."
  "finance.overall_outlay": {
    en: "Down payment plus all installments",
    it: "Anticipo più tutte le rate",
    es: "Entrada más todas las cuotas",
  },
  "finance.page.title": {
    en: "Financing estimator",
    it: "Calcolatore di finanziamento",
    es: "Calculadora de financiación",
  },
  "finance.page.intro": {
    en: "Estimate a monthly payment from a price, a rate, a term and a down payment.",
    it: "Stima una rata mensile a partire da prezzo, tasso, durata e anticipo.",
    es: "Estima una cuota mensual a partir del precio, la tasa, el plazo y la entrada.",
  },
  "finance.page.listing_context": {
    en: "Values are taken from this listing. Change them below to explore other assumptions.",
    it: "I valori provengono da questo annuncio. Modificali qui sotto per esplorare altre ipotesi.",
    es: "Los valores proceden de este anuncio. Cámbialos abajo para explorar otros supuestos.",
  },
  "finance.page.price": { en: "Price", it: "Prezzo", es: "Precio" },
  "finance.page.recalculate": {
    en: "Recalculate",
    it: "Ricalcola",
    es: "Volver a calcular",
  },
  "finance.page.listing_unavailable": {
    en: "This listing has no financing estimate, so the values below start from the platform defaults.",
    it: "Questo annuncio non prevede una stima di finanziamento: i valori qui sotto partono dalle impostazioni predefinite della piattaforma.",
    es: "Este anuncio no incluye una estimación de financiación, así que los valores de abajo parten de los ajustes predeterminados de la plataforma.",
  },
  "finance.page.generic_error": {
    en: "The estimate could not be calculated. Check the values and try again.",
    it: "Non è stato possibile calcolare la stima. Controlla i valori e riprova.",
    es: "No se ha podido calcular la estimación. Revisa los valores e inténtalo de nuevo.",
  },
  // Spec §37 names `listing.views` in its minimum key list. The card renders a
  // bare number beside the eye icon (spec §18.1) and labels it with
  // listing.views_label, so the standalone noun is the one a labelled count
  // uses — Phase 10's owner dashboards and any "N views" column (spec §19.5).
  // It is kept here, in all three languages, so that phase does not re-coin it.
  "listing.views": { en: "views", it: "visualizzazioni", es: "visualizaciones" },
  "listing.views_label": {
    en: "{count} views",
    it: "{count} visualizzazioni",
    es: "{count} visualizaciones",
  },
  // Spec §18.4 fixes the English field-group title and toggle label.
  "listing.finance_group_title": {
    en: "Financing estimate",
    it: "Stima di finanziamento",
    es: "Estimación de financiación",
  },
  "listing.finance_toggle": {
    en: "Show an estimated monthly payment on this listing",
    it: "Mostra una rata mensile stimata su questo annuncio",
    es: "Mostrar una cuota mensual estimada en este anuncio",
  },
  "listing.finance_group_help": {
    en: "Buyers see an illustrative monthly payment calculated from these assumptions. It is not a credit application and no bank is involved.",
    it: "Gli acquirenti vedono una rata mensile indicativa calcolata da queste ipotesi. Non è una richiesta di credito e nessuna banca è coinvolta.",
    es: "Los compradores ven una cuota mensual ilustrativa calculada con estos supuestos. No es una solicitud de crédito y no interviene ningún banco.",
  },
  // Spec §18.4's optional custom-assumptions control.
  "listing.finance_custom_assumptions": {
    en: "Use custom assumptions for this listing",
    it: "Usa ipotesi personalizzate per questo annuncio",
    es: "Usar supuestos personalizados para este anuncio",
  },
  "listing.finance_platform_defaults": {
    en: "Platform defaults",
    it: "Impostazioni predefinite della piattaforma",
    es: "Ajustes predeterminados de la plataforma",
  },
  "boats.title": { en: "Boats for sale", it: "Barche in vendita", es: "Barcos en venta" },
  "boats.intro": {
    en: "Published listings from private sellers and brokers in Spain and Italy.",
    it: "Annunci pubblicati da privati e broker in Spagna e in Italia.",
    es: "Anuncios publicados por particulares y brókeres en España e Italia.",
  },
  "boats.empty": {
    en: "No boats are published yet.",
    it: "Non ci sono ancora barche pubblicate.",
    es: "Todavía no hay barcos publicados.",
  },
  "boats.previous": { en: "Previous", it: "Precedenti", es: "Anteriores" },
  "boats.next": { en: "Next", it: "Successivi", es: "Siguientes" },
};

const PLACEHOLDER = /\{(\w+)\}/g;

// One pass over the template: a parameter value is inserted verbatim and is
// never re-scanned, so a value such as "{count}" or "$&" cannot be expanded or
// interpreted as a replacement pattern. A placeholder with no matching own
// parameter is left visible rather than silently blanked.
export function translate(
  messages: Record<string, Translations>,
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  if (!Object.hasOwn(messages, key)) {
    throw new Error(`Unknown finance message key: ${key}`);
  }
  const translations = messages[key];
  const template = translations[locale] || translations[DEFAULT_LOCALE];
  return template.replace(PLACEHOLDER, (placeholder, name: string) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

export function tf(
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {},
): string {
  return translate(FINANCE_MESSAGES, locale, key, params);
}

// Spec §36.1: "Currency symbol/format is localized; calculation uses numeric
// amount/currency code." The interface language is a two-letter code; Intl
// needs a tag. Spain and Italy are exact; en-IE is the euro-native English
// locale, so an English reader of a Spanish or Italian listing does not get
// British or American grouping over a euro amount.
const INTL_LOCALES: Record<Locale, string> = {
  en: "en-IE",
  it: "it-IT",
  es: "es-ES",
};

const DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

/**
 * True for a plain decimal string ("0", "12.5", "-3.20"). formatMoney throws on
 * anything else, so a caller holding user-controlled input (for example a
 * tampered ?price= query parameter, spec 18.3) must check this first.
 */
export function isDecimalString(value: string): boolean {
  return DECIMAL_STRING.test(value);
}

/**
 * Format a decimal string from the API for display.
 *
 * The string is handed to Intl as a string (ES2023 NumberFormat accepts exact
 * decimal strings), so it is never converted to a float and no digit can be
 * lost; the server value is authoritative (spec §17 definition of done). No
 * arithmetic is performed. Anything that is not a plain decimal string throws a
 * RangeError instead of rendering "NaN". A malformed currency code also throws
 * a RangeError (from Intl); a lowercase code is normalised by Intl. Fraction digits are fixed at two for every currency (the platform is euro); a zero-decimal currency such as JPY is shown with .00. Output is
 * ICU's own, including the no-break space in it-IT / es-ES, and is not
 * post-processed.
 */
export function formatMoney(locale: Locale, amount: string, currency: string): string {
  if (!isDecimalString(amount)) {
    throw new RangeError(`Invalid decimal amount: ${JSON.stringify(amount)}`);
  }
  // amount is validated above, so the `${number}` cast the lib typing asks for holds.
  return new Intl.NumberFormat(INTL_LOCALES[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount as `${number}`);
}

export function formatCount(locale: Locale, value: number): string {
  return new Intl.NumberFormat(INTL_LOCALES[locale]).format(value);
}
