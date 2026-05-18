import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Mail, RefreshCw, CheckCircle2, ArrowLeft, Zap } from 'lucide-react';

const C = {
  bg:      'linear-gradient(160deg, #080d1a 0%, #0b1120 50%, #080d1a 100%)',
  surface: '#0f1729',
  border:  'rgba(255,255,255,0.06)',
  text:    '#f8fafc',
  muted:   '#64748b',
  primary: '#10b981',
  primaryBg: 'rgba(16,185,129,0.10)',
  primaryGlow: 'rgba(16,185,129,0.25)',
};

export default function VerifyEmail() {
  const { user, emailVerified, resendVerification, signOut } = useAuth();
  const navigate = useNavigate();
  const [resending, setResending]   = useState(false);
  const [resent, setResent]         = useState(false);
  const [countdown, setCountdown]   = useState(0);
  const [error, setError]           = useState('');

  // If already verified, go to dashboard
  useEffect(() => {
    if (emailVerified) navigate('/dashboard', { replace: true });
  }, [emailVerified, navigate]);

  // Countdown timer for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleResend = async () => {
    if (!user?.email || countdown > 0) return;
    setResending(true);
    setError('');
    try {
      await resendVerification(user.email);
      setResent(true);
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'Failed to resend. Try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}`}</style>

      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.primary, boxShadow: `0 0 20px ${C.primaryGlow}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={17} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 18, color: C.text }}>Pesa<span style={{ color: C.primary }}>Pro</span></span>
        </div>

        {/* Card */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 36, textAlign: 'center' }}>

          {/* Animated envelope icon */}
          <div style={{ width: 72, height: 72, borderRadius: 20, background: C.primaryBg, border: `1px solid rgba(16,185,129,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', animation: 'float 3s ease-in-out infinite' }}>
            <Mail size={32} color={C.primary} />
          </div>

          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: '0 0 10px', letterSpacing: '-0.02em' }}>
            Check your inbox
          </h1>
          <p style={{ fontSize: 14, color: C.muted, margin: '0 0 6px', lineHeight: 1.6 }}>
            We sent a verification link to
          </p>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '0 0 28px', padding: '8px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, display: 'inline-block' }}>
            {user?.email ?? 'your email'}
          </p>

          <p style={{ fontSize: 13, color: C.muted, margin: '0 0 28px', lineHeight: 1.6 }}>
            Click the link in the email to verify your account. Check your spam folder if you don't see it.
          </p>

          {/* Steps */}
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: '16px 20px', marginBottom: 28, textAlign: 'left' }}>
            {[
              'Open your email app',
              'Find the email from Pesa Pro',
              'Click "Verify email address"',
              'You\'ll be signed in automatically',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: i < 3 ? 12 : 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: C.primaryBg, border: `1px solid rgba(16,185,129,0.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, fontWeight: 800, color: C.primary }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: 13, color: C.muted }}>{step}</span>
              </div>
            ))}
          </div>

          {/* Success message */}
          {resent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', marginBottom: 16, justifyContent: 'center' }}>
              <CheckCircle2 size={15} color={C.primary} />
              <span style={{ fontSize: 13, color: C.primary, fontWeight: 600 }}>New link sent! Check your inbox.</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16, fontSize: 13, color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {/* Resend button */}
          <button onClick={handleResend} disabled={resending || countdown > 0}
            style={{ width: '100%', padding: '13px', borderRadius: 12, border: `1px solid ${countdown > 0 ? C.border : 'rgba(16,185,129,0.3)'}`, background: countdown > 0 ? 'transparent' : C.primaryBg, color: countdown > 0 ? C.muted : C.primary, fontWeight: 700, fontSize: 14, cursor: countdown > 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 12, transition: 'all 0.15s' }}>
            {resending
              ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(16,185,129,0.2)', borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Sending…</>
              : countdown > 0
              ? `Resend in ${countdown}s`
              : <><RefreshCw size={14} /> Resend verification email</>
            }
          </button>

          {/* Sign out */}
          <button onClick={() => signOut()}
            style={{ width: '100%', padding: '11px', borderRadius: 12, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <ArrowLeft size={13} /> Sign in with a different account
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: C.muted }}>
          Having trouble? Contact support at <span style={{ color: C.primary }}>support@fetrotech.com</span>
        </p>
      </div>
    </div>
  );
}