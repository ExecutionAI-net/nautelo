import Link from "next/link";

export default function NotFound() {
  return (
    <main className="w-full bg-surface">
      <div className="mx-auto max-w-2xl px-margin-mobile py-space-2xl text-center">
        <p className="font-label-sm uppercase tracking-widest text-secondary">Page not found</p>
        <h1 className="mt-space-xs font-headline-lg text-headline-lg text-primary">We could not find that page</h1>
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          The link may be old, or the boat may have been sold or taken offline. Here is where most people go next.
        </p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <Link href="/boats/" className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
            See boats for sale
          </Link>
          <Link href="/" className="rounded-lg bg-surface-container-low px-space-lg py-space-sm font-body-md text-primary hover:bg-surface-container">
            Back to the home page
          </Link>
          <Link href="/contact/" className="rounded-lg bg-surface-container-low px-space-lg py-space-sm font-body-md text-primary hover:bg-surface-container">
            Contact us
          </Link>
        </div>
      </div>
    </main>
  );
}
