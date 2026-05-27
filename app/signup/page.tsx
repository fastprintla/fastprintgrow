"use client";

import { FormEvent, useState } from "react";
import { Building2 } from "lucide-react";
import BrandLogo from "../components/BrandLogo";

export default function SignupPage() {
  const [form, setForm] = useState({
    fullName: "",
    companyName: "",
    phoneNumber: "",
    email: "",
    industry: "",
    notes: "",
  });
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(data.error || "Signup failed.");
      return;
    }

    window.location.href = "/dashboard";
  }

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-4 py-8 text-[#172033]">
      <section className="mx-auto max-w-2xl rounded-lg border border-[#d8dfeb] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <BrandLogo />
          <h1 className="mt-5 text-2xl font-bold">Create Account</h1>
        </div>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          {[
            ["fullName", "Full name"],
            ["companyName", "Company name"],
            ["phoneNumber", "Phone number"],
            ["email", "Email"],
            ["industry", "Industry"],
          ].map(([field, label]) => (
            <label className="block text-sm font-semibold text-[#26364d]" key={field}>
              {label}
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#c9d3e1] px-3 outline-none focus:border-[#3a6ea5] focus:ring-4 focus:ring-[#3a6ea5]/15"
                onChange={(event) => updateField(field as keyof typeof form, event.target.value)}
                type={field === "email" ? "email" : "text"}
                value={form[field as keyof typeof form]}
              />
            </label>
          ))}

          <label className="block text-sm font-semibold text-[#26364d] sm:col-span-2">
            Notes optional
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-[#c9d3e1] px-3 py-2 outline-none focus:border-[#3a6ea5] focus:ring-4 focus:ring-[#3a6ea5]/15"
              onChange={(event) => updateField("notes", event.target.value)}
              value={form.notes}
            />
          </label>

          {error ? (
            <div className="rounded-md border border-[#f0b8b8] bg-[#fff1f1] p-3 text-sm font-semibold text-[#9a2d2d] sm:col-span-2">
              {error}
            </div>
          ) : null}

          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#183b56] px-4 text-sm font-bold text-white sm:col-span-2" type="submit">
            <Building2 size={18} />
            Create Account
          </button>
        </form>
      </section>
    </main>
  );
}
