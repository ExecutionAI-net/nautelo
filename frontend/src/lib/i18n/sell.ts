// EN/IT/ES copy for the seller listing form (spec 37).
import type { Locale } from "@/lib/i18n/directory";

type Entry = Record<Locale, string>;

const SELL: Record<string, Entry> = {
  "sell.title": { en: "Sell your boat", it: "Vendi la tua barca", es: "Vende tu barco" },
  "sell.brand_search": { en: "Search brand", it: "Cerca marca", es: "Buscar marca" },
  "sell.brand": { en: "Brand", it: "Marca", es: "Marca" },
  "sell.current_brand": { en: "Current brand", it: "Marca attuale", es: "Marca actual" },
  "sell.model": { en: "Model", it: "Modello", es: "Modelo" },
  "sell.model_name": { en: "Model name", it: "Nome del modello", es: "Nombre del modelo" },
  "sell.select": { en: "Select…", it: "Seleziona…", es: "Seleccionar…" },
  "sell.year": { en: "Year", it: "Anno", es: "Año" },
  "sell.listing_title": { en: "Title", it: "Titolo", es: "Título" },
  "sell.description": { en: "Description", it: "Descrizione", es: "Descripción" },
  "sell.country": {
    en: "Country (2-letter code)",
    it: "Paese (codice a 2 lettere)",
    es: "País (código de 2 letras)",
  },
  "sell.city": { en: "City", it: "Città", es: "Ciudad" },
  "sell.price": { en: "Price (EUR)", it: "Prezzo (EUR)", es: "Precio (EUR)" },
  "sell.save_draft": { en: "Save draft", it: "Salva bozza", es: "Guardar borrador" },
  "sell.save_changes": { en: "Save changes", it: "Salva modifiche", es: "Guardar cambios" },
  "sell.submitted": {
    en: "Your listing was submitted for review.",
    it: "Il tuo annuncio è stato inviato per la revisione.",
    es: "Tu anuncio se ha enviado a revisión.",
  },
  "sell.submit": { en: "Submit for review", it: "Invia per la revisione", es: "Enviar a revisión" },
  "sell.media": { en: "Photos and videos", it: "Foto e video", es: "Fotos y vídeos" },
  "sell.media_limits": {
    en: "Up to {images} images and {videos} videos.",
    it: "Fino a {images} immagini e {videos} video.",
    es: "Hasta {images} imágenes y {videos} vídeos.",
  },
  "sell.add_media": { en: "Add media", it: "Aggiungi media", es: "Añadir archivos" },
  "sell.remove": { en: "Remove", it: "Rimuovi", es: "Quitar" },
  "sell.finance_title": {
    en: "Financing estimate",
    it: "Stima di finanziamento",
    es: "Estimación de financiación",
  },
  "sell.finance_toggle": {
    en: "Show an estimated monthly payment on this listing",
    it: "Mostra una rata mensile stimata su questo annuncio",
    es: "Mostrar una cuota mensual estimada en este anuncio",
  },
  "sell.finance_help": {
    en: "Leave blank to use the platform defaults. The estimate is illustrative and not a credit offer.",
    it: "Lascia vuoto per usare i valori predefiniti. La stima è indicativa e non è un'offerta di credito.",
    es: "Déjalo en blanco para usar los valores predeterminados. La estimación es ilustrativa y no es una oferta de crédito.",
  },
  "sell.down_override": {
    en: "Down payment override (%)",
    it: "Anticipo personalizzato (%)",
    es: "Entrada personalizada (%)",
  },
  "sell.rate_override": {
    en: "Annual rate override (%)",
    it: "Tasso annuo personalizzato (%)",
    es: "Tipo anual personalizado (%)",
  },
  "sell.term_override": {
    en: "Term override (months)",
    it: "Durata personalizzata (mesi)",
    es: "Plazo personalizado (meses)",
  },
  "sell.request_failed": {
    en: "The request failed.",
    it: "La richiesta non è riuscita.",
    es: "La solicitud ha fallado.",
  },
};

export function tSell(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const entry = SELL[key];
  if (!entry) throw new Error(`Unknown sell message key: ${key}`);
  return (entry[locale] || entry.en).replace(/\{(\w+)\}/g, (m, name) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : m,
  );
}
