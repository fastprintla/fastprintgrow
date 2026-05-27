"use client";

import { useEffect, useState } from "react";

type SavedLead = {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsLink: string;
  rating: string;
  primaryEmail?: string;
  notes?: string;
  createdAt: string;
};

export default function MyLeadsPage() {
  const [leads, setLeads] = useState<SavedLead[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/user/saved-leads");
      const data = (await response.json()) as { savedLeads?: SavedLead[]; error?: string };

      if (!response.ok) {
        setError(data.error || "Login required.");
        return;
      }

      setLeads(data.savedLeads || []);
    }

    load();
  }, []);

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-[#172033] sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold">My Leads</h1>
      {error ? <p className="mt-4 rounded-md bg-[#fff1f1] p-3 text-sm font-semibold text-[#9a2d2d]">{error}</p> : null}
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {leads.map((lead) => (
          <article className="rounded-lg border border-[#d8dfeb] bg-white p-4 shadow-sm" key={lead.id}>
            <h2 className="font-bold">{lead.name}</h2>
            <p className="mt-2 text-sm text-[#5f7188]">{lead.address}</p>
            <p className="mt-2 text-sm">{lead.phone}</p>
            <p className="mt-2 text-sm font-semibold text-[#1f6fa9]">{lead.primaryEmail || "No email saved"}</p>
            <p className="mt-2 text-sm text-[#5f7188]">Rating: {lead.rating}</p>
            {lead.notes ? <p className="mt-2 text-sm text-[#5f7188]">{lead.notes}</p> : null}
            <div className="mt-3 flex gap-3 text-sm font-bold text-[#1f6fa9]">
              {lead.website ? <a href={lead.website} target="_blank">Website</a> : null}
              <a href={lead.mapsLink} target="_blank">Maps</a>
            </div>
            <p className="mt-3 text-xs text-[#8794a5]">Saved {new Date(lead.createdAt).toLocaleString()}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
