// Broker specialties come from free tags ("sail", "sailing", "rib"); a directory should read them one way.

const LABELS: Record<string, string> = {
  sail: "Sailing yachts",
  sailing: "Sailing yachts",
  motor: "Motor yachts",
  rib: "RIBs",
  catamaran: "Catamarans",
  luxury: "Luxury yachts",
};

export function specialtyLabels(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const label = LABELS[tag.trim().toLowerCase()] ?? tag.trim().replace(/^./, (c) => c.toUpperCase());
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}
