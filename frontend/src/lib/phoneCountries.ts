// Countries offered by the phone-number country-code selector: the EU's 27
// member states plus the UK, US and Canada (the markets this platform serves
// today). `dial` has no leading "+" so it concatenates directly.
export interface PhoneCountry {
  code: string;
  name: string;
  flag: string;
  dial: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "IT", name: "Italy", flag: "\u{1F1EE}\u{1F1F9}", dial: "39" },
  { code: "ES", name: "Spain", flag: "\u{1F1EA}\u{1F1F8}", dial: "34" },
  { code: "AT", name: "Austria", flag: "\u{1F1E6}\u{1F1F9}", dial: "43" },
  { code: "BE", name: "Belgium", flag: "\u{1F1E7}\u{1F1EA}", dial: "32" },
  { code: "BG", name: "Bulgaria", flag: "\u{1F1E7}\u{1F1EC}", dial: "359" },
  { code: "HR", name: "Croatia", flag: "\u{1F1ED}\u{1F1F7}", dial: "385" },
  { code: "CY", name: "Cyprus", flag: "\u{1F1E8}\u{1F1FE}", dial: "357" },
  { code: "CZ", name: "Czechia", flag: "\u{1F1E8}\u{1F1FF}", dial: "420" },
  { code: "DK", name: "Denmark", flag: "\u{1F1E9}\u{1F1F0}", dial: "45" },
  { code: "EE", name: "Estonia", flag: "\u{1F1EA}\u{1F1EA}", dial: "372" },
  { code: "FI", name: "Finland", flag: "\u{1F1EB}\u{1F1EE}", dial: "358" },
  { code: "FR", name: "France", flag: "\u{1F1EB}\u{1F1F7}", dial: "33" },
  { code: "DE", name: "Germany", flag: "\u{1F1E9}\u{1F1EA}", dial: "49" },
  { code: "GR", name: "Greece", flag: "\u{1F1EC}\u{1F1F7}", dial: "30" },
  { code: "HU", name: "Hungary", flag: "\u{1F1ED}\u{1F1FA}", dial: "36" },
  { code: "IE", name: "Ireland", flag: "\u{1F1EE}\u{1F1EA}", dial: "353" },
  { code: "LV", name: "Latvia", flag: "\u{1F1F1}\u{1F1FB}", dial: "371" },
  { code: "LT", name: "Lithuania", flag: "\u{1F1F1}\u{1F1F9}", dial: "370" },
  { code: "LU", name: "Luxembourg", flag: "\u{1F1F1}\u{1F1FA}", dial: "352" },
  { code: "MT", name: "Malta", flag: "\u{1F1F2}\u{1F1F9}", dial: "356" },
  { code: "NL", name: "Netherlands", flag: "\u{1F1F3}\u{1F1F1}", dial: "31" },
  { code: "PL", name: "Poland", flag: "\u{1F1F5}\u{1F1F1}", dial: "48" },
  { code: "PT", name: "Portugal", flag: "\u{1F1F5}\u{1F1F9}", dial: "351" },
  { code: "RO", name: "Romania", flag: "\u{1F1F7}\u{1F1F4}", dial: "40" },
  { code: "SK", name: "Slovakia", flag: "\u{1F1F8}\u{1F1F0}", dial: "421" },
  { code: "SI", name: "Slovenia", flag: "\u{1F1F8}\u{1F1EE}", dial: "386" },
  { code: "SE", name: "Sweden", flag: "\u{1F1F8}\u{1F1EA}", dial: "46" },
  { code: "GB", name: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}", dial: "44" },
  { code: "US", name: "United States", flag: "\u{1F1FA}\u{1F1F8}", dial: "1" },
  { code: "CA", name: "Canada", flag: "\u{1F1E8}\u{1F1E6}", dial: "1" },
];

export const DEFAULT_PHONE_COUNTRY = "IT";

// Longest dial code first, so "+352" (Luxembourg) is matched before a shorter
// code that happens to be a prefix of it (no real collisions today, but this
// keeps future additions safe).
const BY_DIAL_LENGTH_DESC = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/** Splits a stored "+<dial><national>" string into its country and national
 * parts. Falls back to the default country with the digits as-is when the
 * value doesn't start with "+" or matches no known dial code (e.g. an old
 * free-text value, or empty). */
export function splitPhoneNumber(value: string): { country: string; national: string } {
  const digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    const match = BY_DIAL_LENGTH_DESC.find((entry) => digits.startsWith(`+${entry.dial}`));
    if (match) {
      return { country: match.code, national: digits.slice(match.dial.length + 1) };
    }
  }
  return { country: DEFAULT_PHONE_COUNTRY, national: digits.replace(/^\+/, "") };
}

export function combinePhoneNumber(countryCode: string, national: string): string {
  const country = PHONE_COUNTRIES.find((entry) => entry.code === countryCode);
  const digits = national.replace(/\D/g, "");
  if (!country || !digits) return "";
  return `+${country.dial}${digits}`;
}
