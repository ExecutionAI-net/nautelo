"use client";

import { useState } from "react";

import SellListingForm from "@/components/listings/SellListingForm";
import { useSession } from "@/lib/auth/session";

/** Broker listing creation (spec 22): the same form, bound to one of the
 *  viewer's broker organizations that they may edit listings for. */
export default function FleetListingPage() {
  const { session } = useSession();
  const editable = (session?.broker_memberships ?? []).filter((m) => m.can_edit_listings);
  const [chosen, setChosen] = useState<string | null>(null);
  const brokerId = chosen ?? editable[0]?.broker_id;

  if (!brokerId) {
    return <p role="status">You do not have permission to add listings for a broker.</p>;
  }
  return (
    <div className="flex flex-col gap-space-md">
      {editable.length > 1 ? (
        <label className="font-body-md">
          Broker
          <select
            className="ml-space-xs rounded border border-outline-variant p-space-xs"
            value={brokerId}
            onChange={(event) => setChosen(event.target.value)}
          >
            {editable.map((m) => (
              <option key={m.broker_id} value={m.broker_id}>
                {m.broker_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <SellListingForm key={brokerId} brokerId={brokerId} />
    </div>
  );
}
