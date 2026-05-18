import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, LogOut } from 'lucide-react';

const C = {
  bg:      'linear-gradient(160deg, #080d1a 0%, #0b1120 50%, #080d1a 100%)',
  surface: '#0f1729',
  border:  'rgba(255,255,255,0.06)',
  text:    '#f8fafc',
  muted:   '#64748b',
  primary: '#10b981',
  primaryBg: 'rgba(16,185,129,0.10)',
  red:     '#ef4444',
};

export default function MfaChallenge() {
  const navigate = useNavigate();
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Get list of factors
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;

      const totpFactor = factors?.totp?.find((f: any) => f.status === 'verified');
      if (!totpFactor) throw new Error('No verified MFA factor found.');

      // Challenge
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });
      if (challengeErr) throw challengeErr;

      // Verify
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: code.trim(),
      });
      if (verifyErr) throw verifyErr;

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none; border-color: rgba(16,185,129,0.5) !important; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: C.primaryBg, border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <ShieldCheck size={28} color={C.primary} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>Two-Factor Auth</h1>
          <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Enter the code from your authenticator app</p>
        </div>

        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32 }}>

          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 20, fontSize: 13, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleVerify}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 10 }}>
              Authenticator Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
              style={{
                width: '100%', padding: '16px', marginBottom: 20,
                background: 'rgba(255,255,255,0.04)',
                border: `1.5px solid ${C.border}`,
                borderRadius: 12, color: C.text,
                fontSize: 28, textAlign: 'center',
                letterSpacing: 12, fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />

            <button type="submit" disabled={loading || code.length !== 6}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                background: (loading || code.length !== 6) ? 'rgba(255,255,255,0.05)' : C.primary,
                color: (loading || code.length !== 6) ? C.muted : '#022c22',
                fontWeight: 800, fontSize: 14, cursor: (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12,
              }}>
              {loading
                ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#022c22', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Verifying…</>
                : 'Verify & Sign In'}
            </button>

            <button type="button" onClick={() => supabase.auth.signOut().then(() => navigate('/login'))}
              style={{ width: '100%', padding: '11px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <LogOut size={13} /> Sign in with a different account
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: C.muted }}>
          Lost access to your authenticator? Contact support.
        </p>
      </div>
    </div>
  );
}