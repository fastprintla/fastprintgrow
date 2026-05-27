import { Check, Lock, Mail, Search, ShieldCheck, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Free",
    price: "Free",
    credits: "20 credits",
    features: ["Basic lead search", "Limited CSV", "No email lookup"],
    href: "/login",
    cta: "Start Free",
  },
  {
    name: "Starter",
    price: "$9.99",
    credits: "100 credits",
    features: ["Email lookup", "CSV export", "Search history", "Saved leads"],
    href: "/login",
    cta: "Login to Upgrade",
  },
  {
    name: "Growth",
    price: "$19.99",
    credits: "250 credits",
    features: ["Email lookup", "CSV export", "Search history", "Saved leads"],
    href: "/login",
    cta: "Login to Upgrade",
  },
  {
    name: "Pro",
    price: "$29.99",
    credits: "500 credits",
    features: ["Email lookup", "Full CSV export", "Full history", "Saved leads"],
    href: "/login",
    cta: "Login to Upgrade",
  },
  {
    name: "Agency",
    price: "$49.99",
    credits: "1000 credits",
    features: ["Email lookup", "Full CSV export", "Full history", "Saved leads"],
    href: "/login",
    cta: "Login to Upgrade",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f5f7fb] text-[#172033]">
      <section className="border-b border-[#d8dfeb] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-[#183b56] text-white">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#3a6ea5]">FastLead AI</p>
              <h1 className="text-2xl font-bold sm:text-3xl">Local Business Lead Finder</h1>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#183b56] px-4 text-sm font-bold text-white" href="/login">
              <Mail size={17} />
              Login with Email
            </a>
            <a className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#c9d3e1] bg-white px-4 text-sm font-bold text-[#26364d]" href="/signup">
              Create Account
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <div className="flex flex-col justify-center">
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-md bg-[#edf7f4] px-3 py-2 text-sm font-bold text-[#1f7a5c]">
            <Lock size={16} />
            Login required before searching
          </div>
          <h2 className="max-w-3xl text-4xl font-black tracking-normal text-[#172033] sm:text-5xl">
            Find local business leads with credits, email lookup, and CSV export.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#52647b]">
            Public visitors can view plans, but lead search is protected. Users must log in with the same email used during Shopify checkout before using Google Places search or credits.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#1f7a5c] px-5 text-sm font-bold text-white" href="/login">
              <Search size={18} />
              Go to Login
            </a>
            <a className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#c9d3e1] bg-white px-5 text-sm font-bold text-[#26364d]" href="#pricing">
              View Pricing
            </a>
          </div>
        </div>

        <div className="rounded-lg border border-[#d8dfeb] bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">SaaS Access Rules</h3>
          <div className="mt-4 space-y-3 text-sm text-[#52647b]">
            <p className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[#1f7a5c]" size={17} /> Google API calls run only from server-side routes.</p>
            <p className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[#1f7a5c]" size={17} /> Search requires a logged-in account and available credits.</p>
            <p className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[#1f7a5c]" size={17} /> Free users cannot use public email lookup.</p>
            <p className="flex gap-2"><ShieldCheck className="mt-0.5 shrink-0 text-[#1f7a5c]" size={17} /> Admin access remains private at `/admin`.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8" id="pricing">
        <div className="mb-5">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#1f7a5c]">Limited Early Access Pricing</p>
          <h2 className="mt-2 text-2xl font-bold">Choose a lead credit plan</h2>
          <p className="mt-2 text-sm text-[#5f7188]">Prices may increase after beta launch. Shopify upgrade links are shown after login.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {plans.map((plan) => (
            <article className="rounded-lg border border-[#d8dfeb] bg-white p-5 shadow-sm" key={plan.name}>
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-4 text-3xl font-black">{plan.price}</p>
              <p className="mt-1 text-sm font-semibold text-[#5f7188]">{plan.credits}</p>
              <div className="mt-5 space-y-2">
                {plan.features.map((feature) => (
                  <p className="flex gap-2 text-sm text-[#52647b]" key={feature}>
                    <Check className="mt-0.5 shrink-0 text-[#1f7a5c]" size={16} />
                    {feature}
                  </p>
                ))}
              </div>
              <a className="mt-6 block rounded-md bg-[#183b56] px-4 py-3 text-center text-sm font-bold text-white" href={plan.href}>
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
