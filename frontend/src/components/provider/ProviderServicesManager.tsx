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
        <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Service catalogue</span>
        <h1 className="mt-1 font-headline-lg text-headline-lg text-primary tracking-tight">Your services</h1>
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
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-surface-container-low/50 transition-colors">
                  <td className="py-3.5 px-4 font-title-md text-primary font-semibold">{service.title_en}</td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex px-2.5 py-0.5 rounded bg-surface-container font-label-md text-primary">{service.category_slug}</span>
                  </td>
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
                  <td className="py-space-md px-4 text-on-surface-variant" colSpan={4}>No services yet.</td>
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
