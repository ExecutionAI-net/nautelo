"use client";

import { useEffect, useState } from "react";

import { useT } from "@/i18n/client";
import LocationFacetFilter from "@/components/places/LocationFacetFilter";
import type { FacetLocation } from "@/lib/api/listings";

const FIELD =
  "w-full bg-surface-container-low rounded-lg px-space-sm py-2.5 font-body-md text-body-md text-on-surface focus:outline-none placeholder:text-outline";
const LABEL = "font-label-sm text-label-sm uppercase text-on-surface-variant tracking-wider";


/**
 * The two ways to search from the home page: the filter form, or a sentence in English, Italian or Spanish.
 * Both land on /boats/; the sentence carries `mode=semantic` so the server reads it as a description.
 */
export default function HomeSearch({ boatTypes, locations = [] }: { boatTypes: string[]; locations?: FacetLocation[] }) {
  const t = useT();
  const [tab, setTab] = useState<"standard" | "semantic">("standard");
  useEffect(() => {
    // The footer's "Describe your boat" link opens the home page on this tab, also when already on the home page.
    const open = () => {
      if (window.location.hash === "#semantic") setTab("semantic");
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  const tabClass = (active: boolean) =>
    `px-space-md py-space-xs rounded-md font-label-md text-label-md transition-all ${active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:text-on-surface"}`;

  const fillPrompt = (example: string) => {
    const field = document.getElementById("home-query") as HTMLInputElement | null;
    if (field) field.value = example;
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-md p-space-md md:p-space-lg">
      <div role="tablist" aria-label={t("search.mode")} className="mb-space-md inline-flex rounded-lg bg-surface-container-low p-1">
        <button type="button" role="tab" id="tab-standard-btn" aria-selected={tab === "standard"} onClick={() => setTab("standard")} className={tabClass(tab === "standard")}>
          {t("search.standard")}
        </button>
        <button type="button" role="tab" id="tab-semantic-btn" aria-selected={tab === "semantic"} onClick={() => setTab("semantic")} className={tabClass(tab === "semantic")}>
          {t("search.describe")}
        </button>
      </div>

      {tab === "standard" ? (
        <form action="/boats/" method="get" className="grid grid-cols-1 md:grid-cols-3 gap-space-md" id="search-standard">
          <div className="flex flex-col gap-1">
            <label className={LABEL} htmlFor="home-type">{t("search.boat_type")}</label>
            <select id="home-type" name="boat_type" className={`${FIELD} cursor-pointer`}>
              <option value="">{t("search.all_types")}</option>
              {boatTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <LocationFacetFilter
            locations={locations}
            idPrefix="home"
            labelClass={LABEL}
            fieldClass={FIELD}
            wrapperClass="flex flex-col gap-1"
            labels={{ country: t("place.country"), allCountries: t("place.all_countries"), city: t("place.city"), allCities: t("place.all_cities"), chooseCountry: t("place.choose_country"), searchCity: t("place.search_city"), searchCountry: t("place.search_country") }}
          />
          <div className="flex flex-col gap-1">
            <span className={LABEL}>{t("search.price_range")}</span>
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder={t("search.min_price")} aria-label={t("search.minimum_price")} name="price_min" min="0" type="number" />
              <input className={FIELD} placeholder={t("search.max_price")} aria-label={t("search.maximum_price")} name="price_max" min="0" type="number" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={LABEL}>{t("search.length")}</span>
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} placeholder={t("search.min_length")} aria-label={t("search.minimum_length")} name="length_min" min="0" step="0.5" type="number" />
              <input className={FIELD} placeholder={t("search.max_length")} aria-label={t("search.maximum_length")} name="length_max" min="0" step="0.5" type="number" />
            </div>
          </div>
          <div className="flex items-end md:col-span-1">
            <button className="w-full bg-primary hover:bg-primary-container text-on-primary py-2.5 px-space-md rounded-lg font-title-md text-title-md transition-all flex items-center justify-center gap-space-xs shadow-sm" type="submit">
              {t("search.submit")}
            </button>
          </div>
        </form>
      ) : (
        <form action="/boats/" method="get" className="flex flex-col gap-space-xs" id="search-semantic">
          <input type="hidden" name="mode" value="semantic" />
          <label className={LABEL} htmlFor="home-query">{t("search.describe_label")}</label>
          <div className="flex flex-col gap-space-sm sm:flex-row">
            <input
              id="home-query"
              name="query"
              type="text"
              maxLength={300}
              required
              placeholder={t("search.example")}
              className={`${FIELD} sm:flex-1`}
            />
            <button className="shrink-0 rounded-lg bg-primary px-space-lg py-2.5 font-body-md text-on-primary hover:bg-primary-container" type="submit">
              {t("search.go")}
            </button>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant">{t("search.describe_hint")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-label-sm text-outline uppercase text-[10px]">{t("search.prompt_ideas")}</span>
            {[t("search.prompt_example_1"), t("search.prompt_example_2")].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => fillPrompt(example)}
                className="px-2.5 py-1 bg-surface-container text-primary rounded text-xs hover:bg-surface-variant text-left transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </form>
      )}
    </div>
  );
}
