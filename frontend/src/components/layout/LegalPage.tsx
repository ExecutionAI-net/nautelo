import Link from "next/link";

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export default function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="w-full bg-surface">
      <div className="mx-auto max-w-3xl px-margin-mobile py-space-2xl md:px-margin">
        <nav aria-label="Breadcrumb" className="mb-space-lg font-body-sm text-on-surface-variant">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>{" "}
          / <span className="text-primary">{title}</span>
        </nav>
        <h1 className="font-headline-lg text-headline-lg text-primary">{title}</h1>
        <p className="mt-space-xs font-label-sm uppercase text-on-surface-variant">Last updated {updated}</p>
        <p className="mt-space-lg font-body-lg text-on-surface-variant">{intro}</p>
        {sections.map((section) => (
          <section key={section.heading} className="mt-space-xl">
            <h2 className="font-headline-sm text-headline-sm text-primary">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="mt-space-sm font-body-md text-on-surface-variant">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
