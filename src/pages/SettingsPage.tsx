import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  User, Bell, Lock, Trash2,
  ChevronLeft, Check, Loader,
  Eye, EyeOff, AlertTriangle, ChevronRight,
} from 'lucide-react';

type Section = 'profile' | 'notifications' | 'password' | 'delete';

interface NotifPrefs {
  transactions: boolean;
  campaigns:    boolean;
  chama:        boolean;
  security:     boolean;
}

function Field({
  label, value, onChange, type = 'text', placeholder, disabled,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  type?: string; placeholder?: string; disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            width: '100%', padding: isPassword ? '12px 44px 12px 14px' : '12px 14px',
            background: disabled ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, color: disabled ? '#475569' : '#f1f5f9',
            fontSize: 14, outline: 'none', fontFamily: 'inherit',
            boxSizing: 'border-box', transition: 'border-color .15s',
          }}
          onFocus={e => { if (!disabled) e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'; }}
          onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)} style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0,
          }}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
    </div>
  );
}

function SaveBtn({ loading, saved, onClick, label = 'Save Changes' }: {
  loading: boolean; saved: boolean; onClick: () => void; label?: string;
}) {
  return (
    <button onClick={onClick} disabled={loading} style={{
      padding: '13px 24px', borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
      background: saved
        ? 'linear-gradient(135deg,#10b981,#059669)'
        : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
      color: '#fff', fontSize: 14, fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
      transition: 'opacity .15s', opacity: loading ? 0.6 : 1,
      width: '100%', justifyContent: 'center',
    }}>
      {loading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> :
       saved   ? <Check  size={15} /> : null}
      {loading ? 'Saving...' : saved ? 'Saved!' : label}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16, padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 18,
    }}>
      {children}
    </div>
  );
}

function Toggle({ label, sub, value, onChange }: {
  label: string; sub: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 12, color: '#475569', margin: '2px 0 0' }}>{sub}</p>
      </div>
      <button onClick={() => onChange(!value)} style={{
        width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: value ? 'linear-gradient(135deg,#10b981,#059669)' : 'rgba(255,255,255,0.1)',
        position: 'relative', transition: 'background .2s', flexShrink: 0, padding: 0,
      }}>
        <span style={{
          position: 'absolute', top: 4,
          left: value ? 24 : 4,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left .2s', display: 'block',
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
        }} />
      </button>
    </div>
  );
}

// ─── Section content ────────────────────────────────────────────────────────
function SectionContent({
  activeSection, user, profile,
  fullName, setFullName, phone, setPhone,
  profileLoading, profileSaved, profileError, saveProfile,
  notifs, setNotifs, notifLoading, notifSaved, saveNotifs,
  currentPw, setCurrentPw, newPw, setNewPw, confirmPw, setConfirmPw,
  pwLoading, pwSaved, pwError, changePassword,
  deleteConfirm, setDeleteConfirm, deleteLoading, deleteError, deleteAccount,
}: any) {
  return (
    <div style={{ padding: '16px 16px 48px', animation: 'fadeIn .2s ease' }}>

      {activeSection === 'profile' && (
        <Card>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', margin: '0 0 4px' }}>Profile Information</p>
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Update your name and phone number.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg,#10b981,#3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 800, color: '#fff',
            }}>
              {(fullName || user?.email || '?')[0].toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {fullName || user?.email?.split('@')[0]}
              </p>
              <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
            </div>
          </div>
          <Field label="Full Name"    value={fullName} onChange={setFullName} placeholder="Your full name" />
          <Field label="Phone Number" value={phone}    onChange={setPhone}    placeholder="e.g. 0712345678" />
          <Field label="Email"        value={user?.email ?? ''} disabled />
          {profileError && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{profileError}</p>}
          <SaveBtn loading={profileLoading} saved={profileSaved} onClick={saveProfile} />
        </Card>
      )}

      {activeSection === 'notifications' && (
        <Card>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', margin: '0 0 4px' }}>Notification Preferences</p>
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Choose what you want to be notified about.</p>
          </div>
          <Toggle label="Transactions"    sub="New M-Pesa transactions synced"     value={notifs.transactions} onChange={v => setNotifs((n: NotifPrefs) => ({ ...n, transactions: v }))} />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
          <Toggle label="Campaigns"       sub="New offers and campaign updates"     value={notifs.campaigns}    onChange={v => setNotifs((n: NotifPrefs) => ({ ...n, campaigns: v }))} />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
          <Toggle label="Chama"           sub="Group savings activity"              value={notifs.chama}        onChange={v => setNotifs((n: NotifPrefs) => ({ ...n, chama: v }))} />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
          <Toggle label="Security Alerts" sub="Login attempts and account changes"  value={notifs.security}     onChange={v => setNotifs((n: NotifPrefs) => ({ ...n, security: v }))} />
          <SaveBtn loading={notifLoading} saved={notifSaved} onClick={saveNotifs} />
        </Card>
      )}

      {activeSection === 'password' && (
        <Card>
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', margin: '0 0 4px' }}>Change Password</p>
            <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Use a strong password of at least 8 characters.</p>
          </div>
          <Field label="Current Password" value={currentPw} onChange={setCurrentPw} type="password" placeholder="Current password" />
          <Field label="New Password"      value={newPw}     onChange={setNewPw}     type="password" placeholder="Min 8 characters" />
          <Field label="Confirm Password"  value={confirmPw} onChange={setConfirmPw} type="password" placeholder="Repeat new password" />
          {newPw.length > 0 && (
            <div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 3, borderRadius: 2,
                    background: newPw.length >= i * 3
                      ? (newPw.length >= 12 ? '#10b981' : newPw.length >= 8 ? '#f59e0b' : '#ef4444')
                      : 'rgba(255,255,255,0.08)',
                    transition: 'background .2s',
                  }} />
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                {newPw.length < 8 ? 'Too short' : newPw.length < 12 ? 'Good' : 'Strong'}
              </p>
            </div>
          )}
          {pwError && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{pwError}</p>}
          <SaveBtn loading={pwLoading} saved={pwSaved} onClick={changePassword} label="Update Password" />
        </Card>
      )}

      {activeSection === 'delete' && (
        <Card>
          <div style={{
            display: 'flex', gap: 12, padding: '14px',
            background: 'rgba(239,68,68,0.07)', borderRadius: 12,
            border: '1px solid rgba(239,68,68,0.15)',
          }}>
            <AlertTriangle size={20} style={{ color: '#f87171', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#f87171', margin: '0 0 4px' }}>This action is irreversible</p>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
                Deleting your account will permanently remove all your transactions, Chama data, campaigns, and profile.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '.06em' }}>
              TYPE "DELETE" TO CONFIRM
            </label>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              style={{
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.05)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, color: '#f87171', fontSize: 14,
                fontFamily: 'inherit', outline: 'none',
                letterSpacing: '.1em', fontWeight: 700,
                width: '100%', boxSizing: 'border-box',
              }}
            />
          </div>
          {deleteError && <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{deleteError}</p>}
          <button onClick={deleteAccount} disabled={deleteLoading || deleteConfirm !== 'DELETE'} style={{
            padding: '13px 24px', borderRadius: 12, border: 'none',
            background: deleteConfirm === 'DELETE' ? 'linear-gradient(135deg,#ef4444,#b91c1c)' : 'rgba(239,68,68,0.15)',
            color: deleteConfirm === 'DELETE' ? '#fff' : '#f87171',
            fontSize: 14, fontWeight: 700,
            cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'inherit',
            width: '100%', justifyContent: 'center',
          }}>
            {deleteLoading ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={15} />}
            {deleteLoading ? 'Deleting...' : 'Delete My Account'}
          </button>
        </Card>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

  // On mobile: null = showing nav list, string = showing that section
  const [activeSection, setActiveSection] = useState<Section | null>(null);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone,    setPhone   ] = useState(profile?.phone     ?? '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaved,   setProfileSaved  ] = useState(false);
  const [profileError,   setProfileError  ] = useState('');

  const [notifs, setNotifs] = useState<NotifPrefs>({ transactions: true, campaigns: true, chama: true, security: true });
  const [notifSaved,   setNotifSaved  ] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);

  const [currentPw,  setCurrentPw ] = useState('');
  const [newPw,      setNewPw     ] = useState('');
  const [confirmPw,  setConfirmPw ] = useState('');
  const [pwLoading,  setPwLoading ] = useState(false);
  const [pwSaved,    setPwSaved   ] = useState(false);
  const [pwError,    setPwError   ] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError,   setDeleteError  ] = useState('');

  const saveProfile = async () => {
    if (!fullName.trim()) { setProfileError('Name cannot be empty.'); return; }
    setProfileError(''); setProfileLoading(true);
    const { error } = await supabase.from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim(), updated_at: new Date().toISOString() })
      .eq('id', user!.id);
    setProfileLoading(false);
    if (error) { setProfileError(error.message); return; }
    setProfileSaved(true); setTimeout(() => setProfileSaved(false), 2500);
  };

  const saveNotifs = async () => {
    setNotifLoading(true);
    await supabase.from('profiles').update({ notification_prefs: notifs } as any).eq('id', user!.id);
    setNotifLoading(false); setNotifSaved(true); setTimeout(() => setNotifSaved(false), 2500);
  };

  const changePassword = async () => {
    setPwError('');
    if (newPw.length < 8)   { setPwError('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) { setPwError(error.message); return; }
    setPwSaved(true); setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => setPwSaved(false), 2500);
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') { setDeleteError('Please type DELETE exactly to confirm.'); return; }
    setDeleteLoading(true);
    const { error } = await supabase.from('profiles').delete().eq('id', user!.id);
    if (error) { setDeleteError(error.message); setDeleteLoading(false); return; }
    await signOut(); navigate('/login', { replace: true });
  };

  const NAV: { id: Section; label: string; icon: React.ReactNode; sub: string; danger?: boolean }[] = [
    { id: 'profile',       label: 'Profile',        sub: 'Name, phone, email',           icon: <User   size={20} /> },
    { id: 'notifications', label: 'Notifications',  sub: 'Alerts and preferences',        icon: <Bell   size={20} /> },
    { id: 'password',      label: 'Change Password', sub: 'Update your password',         icon: <Lock   size={20} /> },
    { id: 'delete',        label: 'Delete Account', sub: 'Permanently remove account',    icon: <Trash2 size={20} />, danger: true },
  ];

  const sectionLabel = NAV.find(n => n.id === activeSection)?.label ?? '';

  const sharedProps = {
    activeSection, user, profile,
    fullName, setFullName, phone, setPhone,
    profileLoading, profileSaved, profileError, saveProfile,
    notifs, setNotifs, notifLoading, notifSaved, saveNotifs,
    currentPw, setCurrentPw, newPw, setNewPw, confirmPw, setConfirmPw,
    pwLoading, pwSaved, pwError, changePassword,
    deleteConfirm, setDeleteConfirm, deleteLoading, deleteError, deleteAccount,
  };

  const BASE = {
    minHeight: '100dvh',
    background: 'linear-gradient(160deg,#080d1a 0%,#0b1120 50%,#080d1a 100%)',
    fontFamily: "'Sora', system-ui, sans-serif",
    color: '#f1f5f9',
  };

  const TOPBAR = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(255,255,255,0.02)',
    position: 'sticky' as const, top: 0, zIndex: 10,
  };

  const BACK_BTN = {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', color: '#94a3b8', flexShrink: 0,
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap');
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        input::placeholder { color: #334155; }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── MOBILE layout: one panel at a time ── */}
      <div className="mobile-settings" style={BASE}>
        <style>{`
          /* Mobile: show nav list by default, slide to section */
          @media (max-width: 640px) {
            .desktop-settings { display: none !important; }
            .mobile-settings  { display: block !important; }
          }
          @media (min-width: 641px) {
            .mobile-settings  { display: none !important; }
            .desktop-settings { display: flex !important; }
          }
        `}</style>

        {/* Top bar */}
        <div style={TOPBAR}>
          <button style={BACK_BTN} onClick={() => activeSection ? setActiveSection(null) : navigate(-1)}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              {activeSection ? sectionLabel : 'Settings'}
            </h1>
            {!activeSection && (
              <p style={{ fontSize: 11, color: '#475569', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email}
              </p>
            )}
          </div>
        </div>

        {/* Nav list */}
        {!activeSection && (
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, animation: 'fadeIn .2s ease' }}>
            {NAV.map(({ id, label, sub, icon, danger }) => (
              <button key={id} onClick={() => setActiveSection(id)} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 14px', borderRadius: 14, border: 'none',
                background: 'rgba(255,255,255,0.03)',
                borderLeft: `3px solid ${danger ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
                cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                  background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: danger ? '#f87171' : '#10b981',
                }}>
                  {icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: danger ? '#f87171' : '#e2e8f0', margin: 0 }}>{label}</p>
                  <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>{sub}</p>
                </div>
                <ChevronRight size={16} color="#334155" style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* Section content */}
        {activeSection && (
          <div style={{ overflowY: 'auto' }}>
            <SectionContent {...sharedProps} />
          </div>
        )}
      </div>

      {/* ── DESKTOP layout: sidebar + content side by side ── */}
      <div className="desktop-settings" style={{ ...BASE, flexDirection: 'row', height: '100dvh', overflow: 'hidden' }}>
        {/* Topbar across full width — use a wrapper */}
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          <div style={TOPBAR}>
            <button style={BACK_BTN} onClick={() => navigate(-1)}><ChevronLeft size={18} /></button>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#f8fafc' }}>Settings</h1>
              <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{user?.email}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Sidebar */}
            <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)', padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
              {NAV.map(({ id, label, icon, danger }) => (
                <button key={id} onClick={() => setActiveSection(id)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 10, border: 'none',
                  background: activeSection === id ? (danger ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.1)') : 'transparent',
                  color: activeSection === id ? (danger ? '#f87171' : '#10b981') : (danger ? '#ef4444' : '#64748b'),
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  textAlign: 'left', fontFamily: 'inherit', width: '100%',
                  borderLeft: activeSection === id ? `2px solid ${danger ? '#ef4444' : '#10b981'}` : '2px solid transparent',
                  transition: 'all .15s',
                }}>
                  {icon} {label}
                </button>
              ))}
            </div>
            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {activeSection
                ? <SectionContent {...sharedProps} />
                : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#334155', fontSize: 13 }}>
                    Select a setting from the sidebar
                  </div>
                )
              }
            </div>
          </div>
        </div>
      </div>
    </>
  );
}