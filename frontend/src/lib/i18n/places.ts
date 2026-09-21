// Place names as a visitor reads them: a country by its name, and no city repeated as its own region.

export function countryName(code: string, locale = "en"): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function placeLabel(place: { city?: string | null; region?: string | null; country?: string | null }): string {
  const parts: string[] = [];
  for (const raw of [place.city, place.region, place.country ? countryName(place.country) : ""]) {
    const part = (raw ?? "").trim();
    if (part && !parts.some((seen) => seen.toLowerCase() === part.toLowerCase())) parts.push(part);
  }
  return parts.join(", ");
}
