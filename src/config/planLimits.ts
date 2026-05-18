// src/config/planLimits.ts
// ─── Single source of truth for all plan feature limits ───────────────────────

export type Plan = 'basic' | 'pro' | 'premium';

export interface PlanLimits {
  // Chama
  maxChamas:             number;   // -1 = unlimited
  chamaMembers:          number;
  chamaLoans:            boolean;
  chamaExpenses:         boolean;
  chamaMinutes:          boolean;
  chamaPenalties:        boolean;
  chamaPDFExport:        boolean;
  chamaWhatsApp:         boolean;

  // Campaigns
  maxCampaigns:          number;
  campaignPoster:        boolean;
  campaignTableImage:    boolean;
  campaignWhatsApp:      boolean;

  // Import / Transactions
  autoSMSParsing:        boolean;  // false = manual entry only
  maxTransactionsImport: number;   // -1 = unlimited
  maxTransactionsView:   number;

  // Dashboard / Analytics
  charts:                boolean;
  aiInsights:            boolean;
  statementDownload:     boolean;
  qrCode:                boolean;
  exportExcel:           boolean;

  // Support
  prioritySupport:       boolean;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  basic: {
    maxChamas:             2,
    chamaMembers:          10,
    chamaLoans:            false,
    chamaExpenses:         false,
    chamaMinutes:          false,
    chamaPenalties:        false,
    chamaPDFExport:        false,
    chamaWhatsApp:         true,   // basic WhatsApp text only

    maxCampaigns:          1,
    campaignPoster:        false,
    campaignTableImage:    false,
    campaignWhatsApp:      true,

    autoSMSParsing:        false,
    maxTransactionsImport: 50,
    maxTransactionsView:   30,

    charts:                false,
    aiInsights:            false,
    statementDownload:     false,
    qrCode:                false,
    exportExcel:           false,

    prioritySupport:       false,
  },

  pro: {
    maxChamas:             20,
    chamaMembers:          50,
    chamaLoans:            true,
    chamaExpenses:         true,
    chamaMinutes:          true,
    chamaPenalties:        true,
    chamaPDFExport:        true,
    chamaWhatsApp:         true,

    maxCampaigns:          10,
    campaignPoster:        true,
    campaignTableImage:    true,
    campaignWhatsApp:      true,

    autoSMSParsing:        true,
    maxTransactionsImport: -1,
    maxTransactionsView:   -1,

    charts:                true,
    aiInsights:            false,
    statementDownload:     true,
    qrCode:                true,
    exportExcel:           false,

    prioritySupport:       false,
  },

  premium: {
    maxChamas:             -1,
    chamaMembers:          -1,
    chamaLoans:            true,
    chamaExpenses:         true,
    chamaMinutes:          true,
    chamaPenalties:        true,
    chamaPDFExport:        true,
    chamaWhatsApp:         true,

    maxCampaigns:          -1,
    campaignPoster:        true,
    campaignTableImage:    true,
    campaignWhatsApp:      true,

    autoSMSParsing:        true,
    maxTransactionsImport: -1,
    maxTransactionsView:   -1,

    charts:                true,
    aiInsights:            true,
    statementDownload:     true,
    qrCode:                true,
    exportExcel:           true,

    prioritySupport:       true,
  },
};

/** Returns true if the value is within the plan's numeric limit */
export function withinLimit(current: number, limit: number): boolean {
  if (limit === -1) return true;
  return current < limit;
}

/** Human-readable limit label */
export function limitLabel(limit: number): string {
  return limit === -1 ? 'Unlimited' : limit.toString();
}

/** Which plan first unlocks a feature */
export function requiredPlan(feature: keyof PlanLimits): Plan {
  if ((PLAN_LIMITS.pro[feature] as unknown) === true || (PLAN_LIMITS.pro[feature] as number) > (PLAN_LIMITS.basic[feature] as number)) return 'pro';
  if ((PLAN_LIMITS.premium[feature] as unknown) === true) return 'premium';
  return 'pro';
}