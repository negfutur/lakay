import type { CreditPackage } from "../shared/credits";

function parseCreditPackages(value: string | undefined): CreditPackage[] {
  if (!value) return [];
  try {
    const raw = JSON.parse(value) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const candidate = item as Partial<CreditPackage>;
      const credits = candidate.credits;
      if (typeof candidate.id !== "string" || typeof candidate.label !== "string" || typeof candidate.stripePriceId !== "string" || typeof credits !== "number" || !Number.isFinite(credits) || credits <= 0) return [];
      return [{ id: candidate.id, label: candidate.label, stripePriceId: candidate.stripePriceId, credits }];
    });
  } catch {
    return [];
  }
}

export const creditEnforcementEnabled = process.env.LAKAY_CREDIT_ENFORCEMENT_ENABLED === "true";
export const creditPackages = parseCreditPackages(process.env.LAKAY_CREDIT_PACKAGES_JSON);

const DEFAULT_AI_CREDIT_COSTS: Record<string, number> = {
  project_plan: 10,
  builder_generate: 1,
  builder_autofix: 1,
};

function parseUsageCosts(value: string | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const raw = JSON.parse(value) as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).flatMap(([operation, cost]) => typeof cost === "number" && Number.isFinite(cost) && cost > 0 ? [[operation, cost]] : []));
  } catch {
    return {};
  }
}

export const creditUsageCosts = { ...DEFAULT_AI_CREDIT_COSTS, ...parseUsageCosts(process.env.LAKAY_CREDIT_USAGE_COSTS_JSON) };

export function getCreditPackage(packageId: string) {
  return creditPackages.find(item => item.id === packageId);
}

export function getCreditUsageCost(operation: string) {
  return creditUsageCosts[operation];
}
