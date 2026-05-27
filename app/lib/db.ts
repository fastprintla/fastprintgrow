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
const SUPABASE_URL = process.env.SUPABASE_URL?.replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STATE_TABLE = "fastprintgrow_app_state";
const SUPABASE_STATE_ID = "main";
const EMPTY_DB: FastLeadDb = {
  users: [],
  searchHistory: [],
  savedLeads: [],
  exportHistory: [],
  magicLinks: [],
};

function normalizeDb(parsed: Partial<FastLeadDb>): FastLeadDb {
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

function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extra?: HeadersInit) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY || "",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ""}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

function supabaseTableUrl(query = "") {
  if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL is not configured.");
  }

  return `${SUPABASE_URL}/rest/v1/${SUPABASE_STATE_TABLE}${query}`;
}

async function readSupabaseDb(): Promise<FastLeadDb> {
  const response = await fetch(supabaseTableUrl(`?id=eq.${SUPABASE_STATE_ID}&select=data&limit=1`), {
    cache: "no-store",
    headers: supabaseHeaders(),
  });

  if (response.status === 404) {
    throw new Error(`Supabase table '${SUPABASE_STATE_TABLE}' does not exist. Run the setup SQL from README.md.`);
  }

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase read failed: ${message}`);
  }

  const rows = (await response.json()) as Array<{ data?: Partial<FastLeadDb> }>;

  if (!rows[0]?.data) {
    const localDb = await readLocalDbFromFile();
    const initialDb = localDb || normalizeDb(EMPTY_DB);
    await writeSupabaseDb(initialDb);
    return initialDb;
  }

  return normalizeDb(rows[0].data);
}

async function writeSupabaseDb(db: FastLeadDb) {
  const response = await fetch(supabaseTableUrl("?on_conflict=id"), {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates" }),
    body: JSON.stringify({
      id: SUPABASE_STATE_ID,
      data: db,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase write failed: ${message}`);
  }
}

async function ensureDbFile() {
  await mkdir(path.dirname(DB_PATH), { recursive: true });

  try {
    await readFile(DB_PATH, "utf8");
  } catch {
    await writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
  }
}

async function readLocalDbFromFile(): Promise<FastLeadDb | null> {
  try {
    const raw = (await readFile(DB_PATH, "utf8")).replace(/^\uFEFF/, "");
    return normalizeDb(JSON.parse(raw) as Partial<FastLeadDb>);
  } catch {
    return null;
  }
}

export async function readDb(): Promise<FastLeadDb> {
  if (hasSupabaseConfig()) {
    return readSupabaseDb();
  }

  await ensureDbFile();
  return (await readLocalDbFromFile()) || normalizeDb(EMPTY_DB);
}

export async function writeDb(db: FastLeadDb) {
  if (hasSupabaseConfig()) {
    await writeSupabaseDb(db);
    return;
  }

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
