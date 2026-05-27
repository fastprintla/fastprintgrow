"use client";

import {
  ArrowUpRight,
  Building2,
  Clock,
  Download,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  emailStatus?:
    | "Not checked"
    | "Scanning..."
    | "Email Found"
    | "Multiple Found"
    | "Contact Form Found"
    | "Fetch Blocked"
    | "Website Unavailable"
    | "Not Found"
    | "Stopped";
  emailType?: string;
  pagesChecked?: string[];
  contactPageUrl?: string;
  emailFailureReason?: string;
};

type SearchHistoryItem = {
  id: string;
  businessType: string;
  zipCode: string;
  radiusMiles: number;
  resultLimit: number;
  timestamp: number;
};

type AdminUser = {
  id: string;
  email: string;
  plan: "free" | "starter" | "growth" | "pro" | "agency" | "admin";
  active: boolean;
  creditsRemaining: number | null;
  creditsTotal: number | null;
  paymentStatus: "pending" | "paid" | "expired" | "refunded";
  createdAt: string;
  lastLoginAt: string | null;
  recentSearches?: Array<{
    id: string;
    businessType: string;
    location?: string;
    zipCode: string;
    radiusMiles: number;
    resultCount: number;
    creditsUsed?: number;
    createdAt: string;
  }>;
};

type AdminStats = {
  totalUsers: number;
  freeUsers: number;
  paidUsers: number;
  activeUsers: number;
  totalSearches: number;
  creditsUsedToday: number;
  newUsersToday: number;
};

const csvHeaders = [
  "Business name",
  "Address",
  "Phone number",
  "Website",
  "Google Maps link",
  "Primary Email",
  "All Emails",
  "Email status",
  "Email Type",
  "Pages Checked",
  "Contact Page URL",
  "Rating",
  "Category",
];

const adminResultLimitOptions = [20, 50, 100, 200, 500, 1000];
const adminPlans: AdminUser["plan"][] = ["free", "starter", "growth", "pro", "agency", "admin"];
const RESULTS_PER_PAGE = 50;
const ADMIN_HISTORY_KEY = "fastlead_admin_history";
const ADMIN_SAVED_LEADS_KEY = "fastlead_admin_saved_leads";

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminMaxLeads, setAdminMaxLeads] = useState(1000);
  const [businessType, setBusinessType] = useState("dentist");
  const [zipCode, setZipCode] = useState("90210");
  const [radiusMiles, setRadiusMiles] = useState(5);
  const [resultLimit, setResultLimit] = useState(50);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFindingEmails, setIsFindingEmails] = useState(false);
  const [emailScanProgress, setEmailScanProgress] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [savedLeads, setSavedLeads] = useState<Lead[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [savingUserId, setSavingUserId] = useState("");
  const stopEmailScanRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(leads.length / RESULTS_PER_PAGE));
  const currentPageLeads = leads.slice(
    (currentPage - 1) * RESULTS_PER_PAGE,
    currentPage * RESULTS_PER_PAGE,
  );
  const savedLeadIds = useMemo(() => new Set(savedLeads.map((lead) => lead.id)), [savedLeads]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/admin/login", { cache: "no-store" });
        const data = (await response.json()) as {
          authenticated?: boolean;
          maxLeads?: number;
        };

        setIsAuthenticated(Boolean(data.authenticated));
        setAdminMaxLeads(data.maxLeads || 1000);
      } finally {
        setIsCheckingAuth(false);
      }
    }

    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadAdminOverview();
    }
  }, [isAuthenticated]);

  async function loadAdminOverview() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { users: AdminUser[]; stats: AdminStats };
      setAdminUsers(data.users);
      setAdminStats(data.stats);
    }
  }

  useEffect(() => {
    const storedHistory = window.localStorage.getItem(ADMIN_HISTORY_KEY);
    const storedSavedLeads = window.localStorage.getItem(ADMIN_SAVED_LEADS_KEY);

    if (storedHistory) {
      setHistory(JSON.parse(storedHistory) as SearchHistoryItem[]);
    }

    if (storedSavedLeads) {
      setSavedLeads(JSON.parse(storedSavedLeads) as Lead[]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_SAVED_LEADS_KEY, JSON.stringify(savedLeads));
  }, [savedLeads]);

  const csv = useMemo(() => {
    const rows = leads.map((lead) => [
      lead.name,
      lead.address,
      lead.phone,
      lead.website,
      lead.mapsLink,
      lead.primaryEmail || "",
      lead.allEmails?.join("; ") || "",
      lead.emailStatus || "Not checked",
      lead.emailType || "",
      lead.pagesChecked?.join(" | ") || "",
      lead.contactPageUrl || "",
      lead.rating,
      lead.category,
    ]);

    return [csvHeaders, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  }, [leads]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = (await response.json()) as {
      authenticated?: boolean;
      maxLeads?: number;
      error?: string;
    };

    if (!response.ok) {
      setAuthError(data.error || "Unable to unlock admin mode.");
      return;
    }

    setIsAuthenticated(Boolean(data.authenticated));
    setAdminMaxLeads(data.maxLeads || 1000);
    setPassword("");
    await loadAdminOverview();
  }

  async function updateAdminUser(userId: string, body: Record<string, unknown>) {
    setSavingUserId(userId);
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      await loadAdminOverview();
    }

    setSavingUserId("");
  }

  async function runSearch(params: {
    businessType: string;
    zipCode: string;
    radiusMiles: number;
    resultLimit: number;
  }) {
    setIsLoading(true);
    setError("");
    setHasSearched(true);
    setCurrentPage(1);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, adminMode: true }),
      });

      const data = (await response.json()) as { leads?: Lead[]; error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Search failed.");
      }

      setLeads(data.leads || []);
      setCurrentPage(1);
      setHistory([
        {
          id: `${params.businessType}-${params.zipCode}-${params.radiusMiles}-${params.resultLimit}-${Date.now()}`,
          ...params,
          timestamp: Date.now(),
        },
        ...history.filter(
          (item) =>
            item.businessType !== params.businessType ||
            item.zipCode !== params.zipCode ||
            item.radiusMiles !== params.radiusMiles ||
            item.resultLimit !== params.resultLimit,
        ),
      ].slice(0, 50));
    } catch (searchError) {
      setLeads([]);
      setError(searchError instanceof Error ? searchError.message : "Search failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runSearch({ businessType, zipCode, radiusMiles, resultLimit });
  }

  function runHistorySearch(item: SearchHistoryItem) {
    setBusinessType(item.businessType);
    setZipCode(item.zipCode);
    setRadiusMiles(item.radiusMiles);
    setResultLimit(item.resultLimit);
    runSearch({
      businessType: item.businessType,
      zipCode: item.zipCode,
      radiusMiles: item.radiusMiles,
      resultLimit: item.resultLimit,
    });
  }

  function toggleSavedLead(lead: Lead) {
    if (savedLeadIds.has(lead.id)) {
      setSavedLeads(savedLeads.filter((savedLead) => savedLead.id !== lead.id));
      return;
    }

    setSavedLeads([lead, ...savedLeads]);
  }

  async function findEmails() {
    setIsFindingEmails(true);
    setError("");
    setEmailScanProgress("");
    stopEmailScanRef.current = false;

    const leadsToScan = currentPageLeads.filter((lead) => lead.website);

    if (leadsToScan.length === 0) {
      setError("No websites available on this page to scan.");
      setIsFindingEmails(false);
      return;
    }

    for (let index = 0; index < leadsToScan.length; index += 1) {
      if (stopEmailScanRef.current) {
        setEmailScanProgress(`Stopped after ${index} of ${leadsToScan.length} websites.`);
        break;
      }

      const leadToScan = leadsToScan[index];
      setEmailScanProgress(`Scanning ${index + 1} of ${leadsToScan.length} websites...`);
      setLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead.id === leadToScan.id
            ? { ...lead, primaryEmail: "", allEmails: [], emailStatus: "Scanning..." }
            : lead,
        ),
      );

      try {
        const response = await fetch("/api/admin/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leads: [
              {
                id: leadToScan.id,
                website: leadToScan.website,
              },
            ],
          }),
        });

        const data = (await response.json()) as {
          results?: Array<{
            id: string;
            primaryEmail: string;
            allEmails: string[];
            emailStatus:
              | "Email Found"
              | "Multiple Found"
              | "Contact Form Found"
              | "Fetch Blocked"
              | "Website Unavailable"
              | "Not Found";
            emailType: string;
            pagesChecked: string[];
            contactPageUrl: string;
            failureReason: string;
          }>;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Email lookup failed.");
        }

        const result = data.results?.[0];

        setLeads((currentLeads) =>
          currentLeads.map((lead) =>
            lead.id === leadToScan.id
              ? {
                  ...lead,
                  primaryEmail: result?.primaryEmail || "",
                  allEmails: result?.allEmails || [],
                  emailStatus: result?.emailStatus || "Not Found",
                  emailType: result?.emailType || "",
                  pagesChecked: result?.pagesChecked || [],
                  contactPageUrl: result?.contactPageUrl || "",
                  emailFailureReason: result?.failureReason || "",
                }
              : lead,
          ),
        );
      } catch (emailError) {
        console.error("Email extraction failed", {
          leadId: leadToScan.id,
          website: leadToScan.website,
          error: emailError,
        });

        setLeads((currentLeads) =>
          currentLeads.map((lead) =>
            lead.id === leadToScan.id
              ? {
                  ...lead,
                  primaryEmail: "",
                  allEmails: [],
                  emailStatus: "Website Unavailable",
                  emailFailureReason: emailError instanceof Error ? emailError.message : "Email lookup failed.",
                }
              : lead,
          ),
        );
      }
    }

    setEmailScanProgress(`Finished scanning ${leadsToScan.length} websites.`);
    setIsFindingEmails(false);
  }

  function stopEmailScan() {
    stopEmailScanRef.current = true;
    setEmailScanProgress("Stopping after current website finishes...");
  }

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fastlead-ai-admin-${businessType}-${zipCode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  if (isCheckingAuth) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 text-[#172033]">
        <div className="flex items-center gap-3 text-[#5f7188]">
          <Loader2 className="animate-spin" size={22} />
          Checking admin access
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 text-[#172033]">
        <section className="w-full max-w-md rounded-lg border border-[#d8dfeb] bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#183b56] text-white">
              <Lock size={21} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3a6ea5]">
                FastLead AI
              </p>
              <h1 className="text-2xl font-bold">Admin Access</h1>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#26364d]" htmlFor="password">
                Admin password
              </label>
              <input
                className="h-11 w-full rounded-md border border-[#c9d3e1] bg-white px-3 text-sm outline-none transition focus:border-[#3a6ea5] focus:ring-4 focus:ring-[#3a6ea5]/15"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </div>

            {authError ? (
              <div className="rounded-md border border-[#f0b8b8] bg-[#fff1f1] p-3 text-sm font-medium text-[#9a2d2d]">
                {authError}
              </div>
            ) : null}

            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#183b56] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102d43]"
              type="submit"
            >
              <ShieldCheck size={18} />
              Unlock Admin Mode
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <section className="border-b border-[#d8dfeb] bg-white">
        <div className="flex w-full flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#183b56] text-white">
              <ShieldCheck size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#3a6ea5]">
                FastLead AI
              </p>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Admin Mode — Full Lead Access
              </h1>
              <div className="mt-2 inline-flex items-center rounded-md bg-[#edf7f4] px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#1f7a5c]">
                Up to {adminMaxLeads.toLocaleString()} admin leads
              </div>
            </div>
          </div>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1f7a5c] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#176349] disabled:cursor-not-allowed disabled:bg-[#8da99e]"
            disabled={leads.length === 0}
            onClick={downloadCsv}
            type="button"
            title="Export all admin results to CSV"
          >
            <Download size={18} />
            Export Full CSV
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#183b56] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102d43] disabled:cursor-not-allowed disabled:bg-[#7890a3]"
            disabled={leads.length === 0 || isFindingEmails}
            onClick={findEmails}
            type="button"
            title="Find public emails from visible business websites"
          >
            {isFindingEmails ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            {isFindingEmails ? "Finding Public Emails" : "Find Public Emails"}
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#c9d3e1] bg-white px-4 text-sm font-semibold text-[#26364d] shadow-sm transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:text-[#9aa6b5]"
            disabled={!isFindingEmails}
            onClick={stopEmailScan}
            type="button"
            title="Stop email scanning after the current website"
          >
            Stop
          </button>
        </div>
      </section>

      <section className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Admin Dashboard</h2>
            <p className="text-sm text-[#5f7188]">User plans, credits, payments, and recent activity.</p>
          </div>
          <a className="rounded-md bg-[#183b56] px-4 py-2 text-sm font-bold text-white" href="/admin/users">
            Full User Management
          </a>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {[
            ["Total users", adminStats?.totalUsers ?? 0],
            ["Free users", adminStats?.freeUsers ?? 0],
            ["Paid users", adminStats?.paidUsers ?? 0],
            ["Active users", adminStats?.activeUsers ?? 0],
            ["Total searches", adminStats?.totalSearches ?? 0],
            ["Credits used today", adminStats?.creditsUsedToday ?? 0],
            ["New users today", adminStats?.newUsersToday ?? 0],
          ].map(([label, value]) => (
            <div className="rounded-lg border border-[#d8dfeb] bg-white p-4 shadow-sm" key={label}>
              <p className="text-xs font-bold uppercase text-[#5f7188]">{label}</p>
              <p className="mt-2 text-2xl font-bold text-[#172033]">{value}</p>
            </div>
          ))}
        </div>

        <section className="mt-5 rounded-lg border border-[#d8dfeb] bg-white shadow-sm">
          <div className="border-b border-[#d8dfeb] p-5">
            <h3 className="font-bold">Recent User Registrations</h3>
          </div>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1100px] text-left text-sm">
              <thead className="bg-[#f8fafc] text-xs uppercase text-[#5f7188]">
                <tr>{["Email", "Plan", "Remaining Credits", "Payment", "Created", "Last Login", "Actions", "Search History"].map((header) => <th className="border-b border-[#d8dfeb] px-4 py-3" key={header}>{header}</th>)}</tr>
              </thead>
              <tbody>
                {adminUsers.slice(0, 8).map((user) => (
                  <tr className="align-top hover:bg-[#f8fafc]" key={user.id}>
                    <td className="border-b border-[#edf1f6] px-4 py-4 font-bold">{user.email}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">
                      <select className="h-10 rounded-md border border-[#c9d3e1] px-2" disabled={savingUserId === user.id} onChange={(event) => updateAdminUser(user.id, { plan: event.target.value })} value={user.plan}>
                        {adminPlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                      </select>
                    </td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">
                      <input className="h-10 w-24 rounded-md border border-[#c9d3e1] px-2" defaultValue={user.creditsRemaining ?? ""} disabled={savingUserId === user.id} onBlur={(event) => updateAdminUser(user.id, { creditsRemaining: Number(event.target.value) })} type="number" />
                    </td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{user.paymentStatus}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "-"}</td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">
                      <button className="rounded-md border border-[#c9d3e1] px-3 py-2 text-xs font-bold" disabled={savingUserId === user.id} onClick={() => updateAdminUser(user.id, { active: !user.active })}>
                        {user.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                    <td className="border-b border-[#edf1f6] px-4 py-4">
                      {user.recentSearches?.length ? (
                        <details>
                          <summary className="cursor-pointer font-bold text-[#1f6fa9]">View</summary>
                          <div className="mt-2 space-y-2">
                            {user.recentSearches.map((search) => (
                              <p className="text-xs text-[#52647b]" key={search.id}>
                                {search.businessType} / {search.location || search.zipCode} / {search.resultCount} results / {search.creditsUsed || 0} credits
                              </p>
                            ))}
                          </div>
                        </details>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 lg:hidden">
            {adminUsers.slice(0, 8).map((user) => (
              <article className="rounded-lg border border-[#d8dfeb] p-4" key={user.id}>
                <p className="font-bold">{user.email}</p>
                <p className="text-sm text-[#5f7188]">{user.plan} / {user.creditsRemaining ?? "Unlimited"} credits / {user.paymentStatus}</p>
                <div className="mt-3 grid gap-2">
                  <select className="h-10 rounded-md border border-[#c9d3e1] px-2" onChange={(event) => updateAdminUser(user.id, { plan: event.target.value })} value={user.plan}>
                    {adminPlans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                  </select>
                  <button className="h-10 rounded-md border border-[#c9d3e1] text-sm font-bold" onClick={() => updateAdminUser(user.id, { active: !user.active })}>
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="grid w-full gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:px-8">
        <aside className="h-fit rounded-lg border border-[#d8dfeb] bg-white p-5 shadow-sm">
          <form className="space-y-5" onSubmit={handleSearch}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#26364d]" htmlFor="businessType">
                Business type
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6d7d91]" size={18} />
                <input
                  className="h-11 w-full rounded-md border border-[#c9d3e1] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#3a6ea5] focus:ring-4 focus:ring-[#3a6ea5]/15"
                  id="businessType"
                  onChange={(event) => setBusinessType(event.target.value)}
                  placeholder="dentist, plumber, gym"
                  type="text"
                  value={businessType}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#26364d]" htmlFor="zipCode">
                ZIP code
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6d7d91]" size={18} />
                <input
                  className="h-11 w-full rounded-md border border-[#c9d3e1] bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#3a6ea5] focus:ring-4 focus:ring-[#3a6ea5]/15"
                  id="zipCode"
                  inputMode="numeric"
                  onChange={(event) => setZipCode(event.target.value)}
                  placeholder="90210"
                  type="text"
                  value={zipCode}
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-semibold text-[#26364d]" htmlFor="radiusMiles">
                  Radius
                </label>
                <span className="rounded-md bg-[#edf2f7] px-2 py-1 text-xs font-semibold text-[#3d4f67]">
                  {radiusMiles} miles
                </span>
              </div>
              <input
                className="w-full accent-[#1f7a5c]"
                id="radiusMiles"
                max="30"
                min="1"
                onChange={(event) => setRadiusMiles(Number(event.target.value))}
                type="range"
                value={radiusMiles}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#26364d]" htmlFor="resultLimit">
                Results per search
              </label>
              <select
                className="h-11 w-full rounded-md border border-[#c9d3e1] bg-white px-3 text-sm outline-none transition focus:border-[#3a6ea5] focus:ring-4 focus:ring-[#3a6ea5]/15"
                id="resultLimit"
                onChange={(event) => setResultLimit(Number(event.target.value))}
                value={resultLimit}
              >
                {adminResultLimitOptions
                  .filter((option) => option <= adminMaxLeads)
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </div>

            <button
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#183b56] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#102d43] disabled:cursor-wait disabled:bg-[#7890a3]"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
              {isLoading ? "Searching" : "Run Admin Search"}
            </button>
          </form>

          <div className="mt-5 border-t border-[#d8dfeb] pt-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#172033]">
              <Clock size={16} /> Recent Searches
            </h2>
            {history.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {history.map((item) => (
                  <button
                    className="w-full rounded-md border border-[#d8dfeb] bg-white p-3 text-left text-sm transition hover:bg-[#f8fafc]"
                    key={item.id}
                    onClick={() => runHistorySearch(item)}
                    type="button"
                  >
                    <span className="block font-bold text-[#172033]">{item.businessType}</span>
                    <span className="text-[#5f7188]">
                      {item.zipCode} · {item.radiusMiles} miles · {item.resultLimit} results
                    </span>
                    <span className="mt-1 block text-xs text-[#8794a5]">
                      {new Date(item.timestamp).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#5f7188]">No recent searches yet.</p>
            )}
          </div>

          <div className="mt-5 border-t border-[#d8dfeb] pt-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#172033]">
              <Star size={16} /> My Leads
            </h2>
            <p className="mb-3 text-sm text-[#5f7188]">{savedLeads.length} saved leads</p>
            {savedLeads.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {savedLeads.slice(0, 12).map((lead) => (
                  <div className="rounded-md border border-[#d8dfeb] p-3 text-sm" key={lead.id}>
                    <p className="font-bold text-[#172033]">{lead.name}</p>
                    <p className="text-[#5f7188]">{lead.phone}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#5f7188]">Star a business to save it here.</p>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-[#d8dfeb] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[#d8dfeb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#172033]">Admin Results</h2>
              <p className="text-sm text-[#5f7188]">
                {leads.length > 0
                  ? `${leads.length} unlocked businesses found near ${zipCode}`
                  : "Full-access results will appear here after a search."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              <div className="rounded-md bg-[#edf7f4] px-3 py-2 text-sm font-bold text-[#1f7a5c]">
                No upgrade lock
              </div>
              <div className="rounded-md bg-[#edf2f7] px-3 py-2 text-sm font-bold text-[#26364d]">
                Total results: {leads.length}
              </div>
            </div>
          </div>

          {error ? (
            <div className="m-5 rounded-md border border-[#f0b8b8] bg-[#fff1f1] p-4 text-sm font-medium text-[#9a2d2d]">
              {error}
            </div>
          ) : null}

          {isFindingEmails || emailScanProgress ? (
            <div className="mx-5 mt-5 flex items-center gap-3 rounded-md border border-[#d8dfeb] bg-[#f8fafc] p-4 text-sm font-semibold text-[#52647b]">
              {isFindingEmails ? <Loader2 className="animate-spin" size={18} /> : null}
              {emailScanProgress}
            </div>
          ) : null}

          {!error && hasSearched && leads.length === 0 && !isLoading ? (
            <div className="p-10 text-center text-[#5f7188]">No matching businesses found.</div>
          ) : null}

          {!hasSearched && !isLoading ? (
            <div className="p-10 text-center text-[#5f7188]">
              Search with admin access to export the full available result set.
            </div>
          ) : null}

          {isLoading ? (
            <div className="grid min-h-[320px] place-items-center text-[#5f7188]">
              <div className="flex items-center gap-3">
                <Loader2 className="animate-spin" size={22} />
                Searching Google Places
              </div>
            </div>
          ) : null}

          {leads.length > 0 ? (
            <>
              <div className="flex flex-col gap-3 border-b border-[#d8dfeb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#52647b]">
                  Page {currentPage} of {totalPages} · Showing {currentPageLeads.length} of {leads.length}
                </p>
                <div className="flex gap-2">
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[#c9d3e1] bg-white px-3 text-sm font-bold text-[#26364d] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:text-[#9aa6b5]"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="inline-flex h-10 items-center justify-center rounded-md border border-[#c9d3e1] bg-white px-3 text-sm font-bold text-[#26364d] transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:text-[#9aa6b5]"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="hidden w-full overflow-x-auto md:block">
                <table className="min-w-[1320px] border-collapse text-left text-sm">
                  <thead className="bg-[#f8fafc] text-xs uppercase text-[#5f7188]">
                    <tr>
                      <th className="border-b border-[#d8dfeb] px-4 py-3 font-bold">Save</th>
                      {csvHeaders.map((header) => (
                        <th className="border-b border-[#d8dfeb] px-4 py-3 font-bold" key={header}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageLeads.map((lead) => (
                      <tr className="align-top transition hover:bg-[#f8fafc]" key={lead.id}>
                        <td className="border-b border-[#edf1f6] px-4 py-4">
                          <button
                            className="text-[#9aa6b5] transition hover:text-[#d89b00]"
                            onClick={() => toggleSavedLead(lead)}
                            title="Save lead"
                            type="button"
                          >
                            <Star fill={savedLeadIds.has(lead.id) ? "currentColor" : "none"} size={18} />
                          </button>
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 font-semibold text-[#172033]">
                          {lead.name}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.address}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.phone}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4">
                          {lead.website ? (
                            <a className="inline-flex items-center gap-1 font-semibold text-[#1f6fa9] hover:underline" href={lead.website} rel="noreferrer" target="_blank">
                              Website <ArrowUpRight size={14} />
                            </a>
                          ) : (
                            <span className="text-[#8794a5]">Not available</span>
                          )}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4">
                          <a className="inline-flex items-center gap-1 font-semibold text-[#1f6fa9] hover:underline" href={lead.mapsLink} rel="noreferrer" target="_blank">
                            Maps <ArrowUpRight size={14} />
                          </a>
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.primaryEmail ? (
                            <a className="font-semibold text-[#1f6fa9] hover:underline" href={`mailto:${lead.primaryEmail}`}>
                              {lead.primaryEmail}
                            </a>
                          ) : (
                            <span className="text-[#8794a5]">-</span>
                          )}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.allEmails?.length ? lead.allEmails.join(", ") : "-"}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-bold ${
                              lead.emailStatus === "Email Found" || lead.emailStatus === "Multiple Found"
                                ? "bg-[#edf7f4] text-[#1f7a5c]"
                                : lead.emailStatus === "Scanning..."
                                  ? "bg-[#eaf3ff] text-[#1f6fa9]"
                                  : lead.emailStatus === "Not Found"
                                  ? "bg-[#fff9e9] text-[#7b5a00]"
                                  : "bg-[#edf2f7] text-[#52647b]"
                            }`}
                          >
                            {lead.emailStatus || "Not checked"}
                          </span>
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.emailType || "-"}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          <details>
                            <summary className="cursor-pointer font-semibold text-[#1f6fa9]">
                              {lead.pagesChecked?.length || 0} pages
                            </summary>
                            <div className="mt-2 max-w-[320px] space-y-1 text-xs">
                              {lead.pagesChecked?.map((page) => (
                                <div className="break-all" key={page}>{page}</div>
                              ))}
                              {lead.emailFailureReason ? (
                                <div className="font-semibold text-[#7b5a00]">{lead.emailFailureReason}</div>
                              ) : null}
                            </div>
                          </details>
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.contactPageUrl ? (
                            <a className="font-semibold text-[#1f6fa9] hover:underline" href={lead.contactPageUrl} rel="noreferrer" target="_blank">
                              Contact page
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.rating}
                        </td>
                        <td className="border-b border-[#edf1f6] px-4 py-4 text-[#52647b]">
                          {lead.category}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {currentPageLeads.map((lead) => (
                  <article className="rounded-lg border border-[#d8dfeb] p-4" key={lead.id}>
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-[#172033]">{lead.name}</h3>
                        <p className="mt-1 text-sm text-[#5f7188]">{lead.category}</p>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#fff6df] px-2 py-1 text-sm font-semibold text-[#815d00]">
                        <Star size={14} fill="currentColor" /> {lead.rating}
                      </span>
                    </div>
                    <button
                      className="mb-3 inline-flex items-center gap-2 rounded-md border border-[#d8dfeb] px-3 py-2 text-sm font-bold text-[#26364d]"
                      onClick={() => toggleSavedLead(lead)}
                      type="button"
                    >
                      <Star fill={savedLeadIds.has(lead.id) ? "currentColor" : "none"} size={16} />
                      {savedLeadIds.has(lead.id) ? "Saved" : "Save Lead"}
                    </button>
                    <div className="space-y-2 text-sm text-[#52647b]">
                      <p className="flex gap-2"><MapPin className="mt-0.5 shrink-0" size={16} /> {lead.address}</p>
                      <p className="flex gap-2"><Phone className="mt-0.5 shrink-0" size={16} /> {lead.phone}</p>
                      {lead.website ? (
                        <a className="flex gap-2 font-semibold text-[#1f6fa9]" href={lead.website} rel="noreferrer" target="_blank">
                          <Globe className="mt-0.5 shrink-0" size={16} /> Website
                        </a>
                      ) : null}
                      <p className="flex gap-2">
                        <Globe className="mt-0.5 shrink-0" size={16} />
                        {lead.primaryEmail ? (
                          <a className="font-semibold text-[#1f6fa9]" href={`mailto:${lead.primaryEmail}`}>
                            {lead.primaryEmail}
                          </a>
                        ) : (
                          lead.emailStatus || "Not checked"
                        )}
                      </p>
                      <a className="flex gap-2 font-semibold text-[#1f6fa9]" href={lead.mapsLink} rel="noreferrer" target="_blank">
                        <MapPin className="mt-0.5 shrink-0" size={16} /> Google Maps
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}
