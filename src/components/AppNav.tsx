import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  ArrowDownToLine,
  Receipt,
  Target,
  Users,
  LogOut,
  Wallet,
  ChevronRight,
  ShieldCheck,
  Settings,
  Lock,
} from 'lucide-react';

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/dashboard',    label: 'Dashboard',    icon: LayoutDashboard, accent: '#10b981' },
  { to: '/transactions', label: 'Transactions', icon: Receipt,         accent: '#3b82f6' },
  { to: '/campaigns',    label: 'Campaigns',    icon: Target,          accent: '#f59e0b' },
  { to: '/import',       label: 'Import SMS',   icon: ArrowDownToLine, accent: '#a78bfa' },
  { to: '/chama',        label: 'Chama',        icon: Users,           accent: '#34d399' },
  { to: '/settings',     label: 'Settings',     icon: Settings,        accent: '#64748b' },
  { to: '/mfa',          label: 'Security',     icon: Lock,            accent: '#f43f5e' },
];

// ─── Token map ────────────────────────────────────────────────────────────────
const C = {
  bg:          '#080d1a',
  sidebar:     '#0a0f1e',
  border:      'rgba(255,255,255,0.06)',
  text:        '#f8fafc',
  muted:       '#475569',
  sub:         '#64748b',
  primary:     '#10b981',
  primaryGlow: 'rgba(16,185,129,0.15)',
};

// ─── Sidebar (desktop) ────────────────────────────────────────────────────────
export function Sidebar() {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();

  const isAdmin = profile?.role === 'admin';

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'PP';

  const menuItems = [...NAV_ITEMS];
  if (isAdmin) {
    menuItems.push({ to: '/admin', label: 'Admin', icon: ShieldCheck, accent: '#818cf8' });
  }

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: C.sidebar,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 40,
    }}>
      {/* Logo */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
          flexShrink: 0,
        }}>
          <Wallet size={17} color="#022c22" strokeWidth={2.5} />
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text, letterSpacing: '-0.02em' }}>
            Pesa Pro
          </p>
          <p style={{ margin: 0, fontSize: 10, color: C.muted, fontWeight: 500 }}>M-Pesa Manager</p>
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px', marginBottom: 8 }}>
          Menu
        </p>
        {menuItems.map(({ to, label, icon: Icon, accent }) => {
          const active = location.pathname === to || (to === '/dashboard' && location.pathname === '/');
          return (
            <NavLink
              key={to}
              to={to}
              style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
            >
              <motion.div
                whileHover={{ x: 2 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 10px',
                  borderRadius: 10,
                  background: active ? `${accent}18` : 'transparent',
                  border: `1px solid ${active ? `${accent}30` : 'transparent'}`,
                  transition: 'all 0.15s',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                {/* Active indicator */}
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    style={{
                      position: 'absolute',
                      left: 0, top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3, height: 18,
                      borderRadius: 99,
                      background: accent,
                      boxShadow: `0 0 8px ${accent}`,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: active ? `${accent}20` : 'rgba(255,255,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  <Icon size={15} color={active ? accent : C.sub} strokeWidth={active ? 2.5 : 2} />
                </div>
                <span style={{
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  color: active ? C.text : C.sub,
                  transition: 'all 0.15s',
                }}>
                  {label}
                </span>
                {active && (
                  <ChevronRight size={12} color={accent} style={{ marginLeft: 'auto', opacity: 0.7 }} />
                )}
              </motion.div>
            </NavLink>
          );
        })}
      </nav>

      {/* User footer */}
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.border}` }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 10px', borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${C.border}`,
          marginBottom: 6,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #10b981, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff',
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email ?? 'User'}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: C.muted }}>Active</p>
          </div>
        </div>
        <button
          onClick={() => signOut?.()}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
            color: '#f87171', fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.12)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ─── Bottom tab bar (mobile) ──────────────────────────────────────────────────
export function BottomNav() {
  const { profile } = useAuth();
  const location = useLocation();
  const isAdmin = profile?.role === 'admin';

  const menuItems = [...NAV_ITEMS];
  if (isAdmin) {
    menuItems.push({ to: '/admin', label: 'Admin', icon: ShieldCheck, accent: '#818cf8' });
  }

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 50,
      background: 'rgba(8,13,26,0.95)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${C.border}`,
      display: 'flex',
      padding: '8px 4px calc(8px + env(safe-area-inset-bottom))',
    }}>
      {menuItems.map(({ to, label, icon: Icon, accent }) => {
        const active = location.pathname === to || (to === '/dashboard' && location.pathname === '/');
        return (
          <NavLink
            key={to}
            to={to}
            style={{ flex: 1, textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 2px', position: 'relative' }}
          >
            {active && (
              <motion.div
                layoutId="bottom-active-bg"
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: 12,
                  background: `${accent}12`,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <div style={{
              width: 36, height: 28, borderRadius: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              {active && (
                <motion.div
                  layoutId="bottom-active-dot"
                  style={{
                    position: 'absolute', top: 2, right: 6,
                    width: 5, height: 5, borderRadius: '50%',
                    background: accent,
                    boxShadow: `0 0 6px ${accent}`,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon size={18} color={active ? accent : C.sub} strokeWidth={active ? 2.5 : 1.8} />
            </div>
            <span style={{
              fontSize: 9, fontWeight: active ? 700 : 500,
              color: active ? accent : C.muted,
              letterSpacing: '0.01em',
            }}>
              {label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}