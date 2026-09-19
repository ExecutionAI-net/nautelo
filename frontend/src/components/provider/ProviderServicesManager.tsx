"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api/client";
import {
  createProviderService,
  deleteProviderService,
  fetchProviderServices,
  updateProviderService,
  type ProviderService,
} from "@/lib/api/provider";

interface Category {
  id: string;
  name: string;
}

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";

export default function ProviderServicesManager() {
  const [services, setServices] = useState<ProviderService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState({ category: "", title_en: "", description_en: "" });

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
        <h1 className="font-headline-lg text-headline-lg text-primary">Your services</h1>
        {message ? (
          <p role="status" className="mt-space-sm font-body-md">
            {message}
          </p>
        ) : null}
      </div>
      <ul className="divide-y divide-outline-variant rounded-xl bg-surface-container-lowest p-space-lg shadow-sm">
        {services.map((service) => (
          <li key={service.id} className="flex flex-wrap items-center justify-between gap-space-sm py-space-sm">
            <div>
              <p className="font-title-sm text-title-sm text-on-surface">{service.title_en}</p>
              <p className="font-body-sm text-on-surface-variant">
                {service.category_slug} - {service.is_active ? "Active" : "Hidden"}
              </p>
            </div>
            <div className="flex gap-space-sm">
              <button
                type="button"
                className="font-body-md text-primary underline"
                onClick={() => void run(() => updateProviderService(service.id, { is_active: !service.is_active }), "Service updated.")}
              >
                {service.is_active ? "Hide" : "Show"}
              </button>
              <button
                type="button"
                className="font-body-md text-error underline"
                onClick={() => void run(() => deleteProviderService(service.id), "Service deleted.")}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {services.length === 0 ? <li className="py-space-sm font-body-md text-on-surface-variant">No services yet.</li> : null}
      </ul>
      <form
        className="grid gap-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-sm sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => createProviderService(draft), "Service added.");
          setDraft({ category: draft.category, title_en: "", description_en: "" });
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
