"use client";

import { useState } from "react";

import PlatformRules from "@/components/staff/PlatformRules";
import ProductSettings from "@/components/staff/ProductSettings";

const TABS = [
  { id: "rules", label: "Platform rules", icon: "tune" },
  { id: "products", label: "Products & pricing", icon: "payments" },
] as const;

export default function SettingsScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("rules");
  return (
    <div className="flex flex-col gap-space-xl">
      <div className="flex flex-col gap-space-xs max-w-3xl bg-surface-container-lowest p-space-xl rounded-xl shadow-sm">
        <span className="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 rounded bg-secondary-fixed/50 text-on-secondary-fixed font-label-sm text-label-sm tracking-widest uppercase font-semibold">
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">tune</span>
          Platform Settings
        </span>
        <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight">Platform Configuration</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Listing rules, media allowances and product pricing. Every change is validated and audited.
        </p>
      </div>
      <div role="tablist" className="flex items-center gap-space-xs overflow-x-auto pb-space-xs">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`px-space-md py-space-sm rounded-md font-body-sm text-body-sm whitespace-nowrap flex items-center gap-1.5 ${
              tab === item.id ? "bg-primary text-on-primary font-semibold shadow-sm" : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "rules" ? <PlatformRules /> : <ProductSettings />}
    </div>
  );
}
