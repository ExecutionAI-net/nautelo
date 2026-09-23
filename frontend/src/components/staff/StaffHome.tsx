"use client";

import { useState } from "react";

import ModerationQueue from "@/components/staff/ModerationQueue";
import StaffOverview from "@/components/staff/StaffOverview";

export default function StaffHome() {
  const [pending, setPending] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-space-xl">
      <StaffOverview pending={pending} queue={<ModerationQueue onCounts={setPending} />} />
    </div>
  );
}
