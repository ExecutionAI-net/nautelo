// EN/IT/ES copy for the financing simulator.
import type { Locale } from "@/lib/i18n/directory";

type Entry = Record<Locale, string>;

const SIM: Record<string, Entry> = {
  "sim.eyebrow": { en: "Financing", it: "Finanziamento", es: "Financiación" },
  "sim.title": { en: "See what your boat could cost per month", it: "Scopri quanto potrebbe costare la tua barca al mese", es: "Descubre cuánto podría costar tu barco al mes" },
  "sim.lead": {
    en: "A quick, non-binding estimate for a loan or a leasing in Spain or Italy. Change the sliders and the figures follow.",
    it: "Una stima rapida e non vincolante per un finanziamento o un leasing in Spagna o in Italia. Muovi i cursori e le cifre si aggiornano.",
    es: "Una estimación rápida y sin compromiso para un préstamo o un leasing en España o Italia. Mueve los deslizadores y las cifras se actualizan.",
  },
  "sim.point1": { en: "Loan or leasing side by side", it: "Finanziamento o leasing a confronto", es: "Préstamo o leasing, lado a lado" },
  "sim.point2": { en: "VAT shown where it applies", it: "IVA indicata dove si applica", es: "IVA visible cuando corresponde" },
  "sim.point3": { en: "Spain or Italy, no cross-border mixes", it: "Spagna o Italia, senza incroci", es: "España o Italia, sin cruces" },
  "sim.mode.price": { en: "I know the price", it: "Conosco il prezzo", es: "Conozco el precio" },
  "sim.mode.budget": { en: "I have a monthly budget", it: "Ho un budget mensile", es: "Tengo un presupuesto mensual" },
  "sim.price": { en: "Boat price (VAT included)", it: "Prezzo della barca (IVA inclusa)", es: "Precio del barco (IVA incluido)" },
  "sim.budget": { en: "Monthly budget", it: "Budget mensile", es: "Presupuesto mensual" },
  "sim.down": { en: "Down payment", it: "Anticipo", es: "Entrada" },
  "sim.term": { en: "Term", it: "Durata", es: "Plazo" },
  "sim.years": { en: "{count} years", it: "{count} anni", es: "{count} años" },
  "sim.product": { en: "Type of financing", it: "Tipo di finanziamento", es: "Tipo de financiación" },
  "sim.loan": { en: "Loan", it: "Finanziamento", es: "Préstamo" },
  "sim.leasing": { en: "Leasing", it: "Leasing", es: "Leasing" },
  "sim.more": { en: "More options", it: "Altre opzioni", es: "Más opciones" },
  "sim.country": { en: "Country", it: "Paese", es: "País" },
  "sim.ES": { en: "Spain", it: "Spagna", es: "España" },
  "sim.IT": { en: "Italy", it: "Italia", es: "Italia" },
  "sim.condition": { en: "Boat condition", it: "Condizione", es: "Estado del barco" },
  "sim.new": { en: "New", it: "Nuova", es: "Nuevo" },
  "sim.used": { en: "Used", it: "Usata", es: "De ocasión" },
  "sim.year": { en: "Year of the boat", it: "Anno della barca", es: "Año del barco" },
  "sim.use": { en: "Use", it: "Uso", es: "Uso" },
  "sim.private": { en: "Private", it: "Privato", es: "Particular" },
  "sim.company": { en: "Company / charter", it: "Azienda / charter", es: "Empresa / charter" },
  "sim.age.note": {
    en: "Boat of {age} years: the term is limited by the age rule (age + term at most {limit}).",
    it: "Barca di {age} anni: la durata è limitata dalla regola dell'età (età + durata al massimo {limit}).",
    es: "Barco de {age} años: el plazo se limita por la regla de edad (edad + plazo máximo {limit}).",
  },
  "sim.age.none": {
    en: "No term is available for a boat this old with this product.",
    it: "Nessuna durata disponibile per una barca di questa età con questo prodotto.",
    es: "No hay plazo disponible para un barco de esta antigüedad con este producto.",
  },
  "sim.result.monthly": { en: "Estimated monthly payment", it: "Rata mensile stimata", es: "Cuota mensual estimada" },
  "sim.result.month": { en: "/month", it: "/mese", es: "/mes" },
  "sim.result.with_vat": { en: "with VAT", it: "con IVA", es: "con IVA" },
  "sim.result.without_vat": { en: "{amount}/month without VAT", it: "{amount}/mese senza IVA", es: "{amount}/mes sin IVA" },
  "sim.result.financed": { en: "Financed", it: "Finanziato", es: "Financiado" },
  "sim.result.total": { en: "Total repaid", it: "Totale rimborsato", es: "Total a pagar" },
  "sim.result.cost": { en: "Cost of financing", it: "Costo del finanziamento", es: "Coste de la financiación" },
  "sim.result.residual": { en: "Purchase option at the end", it: "Riscatto a fine contratto", es: "Opción de compra al final" },
  "sim.example": { en: "Representative example: {months} months, TIN {tin}%{tae}.", it: "Esempio rappresentativo: {months} mesi, TAN {tin}%{tae}.", es: "Ejemplo representativo: {months} meses, TIN {tin}%{tae}." },
  "sim.example.tae": { en: ", APR {tae}%", it: ", TAEG {tae}%", es: ", TAE {tae}%" },
  "sim.reverse.title": { en: "With this budget you could look at boats up to", it: "Con questo budget puoi guardare barche fino a", es: "Con este presupuesto puedes mirar barcos de hasta" },
  "sim.reverse.cta": { en: "See boats in this budget", it: "Vedi le barche in questo budget", es: "Ver barcos en este presupuesto" },
  "sim.reverse.count": { en: "{count} boats listed", it: "{count} barche in vendita", es: "{count} barcos publicados" },
  "sim.cta": { en: "Ask for a financing study", it: "Richiedi uno studio di finanziamento", es: "Solicitar estudio de financiación" },
  "sim.disclaimer": {
    en: "Indicative estimate, not an offer. Rates and terms are decided by the lender. Domestic operations only. Nauta does not lend money.",
    it: "Stima indicativa, non un'offerta. Tassi e condizioni sono decisi dal finanziatore. Solo operazioni nazionali. Nauta non presta denaro.",
    es: "Estimación orientativa, no una oferta. Los tipos y plazos los decide la entidad. Solo operaciones nacionales. Nauta no presta dinero.",
  },
  "sim.unavailable": { en: "The simulator is not available right now.", it: "Il simulatore non è disponibile al momento.", es: "El simulador no está disponible ahora." },
  "sim.no_rule": { en: "No financing rule covers this combination yet.", it: "Nessuna regola copre ancora questa combinazione.", es: "Ninguna regla cubre todavía esta combinación." },
};

export function tSim(locale: Locale, key: string, vars: Record<string, string | number> = {}): string {
  const entry = SIM[key];
  if (!entry) throw new Error(`Unknown simulator message key: ${key}`);
  return (entry[locale] || entry.en).replace(/\{(\w+)\}/g, (m, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : m));
}
