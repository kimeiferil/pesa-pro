// src/hooks/usePlanGate.ts
// ─── Drop-in hook — call gate() before any gated action ─────────────────────

import { useState, useCallback } from 'react';
import { Plan, PlanLimits, PLAN_LIMITS, withinLimit } from '../config/planLimits';

export interface GateState {
  open: boolean;
  reason: string;
  requiredPlan: Exclude<Plan, 'basic'>;
  currentCount?: number;
  limitCount?: number;
}

const CLOSED: GateState = { open: false, reason: '', requiredPlan: 'pro' };

export function usePlanGate(plan: Plan) {
  const [gate, setGate] = useState<GateState>(CLOSED);
  const limits = PLAN_LIMITS[plan];

  const closeGate = useCallback(() => setGate(CLOSED), []);

  /**
   * Call this before any gated action.
   * Returns true  → action is allowed, proceed.
   * Returns false → gate modal is now open, block the action.
   */
  const check = useCallback((
    feature: keyof PlanLimits,
    opts?: {
      /** Current count for numeric limits (e.g. number of existing Chamas) */
      currentCount?: number;
      /** Human-readable reason shown in the modal */
      reason?: string;
    }
  ): boolean => {
    const limit = limits[feature];

    // Boolean feature check
    if (typeof limit === 'boolean') {
      if (limit) return true;
      // Find the cheapest plan that enables it
      const reqPlan: Exclude<Plan, 'basic'> =
        PLAN_LIMITS.pro[feature] === true ? 'pro' : 'premium';
      setGate({
        open: true,
        reason: opts?.reason ?? `This feature is not available on your current plan.`,
        requiredPlan: reqPlan,
      });
      return false;
    }

    // Numeric limit check
    if (typeof limit === 'number') {
      const current = opts?.currentCount ?? 0;
      if (withinLimit(current, limit)) return true;
      const reqPlan: Exclude<Plan, 'basic'> =
        (PLAN_LIMITS.pro[feature] as number) > limit || PLAN_LIMITS.pro[feature] === -1
          ? 'pro'
          : 'premium';
      setGate({
        open: true,
        reason: opts?.reason ?? `You've reached the limit for your plan.`,
        requiredPlan: reqPlan,
        currentCount: current,
        limitCount: limit,
      });
      return false;
    }

    return true;
  }, [limits]);

  return { gate, check, closeGate };
}