"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import { formatPrice } from "@/lib/api/plans";
import ServicePhotoUpload from "@/components/provider/ServicePhotoUpload";
import {
  createProviderService,
  deleteProviderService,
  fetchProviderServices,
  updateProviderService,
  type ProviderService,
} from "@/lib/api/provider";

const CURRENCIES = ["EUR", "USD", "GBP"];

function priceLabel(service: ProviderService): string {
  if (!service.price_from) return "Quote on request";
  const price = `From ${formatPrice(service.price_from, service.currency || "EUR")}`;
  return service.pricing_note ? `${price} ${service.pricing_note}` : price;
}

interface Category {
  id: string;
  slug: string;
  name: string;
}

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";

export default function ProviderServicesManager() {
  const [services, setServices] = useState<ProviderService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState({ category: "", title_en: "", description_en: "", price_from: "", currency: "EUR", pricing_note: "" });

  const reload = useCallback(async () => {
    try {
      setServices(await fetchProviderServices());
    } catch {
      setMessage("Create your company profile first, then add services.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
    apiFetch<{ results?: Category[] } | Category[]>("/api/v1/service-categories/").then(
      (body) => setCategories(Array.isArray(body) ? body : (body.results ?? [])),
      () => setCategories([]),
    );
  }, [reload]);

  async function run(action: () => Promise<unknown>, done: string) {
    setMessage(null);
    try {
      await action();
      setMessage(done);
      await reload();
    } catch {
      setMessage("The change could not be saved.");
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <div>
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-secondary font-semibold">Service provider / Services</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Services</h1>
        <p className="mt-space-xs font-body-md text-on-surface-variant">
          {services.filter((service) => service.is_active).length} active of {services.length} services shown to buyers.
        </p>
        {message ? (
          <p role="status" className="mt-space-sm font-body-md">
            {message}
          </p>
        ) : null}
      </div>
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead className="bg-surface-container-low text-on-surface-variant font-label-sm uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Photo</th>
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3.5 px-4">
                    <ServicePhotoUpload
                      serviceId={service.id}
                      currentUrl={service.photo_url}
                      onUploaded={(photo_url) =>
                        setServices((current) => current.map((row) => (row.id === service.id ? { ...row, photo_url } : row)))
                      }
                    />
                  </td>
                  <td className="py-3.5 px-4 font-title-md text-primary font-semibold">{service.title_en}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex px-2.5 py-0.5 rounded bg-surface-container font-label-md text-primary">
                      {categories.find((category) => category.slug === service.category_slug)?.name ?? service.category_slug}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-on-surface-variant">{priceLabel(service)}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-label-sm font-medium ${service.is_active ? "bg-emerald-50 text-emerald-800" : "bg-surface-container text-on-surface-variant"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
                      {service.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="text-secondary hover:text-primary font-title-md text-body-sm px-2 py-1"
                      onClick={() => void run(() => updateProviderService(service.id, { is_active: !service.is_active }), "Service updated.")}
                    >
                      {service.is_active ? "Hide" : "Show"}
                    </button>
                    <button
                      type="button"
                      className="text-error font-title-md text-body-sm px-2 py-1"
                      onClick={() => void run(() => deleteProviderService(service.id), "Service deleted.")}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {services.length === 0 ? (
                <tr>
                  <td className="py-space-md px-4 text-on-surface-variant" colSpan={6}>No services yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <form
        className="grid gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () => createProviderService({ ...draft, price_from: draft.price_from.trim() || undefined }),
            "Service added.",
          );
          setDraft({ category: draft.category, title_en: "", description_en: "", price_from: "", currency: draft.currency, pricing_note: "" });
        }}
      >
        <label className="font-label-sm uppercase text-on-surface-variant">
          Category
          <select className={FIELD} required value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            <option value="">Select</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Title
          <input className={FIELD} required maxLength={160} value={draft.title_en} onChange={(e) => setDraft({ ...draft, title_en: e.target.value })} />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Price from (optional)
          <div className="mt-space-xs flex gap-space-xs">
            <input
              className={`${FIELD} mt-0`}
              type="number"
              min="0"
              step="0.01"
              placeholder="Quote on request"
              value={draft.price_from}
              onChange={(e) => setDraft({ ...draft, price_from: e.target.value })}
            />
            <select
              className={`${FIELD} mt-0 w-24 shrink-0`}
              aria-label="Currency"
              value={draft.currency}
              onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Pricing note (optional)
          <input
            className={FIELD}
            maxLength={120}
            placeholder="e.g. per survey, +VAT"
            value={draft.pricing_note}
            onChange={(e) => setDraft({ ...draft, pricing_note: e.target.value })}
          />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
          Description
          <textarea className={FIELD} rows={3} value={draft.description_en} onChange={(e) => setDraft({ ...draft, description_en: e.target.value })} />
        </label>
        <button type="submit" className="self-start rounded-lg bg-primary px-space-md py-space-sm font-body-md text-on-primary">
          Add service
        </button>
      </form>
    </div>
  );
}
