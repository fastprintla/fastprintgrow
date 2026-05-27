"use client";

import { FormEvent, useEffect, useState } from "react";
import { Send } from "lucide-react";
import BrandLogo from "../components/BrandLogo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [magicLink, setMagicLink] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loginError = params.get("error");

    if (loginError === "expired") {
      setError("That magic link is expired or already used. Request a new one.");
    }

    if (loginError === "deactivated") {
      setError("This account has been deactivated.");
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setMagicLink("");
    setSending(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const rawResponse = await response.text();
    let data: { error?: string; message?: string; magicLink?: string; signupUrl?: string } = {};

    try {
      data = rawResponse ? JSON.parse(rawResponse) : {};
    } catch {
      data = { error: rawResponse || "Login request returned an invalid response." };
    }

    setSending(false);

    if (!response.ok) {
      if (response.status === 404 && data.signupUrl) {
        window.location.href = data.signupUrl;
        return;
      }
      setError(data.error || "Could not create login link.");
      return;
    }

    setMessage(data.message || "Check your email for a magic login link.");
    setMagicLink(data.magicLink || "");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f7fb] px-4 text-[#172033]">
      <section className="w-full max-w-md rounded-lg border border-[#d8dfeb] bg-white p-6 shadow-sm">
        <div className="mb-6">
          <BrandLogo />
          <h1 className="mt-5 text-2xl font-bold">Email Login</h1>
        </div>

        <p className="mb-5 rounded-md bg-[#edf7f4] p-3 text-sm font-semibold text-[#1f7a5c]">
          Use the same email you used during Shopify checkout.
        </p>

        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-semibold text-[#26364d]">
            Email
            <input
              className="mt-2 h-11 w-full rounded-md border border-[#c9d3e1] px-3 outline-none focus:border-[#3a6ea5] focus:ring-4 focus:ring-[#3a6ea5]/15"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              type="email"
              value={email}
            />
          </label>

          {error ? <div className="rounded-md bg-[#fff1f1] p-3 text-sm font-semibold text-[#9a2d2d]">{error}</div> : null}
          {message ? <div className="rounded-md bg-[#edf7f4] p-3 text-sm font-semibold text-[#1f7a5c]">{message}</div> : null}
          {magicLink ? (
            <a
              className="block rounded-md border border-[#1f7a5c] bg-white p-3 text-center text-sm font-bold text-[#1f7a5c] hover:bg-[#edf7f4]"
              href={magicLink}
            >
              Continue Login Locally
            </a>
          ) : null}

          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#183b56] px-4 text-sm font-bold text-white disabled:bg-[#7890a3]"
            disabled={sending}
            type="submit"
          >
            <Send size={18} />
            {sending ? "Creating Link" : "Send Magic Link"}
          </button>
        </form>
      </section>
    </main>
  );
}
