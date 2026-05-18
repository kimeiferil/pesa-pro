import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUserPlan } from '../hooks/useUserPlan';
import PaymentSubmissionModal from './PaymentSubmissionModal';
import {
  User, Settings, ShieldCheck, LogOut,
  ChevronDown, Crown, Star,
} from 'lucide-react';
import { useState } from 'react';
import type { Plan } from '../config/planLimits';

const PLAN_COLOR= {
  basic:   '#64748b',
  pro:     '#3b82f6',
  premium: '#f59e0b',
};

const PLAN_EMOJI= {
  basic:   '🌱',
  pro:     '⚡',
  premium: '👑',
};

export default function UserMenu() {
  const { user, signOut, profile } = useAuth();
  const { plan } = useUserPlan(user?.id);
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [upgradeModal, setUpgradeModal] = useState<{
    open: boolean;
    plan: Exclude<Plan, 'basic'>;
  }>({ open: false, plan: 'pro' });

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    navigate('/login');
  };

  const openUpgrade = () => {
    setIsOpen(false);
    // If already premium nothing to upgrade to; if pro offer premium; else offer pro
    const target: Exclude<Plan, 'basic'> = plan === 'pro' ? 'premium' : 'pro';
    setUpgradeModal({ open: true, plan: target });
  };

  if (!user) return null;

  const displayName = profile?.full_name?.split(' ')[0] || user.email?.split('@')[0];

  return (
    <>
      <div style={{ position: 'relative' }}>
        {/* Trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, cursor: 'pointer', color: '#e2e8f0',
            fontFamily: 'inherit',
          }}
        >
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg,#3b82f6,#6366f1)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <User size={14} style={{ color: 'white' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{displayName}</span>

          {/* Plan pill */}
          <span style={{
            fontSize: 9, fontWeight: 800,
            background: `${PLAN_COLOR[plan]}22`,
            color: PLAN_COLOR[plan],
            border: `1px solid ${PLAN_COLOR[plan]}44`,
            borderRadius: 20, padding: '2px 7px', letterSpacing: '.04em',
          }}>
            {PLAN_EMOJI[plan]} {plan.toUpperCase()}
          </span>

          <ChevronDown size={14} style={{
            transition: 'transform .2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            {/* Click-away backdrop */}
            <div
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 19 }}
              onClick={() => setIsOpen(false)}
            />

            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 8,
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, overflow: 'hidden',
              minWidth: 220, zIndex: 20,
              boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
              fontFamily: 'inherit',
            }}>

              {/* User info header */}
              <div style={{
                padding: '14px 16px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', margin: '0 0 2px' }}>
                  {profile?.full_name || displayName}
                </p>
                <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{user.email}</p>
              </div>

              {/* Menu items */}
              <MenuItem
                icon={<User size={15} />}
                label="Dashboard"
                onClick={() => { navigate('/dashboard'); setIsOpen(false); }}
              />
              <MenuItem
                icon={<Settings size={15} />}
                label="Settings"
                onClick={() => { navigate('/settings'); setIsOpen(false); }}
              />
              <MenuItem
                icon={<ShieldCheck size={15} />}
                label="Security (MFA)"
                onClick={() => { navigate('/mfa'); setIsOpen(false); }}
              />

              {/* Upgrade — hidden if already premium */}
              {plan !== 'premium' && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
                  <button
                    onClick={openUpgrade}
                    style={{
                      width: '100%', padding: '11px 16px',
                      textAlign: 'left', background: 'rgba(245,158,11,0.07)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontFamily: 'inherit', transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.14)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(245,158,11,0.07)'}
                  >
                    <span style={{
                      width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                      background: 'linear-gradient(135deg,#f59e0b,#b45309)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Crown size={13} style={{ color: '#fff' }} />
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#fbbf24', margin: 0 }}>
                        {plan === 'basic' ? 'Upgrade to Pro' : 'Upgrade to Premium'}
                      </p>
                      <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>
                        {plan === 'basic' ? 'KES 299/mo' : 'KES 699/mo'}
                      </p>
                    </div>
                    <Star size={12} style={{ color: '#f59e0b' }} />
                  </button>
                </>
              )}

              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />

              {/* Logout */}
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', padding: '11px 16px',
                  textAlign: 'left', background: 'none',
                  border: 'none', color: '#f87171', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit', transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: 'rgba(239,68,68,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <LogOut size={13} style={{ color: '#f87171' }} />
                </span>
                Logout
              </button>
            </div>
          </>
        )}
      </div>

      {/* Upgrade modal */}
      {upgradeModal.open && user && (
        <PaymentSubmissionModal
          userId={user.id}
          userPhone={profile?.phone ?? ''}
          planRequested={upgradeModal.plan}
          onClose={() => setUpgradeModal({ open: false, plan: 'pro' })}
        />
      )}
    </>
  );
}

// ─── Small helper ─────────────────────────────────────────────────────────────
function MenuItem({ icon, label, onClick }: {
  icon: React.ReactNode; label: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '11px 16px',
        textAlign: 'left', background: 'none',
        border: 'none', color: '#e2e8f0', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13, fontWeight: 600,
        fontFamily: 'inherit', transition: 'background .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        background: 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </span>
      {label}
    </button>
  );
}