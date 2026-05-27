import { useState } from 'react';
import { useAuth        } from '../context/AuthContext';
import { usePlanGate    } from '../hooks/usePlanGate';
import { useUserPlan    } from '../hooks/useUserPlan';
import { PLAN_LIMITS    } from '../config/planLimits';

const C = {
  bg: '#060c18', surface: '#0d1526', border: 'rgba(255,255,255,0.07)',
  text: '#f1f5f9', muted: '#64748b', green: '#10b981', amber: '#f59e0b', purple: '#a855f7',
} as const;

function LockedCard({
  title, description, tier, onUnlock,
}: { title: string; description: string; tier: 'pro' | 'premium'; onUnlock: () => void }) {
  const color = tier === 'premium' ? C.purple : C.green;
  return (
    <div
      onClick={onUnlock}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 24, cursor: 'pointer', position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 140,
        transition: 'border-color .2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = color + '60'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
    >
      {/* blurred fake bars */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 56, filter: 'blur(3px)', opacity: 0.3 }}>
        {[40, 65, 55, 80, 45, 90, 60].map((h, i) => (
          <div key={i} style={{ flex: 1, height: `${h}%`, background: color, borderRadius: '3px 3px 0 0' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12, color: C.muted }}>{description}</p>
      </div>
      <span style={{
        position: 'absolute', top: 12, right: 12,
        fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
        background: `${color}20`, color,
      }}>
        {tier.toUpperCase()}
      </span>
    </div>
  );
}

export default function BudgetsPage() {
  const { user } = useAuth();
  const { plan }                   = useUserPlan(user?.id);
  const { gate, check, closeGate } = usePlanGate(plan);
  const limits                     = PLAN_LIMITS[plan];

  const canViewCharts   = limits.charts;
  const canViewInsights = limits.aiInsights;

  return (
    <div style={{
      minHeight: '100vh', background: C.bg, color: C.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '24px 16px',
    }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.02em' }}>Budgets</h1>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: C.muted }}>
        Track spending limits and get insights — plan: <strong style={{ color: C.green, textTransform: 'capitalize' }}>{plan}</strong>
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Charts */}
        {canViewCharts ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Spending by Category
            </p>
            <p style={{ color: C.muted, fontSize: 13 }}>Connect your transactions to see budget charts here.</p>
          </div>
        ) : (
          <LockedCard
            title="Budget Charts"
            description="Visual breakdown of spending by category, month-over-month trends, and budget vs. actual."
            tier="pro"
            onUnlock={() => check('charts', { reason: 'Budget charts are available on the Pro plan.' })}
          />
        )}

        {/* AI Insights */}
        {canViewInsights ? (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
            <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              ✨ AI Insights
            </p>
            <p style={{ color: C.muted, fontSize: 13 }}>AI-powered budget recommendations will appear here once you have transactions.</p>
          </div>
        ) : (
          <LockedCard
            title="AI Budget Insights"
            description="Personalised savings tips, anomaly detection, and spending forecasts powered by AI."
            tier="premium"
            onUnlock={() => check('aiInsights', { reason: 'AI budget insights are available on the Premium plan.' })}
          />
        )}
      </div>

      {/* Plan gate modal */}
      {gate.open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
          onClick={closeGate}
        >
          <div
            style={{
              background: C.surface, border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 20, padding: 28, maxWidth: 380, width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: C.text }}>
              {gate.requiredPlan === 'premium' ? '✨ Premium Feature' : '⚡ Pro Feature'}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
              {gate.reason}
            </p>
            <button
              onClick={closeGate}
              style={{
                width: '100%', padding: '12px', borderRadius: 11, border: 'none',
                background: gate.requiredPlan === 'premium' ? C.purple : C.green,
                color: gate.requiredPlan === 'premium' ? '#fff' : '#022c22',
                fontWeight: 800, fontSize: 14, cursor: 'pointer',
              }}
            >
              Upgrade to {gate.requiredPlan === 'premium' ? 'Premium' : 'Pro'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
