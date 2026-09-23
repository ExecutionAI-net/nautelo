// Closed-list specification values (backend/listings/form_options.py) are stored
// in English; these helpers show them in the visitor's language.
import { SOURCE_TEXT, type MessageKey, type Translate } from "@/i18n";

export function specValueKey(value: string): string {
  return `spec.value.${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

/** The translated label of a stored value, or the value itself when it is free text. */
export function specValueLabel(t: Translate, value: unknown): string {
  if (typeof value !== "string" || !value) return value == null ? "" : String(value);
  const key = specValueKey(value);
  return key in SOURCE_TEXT ? t(key as MessageKey) : value;
}
