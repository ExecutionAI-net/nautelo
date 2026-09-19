import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import AdSlot from "@/components/content/AdSlot";
import { fetchGuide } from "@/lib/api/contentServer";

export const dynamic = "force-dynamic";

// Next 16: params is a Promise.
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const guide = await fetchGuide(slug);
  if (!guide) return { title: "Guide" };
  return {
    title: guide.title,
    description: guide.excerpt || undefined,
    alternates: { canonical: `/guides/${slug}/` },
  };
}

export default async function GuidePage({ params }: { params: Params }) {
  const { slug } = await params;
  const guide = await fetchGuide(slug);
  if (!guide) {
    notFound();
  }
  const paragraphs = guide.body.split(/\n{2,}/).filter((part) => part.trim());

  return (
    <main className="w-full bg-surface">
      <article className="mx-auto max-w-3xl px-margin-mobile py-space-xl md:px-margin">
        <nav aria-label="Breadcrumb" className="font-body-sm text-on-surface-variant">
          <Link href="/guides/" className="hover:text-primary">
            Guides
          </Link>
          {guide.category ? <span> / {guide.category}</span> : null}
        </nav>
        <h1 className="mt-space-md font-headline-lg text-headline-lg text-primary">{guide.title}</h1>
        <p className="mt-space-xs font-body-sm text-on-surface-variant">
          {guide.author_name ? `${guide.author_name} · ` : ""}
          {guide.published_at ? new Date(guide.published_at).toLocaleDateString("en") : ""}
        </p>
        {guide.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- editorial image, size unknown
          <img src={guide.hero_image_url} alt="" className="mt-space-lg aspect-[16/9] w-full rounded-xl object-cover" />
        ) : null}
        {guide.excerpt ? <p className="mt-space-lg font-body-lg text-on-surface-variant">{guide.excerpt}</p> : null}
        <div className="mt-space-lg flex flex-col gap-space-md font-body-md text-on-surface">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="mt-space-xl">
          <AdSlot placement="GUIDES" />
        </div>
      </article>
    </main>
  );
}
