import type { Locale } from "@/lib/i18n/directory";

const HOME = {
  "home.title": {
    en: "Find your next boat",
    it: "Trova la tua prossima barca",
    es: "Encuentra tu próximo barco",
  },
  "home.intro": {
    en: "Boats from private sellers and brokers in Spain and Italy, plus the nautical professionals who look after them.",
    it: "Barche di privati e broker in Spagna e in Italia, e i professionisti nautici che se ne prendono cura.",
    es: "Barcos de particulares y brókeres en España e Italia, y los profesionales náuticos que los cuidan.",
  },
  "home.browse": { en: "Browse boats", it: "Sfoglia le barche", es: "Ver barcos" },
  "home.sell": { en: "Sell your boat", it: "Vendi la tua barca", es: "Vende tu barco" },
  "home.services": { en: "Find a professional", it: "Trova un professionista", es: "Busca un profesional" },
  "home.latest": { en: "Latest boats", it: "Ultime barche", es: "Últimos barcos" },
} as const;

export function tHome(locale: Locale, key: keyof typeof HOME): string {
  return HOME[key][locale] || HOME[key].en;
}
