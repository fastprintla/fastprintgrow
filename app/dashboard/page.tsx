"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download, LogOut, Mail, Search, Star, X } from "lucide-react";
import BrandLogo from "../components/BrandLogo";

type Lead = {
  id: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsLink: string;
  rating: string;
  category: string;
  primaryEmail?: string;
  allEmails?: string[];
  emailStatus?: string;
  emailType?: string;
  contactPageUrl?: string;
  pagesChecked?: string[];
};

type User = {
  id: string;
  email: string;
  plan: string;
  creditsRemaining: number | null;
  creditsTotal: number | null;
};

type Plan = {
  id: string;
  label: string;
  price: string;
  leadLimit: number;
  creditTotal: number | null;
  allowEmailExtraction: boolean;
  allowSavedLeads: boolean;
  allowCsvExport: boolean;
  csvLimited: boolean;
  allowCustomQuantity: boolean;
};

type HistoryItem = {
  id: string;
  businessType: string;
  zipCode: string;
  location?: string;
  radiusMiles: number;
  quantityRequested?: number;
  resultCount: number;
  creditsUsed?: number;
  createdAt: string;
  generatedResults?: Lead[];
};

const quantityOptions = [10, 25, 50, 100, 200];
const csvHeaders = [
  "Business Name",
  "Phone",
  "Website",
  "Public Email",
  "Email Status",
  "Contact Page URL",
  "Address",
  "Rating",
  "Google Maps Link",
  "Search keyword",
  "Search location",
  "Search date",
];
const paidPlans = [
  { id: "starter", label: "Starter", price: "$9.99", credits: "100 credits" },
  { id: "growth", label: "Growth", price: "$19.99", credits: "250 credits" },
  { id: "pro", label: "Pro", price: "$29.99", credits: "500 credits" },
  { id: "agency", label: "Agency", price: "$49.99", credits: "1000 credits" },
];

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [businessType, setBusinessType] = useState("dentist");
  const [location, setLocation] = useState("90210");
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [quantity, setQuantity] = useState(10);
  const [customQuantity, setCustomQuantity] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [savedLeadIds, setSavedLeadIds] = useState<Set<string>>(new Set());
  const [shopifyUrls, setShopifyUrls] = useState<Record<string, string>>({});
  const [searchDate, setSearchDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [findingEmails, setFindingEmails] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [emailProgress, setEmailProgress] = useState("");
  const [error, setError] = useState("");
  const searchAbortRef = useRef<AbortController | null>(null);
  const stopEmailScanRef = useRef(false);

  const requestedQuantity = plan?.allowCustomQuantity && customQuantity ? Number(customQuantity) : quantity;
  const remainingCredits = user?.creditsRemaining ?? 0;
  const totalCredits = user?.creditsTotal;
  const canSearch = plan?.id === "admin" || requestedQuantity <= remainingCredits;

  const csv = useMemo(() => {
    const rows = leads.map((lead) => [
      lead.name,
      lead.phone,
      lead.website,
      lead.primaryEmail || "",
      lead.emailStatus || "Not checked",
      lead.contactPageUrl || "",
      lead.address,
      lead.rating,
      lead.mapsLink,
      businessType,
      location,
      searchDate,
    ]);
    return [csvHeaders, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  }, [businessType, leads, location, searchDate]);

  async function loadAccount() {
    const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
    if (!response.ok) {
      window.location.href = "/login";
      return;
    }
    const data = (await response.json()) as { user: User; plan: Plan };
    if (data.user.plan === "admin") {
      window.location.href = "/admin";
      return;
    }
    setUser(data.user);
    setPlan(data.plan);
  }

  async function loadHistory() {
    const response = await fetch("/api/user/history", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      const data = (await response.json()) as { history: HistoryItem[] };
      setHistory(data.history);
    }
  }

  async function loadSavedLeads() {
    const response = await fetch("/api/user/saved-leads", { cache: "no-store", credentials: "same-origin" });
    if (response.ok) {
      const data = (await response.json()) as { savedLeads: Array<{ leadId: string }> };
      setSavedLeadIds(new Set(data.savedLeads.map((lead) => lead.leadId)));
    }
  }

  useEffect(() => {
    async function load() {
      await loadAccount();
      await Promise.all([loadHistory(), loadSavedLeads()]);
      const shopifyResponse = await fetch("/api/config/shopify");
      if (shopifyResponse.ok) setShopifyUrls(await shopifyResponse.json());
      setLoading(false);
    }
    load();
  }, []);

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");

    if (!plan) return;
    if (!canSearch) {
      setError(`You only have ${remainingCredits} lead credits remaining. Upgrade your plan or request fewer leads.`);
      setShowPricing(true);
      return;
    }

    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessType, location, radiusMiles, quantity: requestedQuantity }),
        signal: controller.signal,
      });
      const data = (await response.json()) as { leads?: Lead[]; error?: string };
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) throw new Error(data.error || "Search failed.");
      setLeads(data.leads || []);
      setSearchDate(new Date().toISOString());
      await Promise.all([loadAccount(), loadHistory()]);
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") {
        setError("Search stopped.");
      } else {
        setError(searchError instanceof Error ? searchError.message : "Search failed.");
      }
    } finally {
      setSearching(false);
      searchAbortRef.current = null;
    }
  }

  function stopSearch() {
    searchAbortRef.current?.abort();
    stopEmailScanRef.current = true;
  }

  function loadHistoryResult(item: HistoryItem) {
    setBusinessType(item.businessType);
    setLocation(item.location || item.zipCode);
    setRadiusMiles(item.radiusMiles);
    setQuantity(item.quantityRequested || item.resultCount || 10);
    setCustomQuantity("");
    setLeads(item.generatedResults || []);
    setSearchDate(item.createdAt);
    setError("");
  }

  async function findEmails() {
    if (!plan?.allowEmailExtraction) {
      setError("Upgrade to unlock public email lookup.");
      setShowPricing(true);
      return;
    }

    stopEmailScanRef.current = false;
    setFindingEmails(true);
    setEmailProgress("");

    const leadsToScan = leads.filter((lead) => lead.website);
    for (let index = 0; index < leadsToScan.length; index += 1) {
      if (stopEmailScanRef.current) {
        setEmailProgress(`Stopped after ${index} of ${leadsToScan.length} websites.`);
        break;
      }

      const lead = leadsToScan[index];
      setEmailProgress(`Scanning ${index + 1} of ${leadsToScan.length} websites...`);
      setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, emailStatus: "Scanning" } : item)));

      try {
        const response = await fetch("/api/emails", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leads: [{ id: lead.id, website: lead.website }] }),
        });
        const data = (await response.json()) as { results?: Array<Partial<Lead> & { id: string }>; error?: string };
        if (!response.ok) throw new Error(data.error || "Email lookup failed.");
        const result = data.results?.[0];
        setLeads((current) =>
          current.map((item) =>
            item.id === lead.id
              ? {
                  ...item,
                  ...result,
                  emailStatus:
                    result?.emailStatus === "Found"
                      ? "Email Found"
                      : result?.emailStatus || "Not Found",
                }
              : item,
          ),
        );
      } catch (emailError) {
        console.error("Email extraction failed", emailError);
        setLeads((current) => current.map((item) => (item.id === lead.id ? { ...item, emailStatus: "Website Unavailable" } : item)));
      }
    }
    setFindingEmails(false);
  }

  async function saveLead(lead: Lead) {
    const response = await fetch("/api/user/saved-leads", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead }),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(data.error || "Could not save lead.");
      return;
    }
    await loadSavedLeads();
  }

  async function downloadCsv() {
    await fetch("/api/user/export-history", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exportType: "dashboard_csv", resultCount: leads.length }),
    }).catch((exportError) => console.error("Could not save export history", exportError));

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fastlead-${businessType}-${location}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    window.location.href = "/login";
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[#f5f7fb] text-[#52647b]">Loading dashboard...</main>;
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <header className="border-b border-[#d8dfeb] bg-white px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <BrandLogo />
            <h1 className="mt-4 text-2xl font-bold">Lead Dashboard</h1>
            <p className="text-sm text-[#5f7188]">{user?.email}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:flex lg:items-center">
            <span className="rounded-md bg-[#edf2f7] px-3 py-2 font-bold">Plan: {plan?.label}</span>
            <span className="rounded-md bg-[#edf7f4] px-3 py-2 font-bold text-[#1f7a5c]">
              Remaining Credits: {user?.creditsRemaining ?? "Unlimited"} / {totalCredits ?? "Unlimited"}
            </span>
            <span className="rounded-md bg-[#edf2f7] px-3 py-2 font-bold">Email: {plan?.allowEmailExtraction ? "Enabled" : "Locked"}</span>
            <span className="rounded-md bg-[#edf2f7] px-3 py-2 font-bold">CSV: {plan?.csvLimited ? "Limited" : "Enabled"}</span>
            <button className="h-10 rounded-md bg-[#1f7a5c] px-4 font-bold text-white" onClick={() => setShowPricing(true)}>Upgrade Plan</button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#c9d3e1] bg-white px-4 font-bold" onClick={logout}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          <div className="rounded-lg border border-[#d8dfeb] bg-white p-5 shadow-sm">
            <h2 className="font-bold">Account Status</h2>
            <div className="mt-4 grid gap-2 text-sm text-[#52647b]">
              <p>Current Plan: <span className="font-bold text-[#172033]">{plan?.label}</span></p>
              <p>Credits Remaining: <span className="font-bold text-[#172033]">{user?.creditsRemaining ?? "Unlimited"} / {totalCredits ?? "Unlimited"}</span></p>
              <p>Email Lookup: <span className="font-bold text-[#172033]">{plan?.allowEmailExtraction ? "Enabled" : "Locked"}</span></p>
              <p>CSV Export: <span className="font-bold text-[#172033]">{plan?.csvLimited ? "Limited" : "Enabled"}</span></p>
              <p>Search History: <span className="font-bold text-[#172033]">Enabled</span></p>
              <p>Saved Leads: <span className="font-bold text-[#172033]">Enabled</span></p>
            </div>
          </div>

          <form className="rounded-lg border border-[#d8dfeb] bg-white p-5 shadow-sm" onSubmit={search}>
            <div className="space-y-4">
              <input className="h-11 w-full rounded-md border border-[#c9d3e1] px-3" onChange={(event) => setBusinessType(event.target.value)} placeholder="Business type" value={businessType} />
              <input className="h-11 w-full rounded-md border border-[#c9d3e1] px-3" onChange={(event) => setLocation(event.target.value)} placeholder="ZIP code or city" value={location} />
              <label className="block text-sm font-semibold">Radius: {radiusMiles} miles<input className="mt-2 w-full accent-[#1f7a5c]" max="30" min="1" onChange={(event) => setRadiusMiles(Number(event.target.value))} type="range" value={radiusMiles} /></label>
              <label className="block text-sm font-semibold">
                Quantity requested
                <select className="mt-2 h-11 w-full rounded-md border border-[#c9d3e1] px-3" onChange={(event) => setQuantity(Number(event.target.value))} value={quantity}>
                  {quantityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              {plan?.allowCustomQuantity ? (
                <input className="h-11 w-full rounded-md border border-[#c9d3e1] px-3" min="1" onChange={(event) => setCustomQuantity(event.target.value)} placeholder="Custom quantity" type="number" value={customQuantity} />
              ) : null}
              {!canSearch ? <p className="rounded-md bg-[#fff1f1] p-3 text-sm font-semibold text-[#9a2d2d]">Request is larger than remaining credits.</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <button className="h-11 rounded-md bg-[#183b56] text-sm font-bold text-white disabled:bg-[#7890a3]" disabled={searching || !canSearch} type="submit">
                  {searching ? "Searching" : "Search Leads"}
                </button>
                <button className="h-11 rounded-md border border-[#c9d3e1] bg-white text-sm font-bold" onClick={stopSearch} type="button">Stop Search</button>
              </div>
              <button className="h-11 w-full rounded-md border border-[#c9d3e1] bg-white text-sm font-bold" onClick={() => setLeads([])} type="button">Clear Results</button>
            </div>
          </form>

          <div className="rounded-lg border border-[#d8dfeb] bg-white p-5 shadow-sm">
            <h2 className="font-bold">Recent Searches</h2>
            {history.length ? history.map((item) => (
              <button className="mt-3 block w-full rounded-md border border-[#d8dfeb] p-3 text-left text-sm" key={item.id} onClick={() => loadHistoryResult(item)}>
                <span className="font-bold">{item.businessType}</span>
                <span className="block text-[#5f7188]">{item.location || item.zipCode} / {item.radiusMiles} miles / {item.resultCount} results / {item.creditsUsed || 0} credits</span>
                <span className="block text-xs text-[#8794a5]">{new Date(item.createdAt).toLocaleString()}</span>
              </button>
            )) : <p className="mt-3 text-sm text-[#5f7188]">No search history yet.</p>}
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-[#d8dfeb] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#d8dfeb] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Lead Results</h2>
              <p className="text-sm text-[#5f7188]">{leads.length} generated leads. {emailProgress}</p>
              {error ? <p className="mt-2 rounded-md bg-[#fff1f1] p-3 text-sm font-semibold text-[#9a2d2d]">{error}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex h-11 items-center gap-2 rounded-md bg-[#1f7a5c] px-4 text-sm font-bold text-white disabled:bg-[#8da99e]" disabled={leads.length === 0} onClick={downloadCsv}>
                <Download size={16} /> Download CSV
              </button>
              {plan?.allowEmailExtraction ? (
                <button className="inline-flex h-11 items-center gap-2 rounded-md bg-[#183b56] px-4 text-sm font-bold text-white disabled:bg-[#7890a3]" disabled={leads.length === 0 || findingEmails} onClick={findEmails}>
                  <Mail size={16} /> {findingEmails ? "Finding Emails" : "Find Public Emails"}
                </button>
              ) : (
                <button className="h-11 rounded-md border border-[#c9d3e1] bg-white px-4 text-sm font-bold" onClick={() => { setError("Upgrade to unlock public email lookup."); setShowPricing(true); }}>
                  Upgrade for Email Lookup
                </button>
              )}
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[1250px] text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#5f7188]">
                <tr>{["Save", "Business Name", "Phone", "Website", "Public Email", "Email Status", "Address", "Rating", "Maps"].map((header) => <th className="border-b border-[#d8dfeb] px-4 py-3" key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr className="align-top hover:bg-[#f8fafc]" key={lead.id}>
                    <td className="border-b border-[#edf1f6] px-4 py-4"><button className="text-[#9aa6b5]" onClick={() => saveLead(lead)}><Star fill={savedLeadIds.has(lead.id) ? "currentColor" : "none"} size={18} /></button></td>
                    <td className="border-b border-[#edf1f6] px-4 py-4 font-bold">{lead.name}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{lead.phone}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{lead.website ? <a className="font-bold text-[#1f6fa9]" href={lead.website} target="_blank">Website</a> : "-"}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{lead.primaryEmail || "-"}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{lead.emailStatus || "Not checked"}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{lead.address}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{lead.rating}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4"><a className="font-bold text-[#1f6fa9]" href={lead.mapsLink} target="_blank">Maps</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {leads.map((lead) => (
              <article className="rounded-lg border border-[#d8dfeb] p-4" key={lead.id}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-bold">{lead.name}</h3>
                  <button className="text-[#9aa6b5]" onClick={() => saveLead(lead)}><Star fill={savedLeadIds.has(lead.id) ? "currentColor" : "none"} size={18} /></button>
                </div>
                <p className="mt-2 text-sm text-[#5f7188]">{lead.address}</p>
                <p className="mt-2 text-sm">{lead.phone}</p>
                <p className="text-sm">{lead.primaryEmail || lead.emailStatus || "Not checked"}</p>
                <div className="mt-3 flex gap-3 text-sm font-bold text-[#1f6fa9]">
                  {lead.website ? <a href={lead.website} target="_blank">Website</a> : null}
                  <a href={lead.mapsLink} target="_blank">Maps</a>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      {showPricing ? (
        <div className="fixed inset-0 z-50 overflow-auto bg-[#172033]/50 p-4">
          <section className="mx-auto my-8 max-w-5xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#3a6ea5]">Upgrade</p>
                <h2 className="text-2xl font-bold">Choose a lead credit plan</h2>
              </div>
              <button className="rounded-md border border-[#c9d3e1] p-2" onClick={() => setShowPricing(false)}><X size={18} /></button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {paidPlans.map((item) => {
                const url = shopifyUrls[item.id];
                return (
                  <article className="rounded-lg border border-[#d8dfeb] p-4" key={item.id}>
                    <h3 className="text-lg font-bold">{item.label}</h3>
                    <p className="mt-1 text-2xl font-bold">{item.price}</p>
                    <p className="mt-2 text-sm text-[#5f7188]">{item.credits}</p>
                    <ul className="mt-4 space-y-2 text-sm text-[#52647b]">
                      <li>Email lookup</li>
                      <li>CSV export</li>
                      <li>Search history</li>
                      <li>Saved leads</li>
                    </ul>
                    {url ? (
                      <a className="mt-5 block rounded-md bg-[#183b56] px-4 py-3 text-center text-sm font-bold text-white" href={url} target="_blank">Upgrade to {item.label}</a>
                    ) : (
                      <button className="mt-5 w-full rounded-md bg-[#d8dfeb] px-4 py-3 text-sm font-bold text-[#5f7188]" disabled>Coming Soon</button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
