"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The page a visitor sees when a server render throws (sweep.md W21): until now that
 * was Next's bare "Internal Server Error". The usual cause on public routes is a
 * transient API answer (a rate-limited crawler, a deploy window), so the page says
 * so and offers a retry instead of a dead end. Client component by contract.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="w-full bg-surface">
      <div className="mx-auto max-w-2xl px-margin-mobile py-space-2xl text-center">
        <p className="font-label-sm uppercase tracking-widest text-secondary">Something went wrong</p>
        <h1 className="mt-space-xs font-headline-lg text-headline-lg text-primary">This page could not be loaded</h1>
        <p className="mt-space-sm font-body-md text-on-surface-variant">
          This is usually momentary. Try again in a few seconds; if it keeps happening, tell us and we will look into it.
        </p>
        <div className="mt-space-lg flex flex-wrap justify-center gap-space-sm">
          <button type="button" onClick={reset} className="rounded-lg bg-primary px-space-lg py-space-sm font-body-md text-on-primary hover:bg-primary-container">
            Try again
          </button>
          <Link href="/" className="rounded-lg bg-surface-container-low px-space-lg py-space-sm font-body-md text-primary hover:bg-surface-container">
            Back to the home page
          </Link>
          <Link href="/contact/" className="rounded-lg bg-surface-container-low px-space-lg py-space-sm font-body-md text-primary hover:bg-surface-container">
            Contact us
          </Link>
        </div>
        {error.digest ? <p className="mt-space-lg font-label-sm text-on-surface-variant">Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
