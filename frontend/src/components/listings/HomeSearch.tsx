"use client";

import { useEffect, useState } from "react";

const FIELD =
  "w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline";
const LABEL = "font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider";

const EXAMPLES = [
  "A 12-metre sailing yacht in Mallorca, with 3 cabins and under €180,000",
  "Veliero per famiglia a Genova sotto 150 mila euro",
  "Catamarán en Ibiza para alquilar con tripulación",
];

/**
 * The two ways to search from the home page: the filter form, or a sentence in English, Italian or Spanish.
 * Both land on /boats/; the sentence carries `mode=semantic` so the server reads it as a description.
 */
export default function HomeSearch({ boatTypes, cities }: { boatTypes: string[]; cities: { id: number; name: string }[] }) {
  const [tab, setTab] = useState<"standard" | "semantic">("standard");
  useEffect(() => {
    // The footer's "Semantic search" link opens the home page on this tab, also when already on the home page.
    const open = () => {
      if (window.location.hash === "#semantic") setTab("semantic");
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  const tabClass = (active: boolean) =>
    `px-space-md py-space-xs rounded-md font-label-md text-label-md transition-all ${active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`;

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-md p-space-md md:p-space-lg">
      <div role="tablist" aria-label="Search mode" className="mb-space-md inline-flex rounded-lg bg-surface-container-low p-1">
        <button type="button" role="tab" id="tab-standard-btn" aria-selected={tab === "standard"} onClick={() => setTab("standard")} className={tabClass(tab === "standard")}>
          Standard search
        </button>
        <button type="button" role="tab" id="tab-semantic-btn" aria-selected={tab === "semantic"} onClick={() => setTab("semantic")} className={tabClass(tab === "semantic")}>
          Semantic search
        </button>
      </div>

      {tab === "standard" ? (
        <form action="/boats/" method="get" className="grid grid-cols-1 md:grid-cols-3 gap-space-md" id="search-standard">
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="home-type">Boat type</label>
            <select id="home-type" name="boat_type" className={`${FIELD} cursor-pointer`}>
              <option value="">All boat types</option>
              {boatTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="home-place">Location</label>
            <select id="home-place" name="place" className={`${FIELD} cursor-pointer`}>
              <option value="">Spain &amp; Italy (all cities)</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL}>Price range (€)</span>
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Min price" aria-label="Minimum price" name="price_min" min="0" type="number" />
              <input className={FIELD} placeholder="Max price" aria-label="Maximum price" name="price_max" min="0" type="number" />
            </div>
          </div>
          <div className="flex flex-col gap-1 md:col-span-2">
            <span className={LABEL}>Length (metres)</span>
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder="Min length" aria-label="Minimum length" name="length_min" min="0" step="0.5" type="number" />
              <input className={FIELD} placeholder="Max length" aria-label="Maximum length" name="length_max" min="0" step="0.5" type="number" />
            </div>
          </div>
          <div className="flex items-end md:col-span-1">
            <button className="w-full bg-primary hover:bg-primary-container text-on-primary py-2.5 px-space-md rounded-lg font-title-md text-title-md transition-all flex items-center justify-center gap-space-xs shadow-sm" type="submit">
              Search boats
            </button>
          </div>
        </form>
      ) : (
        <form action="/boats/" method="get" className="flex flex-col gap-space-xs" id="search-semantic">
          <input type="hidden" name="mode" value="semantic" />
          <label className={LABEL} htmlFor="home-query">Describe the boat you are looking for</label>
          <div className="flex flex-col gap-space-sm sm:flex-row">
            <input
              id="home-query"
              name="query"
              type="text"
              maxLength={300}
              required
              placeholder={`e.g. ${EXAMPLES[0]}`}
              className={`${FIELD} sm:flex-1`}
            />
            <button className="shrink-0 rounded-lg bg-primary px-space-lg py-2.5 font-body-md text-on-primary hover:bg-primary-container" type="submit">
              Search
            </button>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">English, Italian or Spanish. Place, price, length and type are understood.</p>
        </form>
      )}
    </div>
  );
}
