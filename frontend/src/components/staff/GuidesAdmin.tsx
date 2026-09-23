"use client";

import { useCallback, useEffect, useState } from "react";

import { staffGuides, type StaffGuide } from "@/lib/api/content";

const FIELD = "w-full rounded-lg bg-surface-container-low px-space-sm py-2.5 font-body-md focus:outline-none";
const SELECT = "w-full appearance-none bg-surface-container-low pl-3 pr-8 py-2 rounded-lg font-body-md text-body-md text-on-surface focus:outline-none cursor-pointer";
const EMPTY = { title: "", slug: "", category: "", excerpt: "", hero_image_url: "", body: "" };

function rowsOf<T>(value: { results: T[] } | T[]): T[] {
  return Array.isArray(value) ? value : value.results;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function GuidesAdmin() {
  const [guides, setGuides] = useState<StaffGuide[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);

  const reload = useCallback(async () => {
    try {
      setGuides(rowsOf(await staffGuides.list()));
    } catch {
      setMessage("The content could not be loaded.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void reload();
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

  const published = guides.filter((guide) => guide.status === "PUBLISHED").length;
  const categories = Array.from(new Set(guides.map((guide) => guide.category).filter(Boolean)));
  const needle = q.trim().toLowerCase();
  const visible = guides.filter(
    (guide) =>
      (!needle || `${guide.title} ${guide.slug} ${guide.author_name} ${guide.category}`.toLowerCase().includes(needle)) &&
      (!category || guide.category === category) &&
      (!status || guide.status === status),
  );

  const kpis = [
    { label: "Published articles", value: published, note: "Live on the public guides", icon: "library_books" },
    { label: "Drafts", value: guides.length - published, note: "Not visible to readers", icon: "edit_note" },
    { label: "Total articles", value: guides.length, note: "All guides on file", icon: "article" },
    { label: "Categories", value: categories.length, note: "Distinct topics", icon: "category" },
  ];

  return (
    <div className="flex flex-col gap-space-xl">
      <section className="flex flex-col gap-space-xs max-w-3xl">
        <div className="inline-flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-secondary rounded-full" />
          <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary font-semibold">Staff / Content</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Content</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant">Author, publish and retire the guides shown on the public Guides pages.</p>
        {message ? (
          <p role="status" className="font-body-md text-primary">
            {message}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div className="flex items-start justify-between mb-space-sm">
              <span className="font-label-sm text-label-sm uppercase text-on-surface-variant font-medium tracking-wider">{kpi.label}</span>
              <span className="w-8 h-8 rounded-lg bg-secondary-container/30 text-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{kpi.icon}</span>
              </span>
            </div>
            <span className="font-headline-lg text-headline-lg text-primary font-semibold">{kpi.value}</span>
            <span className="text-body-sm font-body-sm text-on-surface-variant">{kpi.note}</span>
          </div>
        ))}
      </div>

      <section className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-space-sm">
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]" aria-hidden="true">search</span>
            <input
              className="w-full pl-9 pr-4 py-2 bg-surface-container-low rounded-lg font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:bg-surface-container transition-colors"
              placeholder="Search guides, author or category..."
              aria-label="Search guides"
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </div>
          <select className={`${SELECT} sm:w-56`} aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select className={`${SELECT} sm:w-44`} aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft</option>
          </select>
        </div>
        <div className="flex items-center gap-space-xs shrink-0 text-body-sm font-body-sm text-on-surface-variant">
          <span>
            Showing <strong>{visible.length}</strong> of <strong>{guides.length}</strong> documents
          </span>
          <button type="button" title="Reload" aria-label="Reload" onClick={() => void reload()} className="w-8 h-8 rounded-lg hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
          </button>
        </div>
      </section>

      <section className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body-md text-body-md">
            <thead className="bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold" scope="col">Article &amp; topic</th>
                <th className="py-3.5 px-4 font-semibold" scope="col">Category</th>
                <th className="py-3.5 px-4 font-semibold" scope="col">Author</th>
                <th className="py-3.5 px-4 font-semibold" scope="col">State</th>
                <th className="py-3.5 px-4 font-semibold text-right" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((guide) => (
                <tr key={guide.id} className="hover:bg-surface-container-low/50 transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex flex-col gap-1 max-w-md">
                      <span className="font-title-md text-title-md text-primary font-semibold group-hover:text-secondary transition-colors">{guide.title}</span>
                      <span className="text-body-sm font-body-sm text-on-surface-variant">/{guide.slug}/</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    {guide.category ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded bg-surface-container font-label-md text-label-md text-primary font-medium">{guide.category}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div aria-hidden="true" className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-label-sm text-primary">
                        {initials(guide.author_name || "-")}
                      </div>
                      <span className="font-body-sm text-on-surface font-medium">{guide.author_name || "-"}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                        guide.status === "PUBLISHED" ? "bg-secondary-container/40 text-on-secondary-container" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${guide.status === "PUBLISHED" ? "bg-secondary" : "bg-outline"}`} />
                      {guide.status === "PUBLISHED" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        className="px-2.5 py-1 rounded hover:bg-surface-container text-primary font-body-sm font-medium"
                        onClick={() =>
                          void run(() => staffGuides.update(guide.id, { status: guide.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }), "Guide updated.")
                        }
                      >
                        {guide.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                      <a href={`/guides/${guide.slug}/`} className="px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant font-body-sm">
                        Preview
                      </a>
                      <button
                        type="button"
                        aria-label="Delete"
                        title="Delete"
                        className="w-7 h-7 rounded hover:bg-surface-container flex items-center justify-center text-error"
                        onClick={() => void run(() => staffGuides.remove(guide.id), "Guide deleted.")}
                      >
                        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td className="py-space-md px-4 text-on-surface-variant" colSpan={5}>
                    No guides yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <form
        className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg grid gap-space-sm sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => staffGuides.create({ ...draft, status: "DRAFT" }), "Guide created as a draft.");
          setDraft(EMPTY);
        }}
      >
        <h2 className="font-headline-sm text-headline-sm text-primary sm:col-span-2">Create new article</h2>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Title
          <input className={FIELD} required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Slug
          <input className={FIELD} required pattern="[a-z0-9-]+" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Category
          <input className={FIELD} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant">
          Hero image URL
          <input className={FIELD} type="url" value={draft.hero_image_url} onChange={(e) => setDraft({ ...draft, hero_image_url: e.target.value })} />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
          Excerpt
          <input className={FIELD} maxLength={400} value={draft.excerpt} onChange={(e) => setDraft({ ...draft, excerpt: e.target.value })} />
        </label>
        <label className="font-label-sm uppercase text-on-surface-variant sm:col-span-2">
          Body (blank line = new paragraph)
          <textarea className={FIELD} rows={6} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
        </label>
        <button type="submit" className="self-start rounded-lg bg-primary px-4 py-2.5 font-body-md text-on-primary font-medium shadow-md inline-flex items-center gap-2 sm:col-span-2">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add_circle</span>
          Add guide
        </button>
      </form>
    </div>
  );
}
