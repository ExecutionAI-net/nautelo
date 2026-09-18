import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/directory";
import {
  FINANCE_MESSAGES,
  formatCount,
  formatMoney,
  isDecimalString,
  tf,
  translate,
} from "@/lib/i18n/finance";

// ICU (it-IT / es-ES) puts a no-break space (U+00A0, or U+202F in some
// versions) before the euro sign. Different ICU builds (CI runs Node 22, local
// may be newer) disagree on which, so outputs are compared after normalising
// those to a plain space; symbol placement, separators and fraction digits are
// still pinned exactly.
const norm = (s: string) => s.replace(/[  ]/g, " ");
const fm = (locale: Locale, amount: string, currency = "EUR") =>
  norm(formatMoney(locale, amount, currency));

// Spec 2.5 (approved, pre-approved, guaranteed, offer, your rate) plus their
// Italian / Spanish stems. The one sentence the spec itself mandates contains
// "offer", so exactly that sentence is removed from the disclaimer key before
// scanning; every other key, and any extra text in the disclaimer, is scanned.
const FORBIDDEN: Record<Locale, RegExp> = {
  en: /(approv|guarante|pre-?qualif|offer|your rate)/i,
  // "sicur"/"segur" are deliberately not stems: sicurezza, assicurazione,
  // seguridad, seguro, aseguradora are legitimate boat-marketplace copy. Only
  // the promissory phrase forms are forbidden.
  it: /(approv|garan|offert|il tuo tasso|i tuoi tassi|finanziamento sicuro|esito sicuro)/i,
  es: /(aprob|aprueb|garant|oferta|tus? (tasas?|tipos?)|financiación segura)/i,
};
const MANDATED_SENTENCE: Record<Locale, string> = {
  en: "Not a credit offer.",
  it: "Non è un'offerta di credito.",
  es: "No es una oferta de crédito.",
};
const DISCLAIMER_KEY = "finance.illustrative_disclaimer";
function forbiddenHit(locale: Locale, key: string, text: string): boolean {
  const scanned =
    key === DISCLAIMER_KEY ? text.replace(MANDATED_SENTENCE[locale], "") : text;
  return FORBIDDEN[locale].test(scanned);
}

const HOSTILE: Record<Locale, string[]> = {
  en: [
    "You are approved",
    "Pre-approved financing",
    "Pre-qualified offers, guarantee your rates",
    "Guaranteed monthly payment",
    "Special offer for you",
    "Check your rate",
  ],
  it: [
    "Finanziamento approvato",
    "Preapprovazione immediata",
    "Finanziamento sicuro e la tua offerte",
    "Rata garantita",
    "Scopri il tuo tasso",
    "Scopri i tuoi tassi",
    "Con garanzia immediata",
    "Puoi approvare la pratica",
    "Rata approvabile",
    "Il finanziamento verrà approvato",
    "La banca approverà la richiesta",
    "Finanziamento sicuro",
    "Esito sicuro",
  ],
  es: [
    "Financiación aprobada",
    "Calcula tus ofertas de financiación segura con tu tasa",
    "Cuota garantizada",
    "Tu tipo de interés",
    "Aprobación inmediata",
    "Puedes aprobar la solicitud",
    "El banco aprueba tu cuota",
    "Se aprobará en minutos",
    "Descubre tus tasas",
    "Con garantía total",
    "Financiación segura",
  ],
};

// Legitimate marketplace copy that must never be rejected.
const BENIGN: Record<Locale, string[]> = {
  en: ["Boat insurance", "Safety equipment included"],
  it: ["Sicurezza a bordo", "Assicurazione dell'imbarcazione", "Dotazioni di sicurezza"],
  es: [
    "Seguridad a bordo",
    "Seguro de la embarcación",
    "Aseguradora recomendada",
    "Equipo de seguridad incluido",
  ],
};

describe("FINANCE_MESSAGES", () => {
  it("is not empty", () => {
    expect(Object.keys(FINANCE_MESSAGES).length).toBeGreaterThan(30);
  });

  it("has exactly the supported locales, non-empty, for every key", () => {
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      expect(Object.keys(translations).sort(), key).toEqual([...SUPPORTED_LOCALES].sort());
      for (const locale of SUPPORTED_LOCALES) {
        const value = translations[locale];
        expect(typeof value, `${key}.${locale}`).toBe("string");
        expect(value.trim(), `${key}.${locale}`).not.toBe("");
      }
    }
  });

  it("uses the same {placeholders} in every locale of a key", () => {
    const names = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(names(translations[locale]), `${key}.${locale}`).toEqual(names(translations.en));
      }
    }
  });

  it("carries the spec 37 keys this phase is responsible for", () => {
    for (const key of [
      "finance.estimated_payment",
      "finance.calculate",
      "finance.illustrative_disclaimer",
      "listing.views",
      "listing.finance_toggle",
    ]) {
      expect(FINANCE_MESSAGES[key], key).toBeDefined();
    }
  });

  it("fixes the spec-mandated English labels", () => {
    expect(FINANCE_MESSAGES["finance.estimated_payment"].en).toBe("Estimated payment");
    expect(FINANCE_MESSAGES["finance.calculate"].en).toBe("Calculate your financing");
    expect(FINANCE_MESSAGES["listing.finance_group_title"].en).toBe("Financing estimate");
  });

  it("pins the spec 18.1 and 18.4 strings", () => {
    expect(FINANCE_MESSAGES["finance.per_month"].en).toBe("/month");
    expect(FINANCE_MESSAGES["listing.finance_toggle"].en).toBe(
      "Show an estimated monthly payment on this listing",
    );
  });

  it("never presents the estimate as a lender decision (spec 2.5), in any locale", () => {
    for (const [key, translations] of Object.entries(FINANCE_MESSAGES)) {
      for (const locale of SUPPORTED_LOCALES) {
        expect(forbiddenHit(locale, key, translations[locale]), `${key}.${locale}`).toBe(false);
      }
    }
  });

  it("the forbidden-language scan rejects hostile samples in every language", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const sample of HOSTILE[locale]) {
        expect(forbiddenHit(locale, "some.key", sample), `${locale}: ${sample}`).toBe(true);
      }
    }
  });

  it("the forbidden-language scan does not reject legitimate insurance and safety copy", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const sample of BENIGN[locale]) {
        expect(forbiddenHit(locale, "some.key", sample), `${locale}: ${sample}`).toBe(false);
      }
    }
  });

  it("exempts only the spec-mandated sentence, and only in the disclaimer key", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const sentence = MANDATED_SENTENCE[locale];
      expect(forbiddenHit(locale, DISCLAIMER_KEY, sentence)).toBe(false);
      expect(forbiddenHit(locale, "finance.calculate", sentence)).toBe(true);
    }
    expect(forbiddenHit("en", DISCLAIMER_KEY, "Not a credit offer. Best offer.")).toBe(true);
    expect(forbiddenHit("it", DISCLAIMER_KEY, "Non è un'offerta di credito. Garanzia totale.")).toBe(true);
    expect(forbiddenHit("es", DISCLAIMER_KEY, "No es una oferta de crédito. Garantía total.")).toBe(true);
  });

  it("carries the spec 2.5 disclaimer verbatim in English", () => {
    expect(FINANCE_MESSAGES[DISCLAIMER_KEY].en).toBe(
      "Illustrative estimate only. Not a credit offer. Taxes, fees and lender conditions are not included.",
    );
  });

  it("carries the three disclaimer ideas in Italian and Spanish", () => {
    const d = FINANCE_MESSAGES[DISCLAIMER_KEY];
    expect(d.it).toMatch(/indicativa/);
    expect(d.it).toContain(MANDATED_SENTENCE.it);
    expect(d.it).toMatch(/Imposte/);
    expect(d.it).toMatch(/commissioni/);
    expect(d.it).toMatch(/condizioni del finanziatore/);
    expect(d.it).toMatch(/non sono incluse/);
    expect(d.es).toMatch(/ilustrativa/);
    expect(d.es).toContain(MANDATED_SENTENCE.es);
    expect(d.es).toMatch(/No se incluyen impuestos/);
    expect(d.es).toMatch(/comisiones/);
    expect(d.es).toMatch(/condiciones de la entidad financiera/);
  });

  it("uses the agreed Spanish terminology", () => {
    expect(FINANCE_MESSAGES["finance.annual_rate"].es).toBe("Tipo de interés anual");
    expect(FINANCE_MESSAGES["listing.views"].es).toBe("visualizaciones");
    expect(FINANCE_MESSAGES["listing.views_label"].es).toBe("{count} visualizaciones");
    expect(FINANCE_MESSAGES["finance.details.show"].es).toBe("Mostrar los supuestos");
    expect(FINANCE_MESSAGES["finance.details.hide"].es).toBe("Ocultar los supuestos");
  });
});

describe("tf", () => {
  it("throws on an unknown key rather than rendering it", () => {
    expect(() => tf("en", "finance.nope")).toThrow(
      /Unknown finance message key: finance.nope/,
    );
    expect(() => tf("it", "")).toThrow(/Unknown finance message key/);
  });

  it("does not resolve inherited object keys as messages", () => {
    expect(() => tf("en", "toString")).toThrow(/Unknown finance message key/);
    expect(() => tf("en", "constructor")).toThrow(/Unknown finance message key/);
    expect(() => tf("en", "__proto__")).toThrow(/Unknown finance message key/);
  });

  it("substitutes named parameters in each locale", () => {
    expect(tf("en", "finance.months", { count: 48 })).toBe("48 months");
    expect(tf("it", "finance.months", { count: 48 })).toBe("48 mesi");
    expect(tf("es", "finance.months", { count: 48 })).toBe("48 meses");
  });

  it("substitutes string params and zero", () => {
    expect(tf("en", "finance.months", { count: 0 })).toBe("0 months");
    expect(tf("en", "finance.months", { count: "12" })).toBe("12 months");
  });

  it("returns the message unchanged when it has no placeholders, ignoring extra params", () => {
    expect(tf("en", "finance.calculate")).toBe("Calculate your financing");
    expect(tf("en", "finance.calculate", { count: 3, other: "x" })).toBe(
      "Calculate your financing",
    );
    expect(tf("en", "finance.months", { count: 3, extra: "x" })).toBe("3 months");
  });

  it("leaves a placeholder visible when its param is missing", () => {
    expect(tf("en", "finance.months")).toBe("{count} months");
    expect(tf("en", "finance.months", {})).toBe("{count} months");
    expect(tf("en", "finance.months", { other: 1 })).toBe("{count} months");
  });

  it("does not treat param values as patterns or re-substitute them", () => {
    expect(tf("en", "finance.months", { count: "$&" })).toBe("$& months");
    expect(tf("en", "finance.months", { count: "$1$$" })).toBe("$1$$ months");
    expect(tf("en", "finance.months", { count: "a.*b(c)[d]" })).toBe("a.*b(c)[d] months");
    expect(tf("en", "finance.months", { count: "{count}" })).toBe("{count} months");
    expect(tf("en", "finance.months", { count: "{x}}" })).toBe("{x}} months");
  });

  it("never expands a placeholder that appears inside another param's value", () => {
    const dict = { "t.two": { en: "{a} / {b}", it: "{a} / {b}", es: "{a} / {b}" } };
    expect(translate(dict, "en", "t.two", { a: "{b}", b: "B" })).toBe("{b} / B");
    expect(translate(dict, "en", "t.two", { b: "{a}", a: "A" })).toBe("A / {a}");
  });

  it("only substitutes own properties of params, not inherited ones", () => {
    const params = Object.create({ count: "1" }) as Record<string, string>;
    expect(tf("en", "finance.months", params)).toBe("{count} months");
  });

  it("ignores param names with regex metacharacters that are not placeholders", () => {
    expect(tf("en", "finance.months", { "c.*": "X", count: 1 })).toBe("1 months");
  });

  it("falls back to the default locale for a locale missing from a message", () => {
    const dict = { "t.term": { en: "Term" } as Record<Locale, string> };
    expect(translate(dict, "it", "t.term")).toBe("Term");
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("translate works on any dictionary and tf uses the shared one", () => {
    const dict = { "finance.months": { en: "X {count}", it: "Y {count}", es: "Z {count}" } };
    expect(translate(dict, "es", "finance.months", { count: 1 })).toBe("Z 1");
    expect(tf("es", "finance.months", { count: 1 })).toBe("1 meses");
  });
});

describe("isDecimalString", () => {
  it("accepts plain decimal strings", () => {
    for (const ok of ["0", "12", "12.5", "1234567.89", "0.00", "-3.20"]) {
      expect(isDecimalString(ok), ok).toBe(true);
    }
  });

  it("rejects everything else", () => {
    const bad = ["", " ", "1e5", "0x10", "abc", "1,5", "-", "+1", "1.", ".5", "NaN", "1 2"];
    for (const value of bad) {
      expect(isDecimalString(value), JSON.stringify(value)).toBe(false);
    }
  });
});

describe("formatMoney", () => {
  it("formats a decimal string as euro for the interface language", () => {
    expect(fm("en", "8456.36")).toBe("€8,456.36");
    // it/es: 4-digit numbers are not grouped by newer ICU, grouped by older.
    expect(fm("it", "8456.36")).toMatch(/^8\.?456,36 €$/);
    expect(fm("es", "8456.36")).toMatch(/^8\.?456,36 €$/);
  });

  it("keeps both decimals on a round amount", () => {
    expect(fm("en", "459000.00")).toBe("€459,000.00");
    expect(fm("it", "459000.00")).toBe("459.000,00 €");
    expect(fm("es", "459000.00")).toBe("459.000,00 €");
    expect(fm("en", "1234.5")).toBe("€1,234.50");
    expect(fm("en", "7")).toBe("€7.00");
    expect(fm("en", "5")).toBe("€5.00");
    expect(fm("it", "5")).toBe("5,00 €");
  });

  it("uses two fraction digits for every currency, including zero-decimal ones", () => {
    expect(fm("en", "5", "JPY")).toMatch(/5\.00$/);
    expect(fm("en", "5.129", "EUR")).toBe("€5.13");
  });

  it("formats zero and negatives", () => {
    expect(fm("en", "0")).toBe("€0.00");
    expect(fm("en", "0.00")).toBe("€0.00");
    expect(fm("it", "0.00")).toBe("0,00 €");
    expect(fm("en", "-8456.36")).toBe("-€8,456.36");
    expect(fm("es", "-8456.36")).toMatch(/^-8\.?456,36 €$/);
  });

  it("formats the spec 17.3 ceiling exactly", () => {
    expect(fm("en", "999999999.99")).toBe("€999,999,999.99");
    expect(fm("it", "999999999.99")).toBe("999.999.999,99 €");
  });

  it("never routes the decimal string through a float", () => {
    // 2^53 + 1 and a 17-digit cent amount are not representable as doubles.
    expect(fm("en", "9007199254740993.00")).toBe("€9,007,199,254,740,993.00");
    expect(fm("en", "12345678901234567.89")).toBe("€12,345,678,901,234,567.89");
    expect(fm("es", "12345678901234567.89")).toBe("12.345.678.901.234.567,89 €");
  });

  it("puts the currency symbol and decimal separator where each locale expects them", () => {
    expect(fm("en", "1.50")).toBe("€1.50");
    expect(fm("it", "1.50")).toBe("1,50 €");
    expect(fm("es", "1.50")).toBe("1,50 €");
  });

  it("uses the currency code it is given", () => {
    expect(fm("en", "1", "USD")).toBe("US$1.00");
  });

  it("accepts a lowercase currency code, formatted like the uppercase one", () => {
    expect(formatMoney("en", "1", "eur")).toBe(formatMoney("en", "1", "EUR"));
  });

  it("rejects a malformed currency code", () => {
    expect(() => formatMoney("en", "1", "EURO")).toThrow(RangeError);
    expect(() => formatMoney("en", "1", "")).toThrow(RangeError);
    expect(() => formatMoney("en", "1", "E1R")).toThrow(RangeError);
  });

  it("rejects amounts that are not plain decimal strings instead of rendering NaN", () => {
    const bad = [
      "", " ", "abc", "NaN", "Infinity", "1e5", "0x10", "1,234.50", "12.", ".5", "--1", "1 2",
      "€5", "+1", "-",
    ];
    for (const amount of bad) {
      expect(() => formatMoney("en", amount, "EUR"), JSON.stringify(amount)).toThrow(RangeError);
    }
  });
});

describe("formatCount", () => {
  it("groups thousands for the interface language", () => {
    expect(formatCount("en", 12345)).toBe("12,345");
    expect(formatCount("it", 12345)).toBe("12.345");
    expect(formatCount("es", 12345)).toBe("12.345");
  });

  it("formats zero and small numbers", () => {
    expect(formatCount("en", 0)).toBe("0");
    expect(formatCount("en", 999)).toBe("999");
    expect(formatCount("en", 1000000)).toBe("1,000,000");
    expect(formatCount("it", 1000000)).toBe("1.000.000");
  });
});
