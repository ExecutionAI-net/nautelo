// Site text. The English lives in source.en.json (one flat file, the only place a developer writes words);
// Italian and Spanish come from Django (machine translation, edited by staff). A key that is missing, or a
// language that is unreachable, falls back to the English written here, so a page can never come out blank.
import source from "./source.en.json";

export type MessageKey = keyof typeof source;
export type Messages = Record<string, string>;
export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export const SOURCE_TEXT: Record<string, string> = source;

export function interpolate(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : whole));
}

/** Build `t` for a bundle of published translations (may be empty). */
export function makeTranslate(messages: Messages | null | undefined): Translate {
  return (key, vars) => interpolate(messages?.[key] || SOURCE_TEXT[key] || key, vars);
}
