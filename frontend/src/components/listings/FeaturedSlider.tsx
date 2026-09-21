"use client";

import { Children, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

const INTERVAL_MS = 4500;

/**
 * Horizontal strip of cards. Cards that do not fit are reached by sliding right; the strip
 * advances by itself but stops on hover/focus, when the visitor prefers less motion, or when
 * everything already fits. Arrow buttons and the keyboard always work.
 */
export default function FeaturedSlider({ children, label }: { children: ReactNode; label: string }) {
  const track = useRef<HTMLUListElement | null>(null);
  const [paused, setPaused] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const items = Children.toArray(children);

  const measure = useCallback(() => {
    const el = track.current;
    if (el) setOverflowing(el.scrollWidth > el.clientWidth + 4);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, items.length]);

  const step = useCallback((direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const width = (card?.offsetWidth ?? 280) + 24;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    if (direction === 1 && atEnd) el.scrollTo({ left: 0, behavior: "smooth" });
    else el.scrollBy({ left: direction * width, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!overflowing || paused) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => step(1), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [overflowing, paused, step]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul ref={track} className="flex snap-x snap-mandatory gap-space-lg overflow-x-auto scroll-smooth pb-space-sm [scrollbar-width:none]">
        {items.map((item, index) => (
          <li key={index} className="w-[280px] shrink-0 snap-start sm:w-[300px]">
            {item}
          </li>
        ))}
      </ul>
      {overflowing ? (
        <div className="mt-space-sm flex justify-end gap-space-xs">
          <button type="button" aria-label="Previous" onClick={() => step(-1)} className="rounded-full bg-surface-container-low px-space-sm py-1 font-label-md">
            ←
          </button>
          <button type="button" aria-label="Next" onClick={() => step(1)} className="rounded-full bg-surface-container-low px-space-sm py-1 font-label-md">
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
