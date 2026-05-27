"use client";

import { useEffect, useState } from "react";
import BrandLogo from "../../components/BrandLogo";
import type { PlanId } from "../../lib/plans";

type AdminUser = {
  id: string;
  fullName: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  industry: string;
  notes: string;
  plan: PlanId;
  active: boolean;
  creditsRemaining: number | null;
  creditsTotal: number | null;
  shopifyOrderNumber: string;
  paymentStatus: "pending" | "paid" | "expired" | "refunded";
  createdAt: string;
  lastLoginAt: string | null;
  totalSearches: number;
  totalExports: number;
  recentSearches: Array<{
    id: string;
    businessType: string;
    zipCode: string;
    radiusMiles: number;
    resultCount: number;
    createdAt: string;
  }>;
  recentExports: Array<{
    id: string;
    exportType: string;
    resultCount: number;
    createdAt: string;
  }>;
};

const plans: PlanId[] = ["free", "starter", "growth", "pro", "agency", "admin"];
const paymentStatuses = ["pending", "paid", "expired", "refunded"];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState("");
  const [savingUserId, setSavingUserId] = useState("");

  async function loadUsers() {
    const response = await fetch("/api/admin/users");
    const data = (await response.json()) as { users?: AdminUser[]; error?: string };

    if (!response.ok) {
      setError(data.error || "Admin access required.");
      return;
    }

    setUsers(data.users || []);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function updatePlan(userId: string, plan: PlanId) {
    setSavingUserId(userId);
    setError("");

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error || "Could not update plan.");
    }

    await loadUsers();
    setSavingUserId("");
  }

  async function updateActive(userId: string, active: boolean) {
    setSavingUserId(userId);
    setError("");

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error || "Could not update user status.");
    }

    await loadUsers();
    setSavingUserId("");
  }

  async function updateUser(userId: string, body: Record<string, unknown>) {
    setSavingUserId(userId);
    setError("");

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error || "Could not update user.");
    }

    await loadUsers();
    setSavingUserId("");
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-[#172033] sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <BrandLogo size="sm" />
          <h1 className="mt-4 text-2xl font-bold">Registered Users</h1>
        </div>
        <a className="rounded-md bg-[#183b56] px-4 py-2 text-sm font-bold text-white" href="/admin">
          Admin Search
        </a>
      </div>

      {error ? <div className="mb-5 rounded-md bg-[#fff1f1] p-4 text-sm font-semibold text-[#9a2d2d]">{error}</div> : null}

      <section className="overflow-x-auto rounded-lg border border-[#d8dfeb] bg-white shadow-sm">
        <table className="min-w-[1650px] text-left text-sm">
          <thead className="bg-[#f8fafc] text-xs uppercase text-[#5f7188]">
            <tr>
              {[
                "Full name",
                "Company",
                "Phone",
                "Email",
                "Industry",
                "Status",
                "Current plan",
                "Remaining credits",
                "Plan total",
                "Shopify order",
                "Payment",
                "Created",
                "Last login",
                "Total searches",
                "Recent searches",
                "Exports",
                "Recent exports",
                "Notes",
                "Actions",
              ].map((header) => (
                <th className="border-b border-[#d8dfeb] px-4 py-3" key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr className="align-top hover:bg-[#f8fafc]" key={user.id}>
                <td className="border-b border-[#edf1f6] px-4 py-4 font-bold">{user.fullName}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.companyName}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.phoneNumber}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.email}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.industry}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  <span className={`rounded-md px-2 py-1 text-xs font-bold ${user.active ? "bg-[#e9f8f1] text-[#08734f]" : "bg-[#fff1f1] text-[#9a2d2d]"}`}>
                    {user.active ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  <select
                    className="h-10 rounded-md border border-[#c9d3e1] bg-white px-2"
                    disabled={savingUserId === user.id}
                    onChange={(event) => updatePlan(user.id, event.target.value as PlanId)}
                    value={user.plan}
                  >
                    {plans.map((plan) => <option key={plan} value={plan}>{plan}</option>)}
                  </select>
                </td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  <input
                    className="h-10 w-24 rounded-md border border-[#c9d3e1] px-2"
                    disabled={savingUserId === user.id}
                    onBlur={(event) => updateUser(user.id, { creditsRemaining: Number(event.target.value) })}
                    defaultValue={user.creditsRemaining ?? ""}
                    type="number"
                  />
                </td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.creditsTotal ?? "Unlimited"}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  <input
                    className="h-10 w-36 rounded-md border border-[#c9d3e1] px-2"
                    disabled={savingUserId === user.id}
                    onBlur={(event) => updateUser(user.id, { shopifyOrderNumber: event.target.value })}
                    defaultValue={user.shopifyOrderNumber || ""}
                  />
                </td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  <select
                    className="h-10 rounded-md border border-[#c9d3e1] bg-white px-2"
                    disabled={savingUserId === user.id}
                    onChange={(event) => updateUser(user.id, { paymentStatus: event.target.value })}
                    value={user.paymentStatus}
                  >
                    {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{new Date(user.createdAt).toLocaleDateString()}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "-"}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.totalSearches}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  {user.recentSearches?.length ? (
                    <details>
                      <summary className="cursor-pointer font-bold text-[#1f6fa9]">View</summary>
                      <div className="mt-2 space-y-2">
                        {user.recentSearches.map((search) => (
                          <p className="text-xs text-[#52647b]" key={search.id}>
                            <span className="font-bold text-[#172033]">{search.businessType}</span> / {search.zipCode} / {search.radiusMiles} mi / {search.resultCount} leads
                            <span className="block">{new Date(search.createdAt).toLocaleString()}</span>
                          </p>
                        ))}
                      </div>
                    </details>
                  ) : "-"}
                </td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.totalExports || 0}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  {user.recentExports?.length ? (
                    <details>
                      <summary className="cursor-pointer font-bold text-[#1f6fa9]">View</summary>
                      <div className="mt-2 space-y-2">
                        {user.recentExports.map((exportItem) => (
                          <p className="text-xs text-[#52647b]" key={exportItem.id}>
                            <span className="font-bold text-[#172033]">{exportItem.exportType}</span> / {exportItem.resultCount} leads
                            <span className="block">{new Date(exportItem.createdAt).toLocaleString()}</span>
                          </p>
                        ))}
                      </div>
                    </details>
                  ) : "-"}
                </td>
                <td className="border-b border-[#edf1f6] px-4 py-4">{user.notes || "-"}</td>
                <td className="border-b border-[#edf1f6] px-4 py-4">
                  <button
                    className={`rounded-md px-3 py-2 text-xs font-bold ${user.active ? "bg-[#fff1f1] text-[#9a2d2d]" : "bg-[#e9f8f1] text-[#08734f]"}`}
                    disabled={savingUserId === user.id}
                    onClick={() => updateActive(user.id, !user.active)}
                  >
                    {user.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="mt-2 block rounded-md bg-[#edf2f7] px-3 py-2 text-xs font-bold text-[#26364d]"
                    disabled={savingUserId === user.id}
                    onClick={() => updateUser(user.id, { resetCredits: true })}
                  >
                    Reset credits
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
