// src/components/UpgradeModal.tsx
// ─── Reusable upgrade prompt — drop it anywhere in the app ───────────────────

import { X, Crown, Check, Zap, Star } from 'lucide-react';
import { PLAN_LIMITS, Plan, limitLabel } from '../config/planLimits';

// ── Plan meta (colours / copy) ────────────────────────────────────────────────
const PLAN_META: Record<Exclude<Plan, 'basic'>, {
  name: string; emoji: string; price: string;
  color: string; gradient: string;
  features: string[];
}> = {
  pro: {
    name: 'Pro', emoji: '⚡', price: 'KES 299/mo',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
    features: [
      `Up to ${limitLabel(PLAN_LIMITS.pro.maxChamas)} Chamas`,
      `Up to ${limitLabel(PLAN_LIMITS.pro.chamaMembers)} members per Chama`,
      'Chama loans, expenses & minutes',
      'PDF statements & poster generation',
      'Automatic SMS parsing (unlimited)',
      'Cash-flow charts & QR payments',
      `Up to ${limitLabel(PLAN_LIMITS.pro.maxCampaigns)} campaigns`,
    ],
  },
  premium: {
    name: 'Premium', emoji: '👑', price: 'KES 699/mo',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg,#f59e0b,#b45309)',
    features: [
      'Unlimited Chamas & members',
      'Unlimited campaigns',
      'AI spending insights',
      'Excel export & priority support',
      'All Pro features included',
      'Early access to new features',
    ],
  },
};

interface UpgradeModalProps {
  /** Why the gate fired — shown as the headline context */
  reason: string;
  /** Minimum plan needed; the modal promotes that plan and above */
  requiredPlan: Exclude<Plan, 'basic'>;
  /** Current chama / campaign count vs limit (optional, for counter display) */
  currentCount?: number;
  limitCount?: number;
  onClose: () => void;
  onUpgrade: (plan: Plan) => void;
}

export default function UpgradeModal({
  reason, requiredPlan, currentCount, limitCount, onClose, onUpgrade,
}: UpgradeModalProps) {
  const plans: Exclude<Plan, 'basic'>[] = requiredPlan === 'premium'
    ? ['premium']
    : ['pro', 'premium'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#0f1729', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24, width: '100%', maxWidth: 480,
        maxHeight: '92vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '22px 22px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg,#f59e0b22,#3b82f622)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
          }}>🔒</div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} /></button>
        </div>

        {/* Headline */}
        <div style={{ padding: '14px 22px 0' }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', margin: '0 0 6px', lineHeight: 1.3 }}>
            Upgrade to unlock this feature
          </h2>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>{reason}</p>

          {/* Counter bar (optional) */}
          {currentCount !== undefined && limitCount !== undefined && limitCount !== -1 && (
            <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: '#fca5a5' }}>Limit reached</span>
                <span style={{ color: '#ef4444' }}>{currentCount} / {limitCount}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg,#ef4444,#f87171)', borderRadius: 10 }} />
              </div>
            </div>
          )}
        </div>

        {/* Plan cards */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {plans.map(plan => {
            const meta = PLAN_META[plan];
            return (
              <div key={plan} style={{
                border: `1.5px solid ${meta.color}44`,
                background: `${meta.color}0d`,
                borderRadius: 18, padding: '18px 18px 16px',
                position: 'relative', overflow: 'hidden',
              }}>
                {plan === 'pro' && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: meta.gradient, fontSize: 9, fontWeight: 800,
                    color: '#fff', padding: '4px 12px',
                    borderRadius: '0 18px 0 10px', letterSpacing: '.06em',
                  }}>POPULAR</div>
                )}
                {plan === 'premium' && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: meta.gradient, fontSize: 9, fontWeight: 800,
                    color: '#fff', padding: '4px 12px',
                    borderRadius: '0 18px 0 10px', letterSpacing: '.06em',
                  }}>BEST VALUE</div>
                )}

                {/* Plan header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, background: meta.gradient,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>{meta.emoji}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{meta.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: meta.color, fontWeight: 700 }}>{meta.price}</p>
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
                  {meta.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#cbd5e1' }}>
                      <Check size={12} style={{ color: meta.color, flexShrink: 0 }} />{f}
                    </div>
                  ))}
                </div>

                <button onClick={() => onUpgrade(plan)} style={{
                  width: '100%', padding: '11px', background: meta.gradient,
                  color: '#fff', border: 'none', borderRadius: 12,
                  fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontFamily: 'inherit', boxShadow: `0 4px 16px ${meta.color}33`,
                }}>
                  {plan === 'pro' ? <Zap size={15} /> : <Crown size={15} />}
                  Get {meta.name}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#334155', paddingBottom: 20 }}>
          Cancel any time · Secure payment via M-Pesa
        </p>
      </div>
    </div>
  );
}