import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getPlanConfig, type PlanId } from "./plans";
import { randomUUID } from "crypto";

export type PaymentStatus = "pending" | "paid" | "expired" | "refunded";

export type DbLead = {
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

export type DbUser = {
  id: string;
  fullName: string;
  companyName: string;
  phoneNumber: string;
  email: string;
  passwordHash?: string;
  industry: string;
  notes: string;
  plan: PlanId;
  creditsRemaining: number | null;
  creditsTotal: number | null;
  chargedLeadIds: string[];
  shopifyOrderNumber: string;
  paymentStatus: PaymentStatus;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  totalSearches: number;
};

export type DbSearchHistory = {
  id: string;
  userId: string;
  userEmail?: string;
  businessType: string;
  zipCode: string;
  location?: string;
  radiusMiles: number;
  quantityRequested?: number;
  resultCount: number;
  creditsUsed?: number;
  generatedResults?: DbLead[];
  createdAt: string;
};

export type DbSavedLead = {
  id: string;
  userId: string;
  userEmail?: string;
  leadId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  mapsLink: string;
  rating: string;
  category: string;
  primaryEmail?: string;
  allEmails?: string[];
  notes?: string;
  createdAt: string;
};

export type DbExportHistory = {
  id: string;
  userId: string;
  exportType: string;
  resultCount: number;
  createdAt: string;
};

export type DbMagicLink = {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

export type FastLeadDb = {
  users: DbUser[];
  searchHistory: DbSearchHistory[];
  savedLeads: DbSavedLead[];
  exportHistory: DbExportHistory[];
  magicLinks: DbMagicLink[];
};

const DB_PATH = process.env.FASTLEAD_DB_PATH ||
  (process.env.VERCEL
    ? path.join("/tmp", "data", "fastlead-db.json")
    : path.join(process.cwd(), "data", "fastlead-db.json"));
const EMPTY_DB: FastLeadDb = {
  users: [],
  searchHistory: [],
  savedLeads: [],
  exportHistory: [],
  magicLinks: [],
};

async function ensureDbFile() {
  await mkdir(path.dirname(DB_PATH), { recursive: true });

  try {
    await readFile(DB_PATH, "utf8");
  } catch {
    await writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
  }
}

export async function readDb(): Promise<FastLeadDb> {
  await ensureDbFile();
  const raw = (await readFile(DB_PATH, "utf8")).replace(/^\uFEFF/, "");
  const parsed = JSON.parse(raw) as Partial<FastLeadDb>;

  return {
    users: (parsed.users || []).map((user) => ({
      ...user,
      active: user.active ?? true,
      creditsTotal: user.creditsTotal ?? getPlanConfig(user.plan).creditTotal,
      creditsRemaining: user.creditsRemaining ?? getPlanConfig(user.plan).creditTotal,
      chargedLeadIds: user.chargedLeadIds ?? [],
      shopifyOrderNumber: user.shopifyOrderNumber ?? "",
      paymentStatus: user.paymentStatus ?? (user.plan === "free" ? "pending" : "paid"),
      totalSearches: user.totalSearches ?? 0,
      lastLoginAt: user.lastLoginAt ?? null,
      fullName: user.fullName ?? "",
      companyName: user.companyName ?? "",
      phoneNumber: user.phoneNumber ?? "",
      industry: user.industry ?? "",
      notes: user.notes ?? "",
    })) as DbUser[],
    searchHistory: (parsed.searchHistory || []).map((item) => ({
      ...item,
      location: item.location ?? item.zipCode,
      quantityRequested: item.quantityRequested ?? item.resultCount,
      creditsUsed: item.creditsUsed ?? item.resultCount,
      generatedResults: item.generatedResults ?? [],
    })),
    savedLeads: (parsed.savedLeads || []).map((lead) => ({
      ...lead,
      notes: lead.notes ?? "",
    })),
    exportHistory: parsed.exportHistory || [],
    magicLinks: parsed.magicLinks || [],
  };
}

export async function writeDb(db: FastLeadDb) {
  await mkdir(path.dirname(DB_PATH), { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

export function publicUser(user: DbUser) {
  const { passwordHash: _passwordHash, chargedLeadIds: _chargedLeadIds, ...safeUser } = user;
  return safeUser;
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}
