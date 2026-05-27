export type PlanId = "free" | "starter" | "growth" | "pro" | "agency" | "admin";

export type PlanConfig = {
  id: PlanId;
  label: string;
  price: string;
  leadLimit: number;
  creditTotal: number | null;
  historyDays: number | null;
  allowEmailExtraction: boolean;
  allowSavedLeads: boolean;
  savedLeadLimit: number | null;
  allowCsvExport: boolean;
  csvLimited: boolean;
  allowCustomQuantity: boolean;
  allowUserManagement: boolean;
};

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    label: "Free",
    price: "Free",
    leadLimit: 20,
    creditTotal: 20,
    historyDays: 30,
    allowEmailExtraction: false,
    allowSavedLeads: true,
    savedLeadLimit: 20,
    allowCsvExport: true,
    csvLimited: true,
    allowCustomQuantity: false,
    allowUserManagement: false,
  },
  starter: {
    id: "starter",
    label: "Starter",
    price: "$9.99",
    leadLimit: 100,
    creditTotal: 100,
    historyDays: 30,
    allowEmailExtraction: true,
    allowSavedLeads: true,
    savedLeadLimit: 100,
    allowCsvExport: true,
    csvLimited: false,
    allowCustomQuantity: false,
    allowUserManagement: false,
  },
  growth: {
    id: "growth",
    label: "Growth",
    price: "$19.99",
    leadLimit: 250,
    creditTotal: 250,
    historyDays: 30,
    allowEmailExtraction: true,
    allowSavedLeads: true,
    savedLeadLimit: 250,
    allowCsvExport: true,
    csvLimited: false,
    allowCustomQuantity: true,
    allowUserManagement: false,
  },
  pro: {
    id: "pro",
    label: "Pro",
    price: "$29.99",
    leadLimit: 500,
    creditTotal: 500,
    historyDays: null,
    allowEmailExtraction: true,
    allowSavedLeads: true,
    savedLeadLimit: null,
    allowCsvExport: true,
    csvLimited: false,
    allowCustomQuantity: true,
    allowUserManagement: false,
  },
  agency: {
    id: "agency",
    label: "Agency",
    price: "$49.99",
    leadLimit: 1000,
    creditTotal: 1000,
    historyDays: null,
    allowEmailExtraction: true,
    allowSavedLeads: true,
    savedLeadLimit: null,
    allowCsvExport: true,
    csvLimited: false,
    allowCustomQuantity: true,
    allowUserManagement: false,
  },
  admin: {
    id: "admin",
    label: "Admin",
    price: "Internal",
    leadLimit: 1000,
    creditTotal: null,
    historyDays: null,
    allowEmailExtraction: true,
    allowSavedLeads: true,
    savedLeadLimit: null,
    allowCsvExport: true,
    csvLimited: false,
    allowCustomQuantity: true,
    allowUserManagement: true,
  },
};

export function normalizePlan(plan?: string): PlanId {
  if (plan === "starter" || plan === "growth" || plan === "pro" || plan === "agency" || plan === "admin") {
    return plan;
  }

  return "free";
}

export function getPlanConfig(plan?: string) {
  return PLAN_CONFIGS[normalizePlan(plan)];
}

export function getInitialCreditsForPlan(plan?: string) {
  return PLAN_CONFIGS[normalizePlan(plan)].creditTotal;
}
