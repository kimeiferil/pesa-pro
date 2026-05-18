import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase';
import { ShieldCheck, ArrowLeft, RefreshCw, CheckCircle, Trash2, Copy } from 'lucide-react';

export default function MfaSetup() {
  const navigate = useNavigate();
  const [loading, setLoading]             = useState(true);
  const [enrolling, setEnrolling]         = useState(false);
  const [verifying, setVerifying]         = useState(false);
  const [unenrolling, setUnenrolling]     = useState(false);
  const [error, setError]                 = useState('');
  const [message, setMessage]             = useState('');
  const [isEnabled, setIsEnabled]         = useState(false);
  const [existingFactors, setExistingFactors] = useState([]);
  const [factorId, setFactorId]           = useState('');   // id from enroll response
  const [qrCode, setQrCode]               = useState('');   // otpauth:// URI
  const [secret, setSecret]               = useState('');   // base32 secret
  const [totpCode, setTotpCode]           = useState('');
  const [copied, setCopied]               = useState(false);

  // ── Load existing MFA status ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (cancelled || userErr) return;

        const { data, error: listErr } = await supabase.auth.mfa.listFactors();
        if (cancelled || listErr) return;

        // data.totp is an array of TOTP factors
        const totpFactors = data?.totp ?? [];
        setExistingFactors(totpFactors);
        setIsEnabled(totpFactors.some(f => f.status === 'verified'));
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'Unable to load MFA status.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Enroll ──────────────────────────────────────────────────────────────────
  const handleEnroll = async () => {
    setEnrolling(true);
    setError('');
    setMessage('');
    setQrCode('');
    setSecret('');
    setFactorId('');

    try {
      const { data, error: enrollErr } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Pesa Pro',
        friendlyName: 'Pesa Pro Account',
      });

      if (enrollErr) throw enrollErr;

      /*
       * Supabase JS v2 enroll response shape:
       * {
       *   id: string,            ← factor_id  (used in challenge/verify)
       *   type: 'totp',
       *   totp: {
       *     qr_code: string,     ← "data:image/svg+xml;..." OR "otpauth://..."
       *     secret:  string,     ← base32 secret for manual entry
       *     uri:     string,     ← otpauth:// URI (always present)
       *   }
       * }
       */
      const id     = data?.id;
      const totp   = data?.totp;
      const uri    = totp?.uri ?? totp?.qr_code ?? '';
      const sec    = totp?.secret ?? '';

      if (!id || !uri || !sec) {
        console.error('Enroll response:', JSON.stringify(data, null, 2));
        throw new Error('Unexpected enroll response. Check console for details.');
      }

      setFactorId(id);
      setQrCode(uri);        // always an otpauth:// URI — QRCodeSVG will render it
      setSecret(sec);
      setMessage('QR code ready — scan with Google Authenticator or Authy, then enter the 6-digit code below.');
    } catch (err) {
      console.error('Enrollment error:', err);
      setError(err?.message ?? 'Unable to start MFA enrollment. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  // ── Verify ──────────────────────────────────────────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const code = totpCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('Please enter the 6-digit code from your authenticator app.');
      return;
    }
    if (!factorId) {
      setError('Enrollment session expired. Please click "Start Enrollment" again.');
      return;
    }

    setVerifying(true);
    try {
      /*
       * Supabase JS v2 two-step verify:
       *   1. createChallenge(factorId)  → challengeId
       *   2. verify(factorId, challengeId, code)
       */
      const { data: challengeData, error: challengeErr } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      setIsEnabled(true);
      setQrCode('');
      setSecret('');
      setFactorId('');
      setTotpCode('');
      setMessage('✅ MFA enabled successfully! Redirecting…');

      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      console.error('Verification error:', err);
      setError(err?.message ?? 'Incorrect code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // ── Unenroll ────────────────────────────────────────────────────────────────
  const handleUnenroll = async (id) => {
    if (!confirm('Remove this MFA factor? You will need to set up MFA again.')) return;
    setUnenrolling(true);
    setError('');
    setMessage('');
    try {
      const { error: unenrollErr } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (unenrollErr) throw unenrollErr;

      setIsEnabled(false);
      setExistingFactors([]);
      setQrCode('');
      setSecret('');
      setFactorId('');
      setMessage('MFA factor removed. You can enroll a new one below.');
    } catch (err) {
      setError(err?.message ?? 'Failed to remove MFA factor.');
    } finally {
      setUnenrolling(false);
    }
  };

  // ── Copy secret ─────────────────────────────────────────────────────────────
  const copySecret = async () => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const verifiedFactor   = existingFactors.find(f => f.status === 'verified');
  const unverifiedFactor = existingFactors.find(f => f.status === 'unverified');
  const showEnrollBtn    = !isEnabled && !qrCode && existingFactors.length === 0 && !loading;
  const showQrPanel      = !isEnabled && qrCode;

  // Format secret into groups of 4 for readability
  const formattedSecret = secret.match(/.{1,4}/g)?.join(' ') ?? secret;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0f1e',
      color: '#f8fafc',
      fontFamily: "'DM Sans','Segoe UI',sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .mfa-input {
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1.5px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.05);
          color: #f8fafc;
          font-size: 22px;
          text-align: center;
          letter-spacing: 6px;
          font-family: 'DM Mono', monospace;
          transition: border-color 0.2s;
        }
        .mfa-input:focus { outline: none; border-color: rgba(59,130,246,0.6); }
        .mfa-input::placeholder { letter-spacing: 3px; color: #334155; font-size: 18px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.35s ease forwards; }
      `}</style>

      <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 24px' }}>

        {/* Back */}
        <button onClick={() => navigate('/dashboard')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#94a3b8', marginBottom: 28, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
          <ArrowLeft size={15} /> Back to Dashboard
        </button>

        {/* Card */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 32 }}>

          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
            <div style={{ width: 50, height: 50, borderRadius: 16, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck size={26} color="#38bdf8" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#f8fafc' }}>
                Two-Factor Authentication
              </h1>
              <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                Protect your account with a time-based authenticator app
              </p>
            </div>
          </div>

          {/* Error / Success banners */}
          {error && (
            <div className="fade-up" style={{ padding: '14px 18px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 12, marginBottom: 20, color: '#fda4af', fontSize: 14 }}>
              ⚠️ {error}
            </div>
          )}
          {message && (
            <div className="fade-up" style={{ padding: '14px 18px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, color: '#6ee7b7', fontSize: 14 }}>
              <CheckCircle size={16} /> {message}
            </div>
          )}

          {/* Status row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '16px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, marginBottom: 24 }}>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Status</p>
              <p style={{ margin: '6px 0 0', fontSize: 15, fontWeight: 700, color: isEnabled ? '#10b981' : '#f59e0b' }}>
                {loading ? 'Checking…' : isEnabled ? '🔒 MFA Enabled' : '🔓 MFA Not Enabled'}
              </p>
            </div>

            {/* Remove verified factor */}
            {verifiedFactor && (
              <button onClick={() => handleUnenroll(verifiedFactor.id)} disabled={unenrolling}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: 10, color: '#f87171', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Trash2 size={14} /> {unenrolling ? 'Removing…' : 'Remove MFA'}
              </button>
            )}

            {/* Remove stale unverified factor */}
            {unverifiedFactor && !qrCode && (
              <button onClick={() => handleUnenroll(unverifiedFactor.id)} disabled={unenrolling}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, color: '#f59e0b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                <Trash2 size={14} /> {unenrolling ? 'Removing…' : 'Clear Pending Factor'}
              </button>
            )}
          </div>

          {/* ── Already enabled ── */}
          {isEnabled && (
            <div style={{ padding: '20px 22px', background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16 }}>
              <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, color: '#6ee7b7', fontSize: 14, fontWeight: 600 }}>
                <CheckCircle size={18} />
                Your account is protected by TOTP multi-factor authentication.
              </p>
              <p style={{ margin: '10px 0 0', fontSize: 13, color: '#475569' }}>
                Every login will require a code from your authenticator app. To disable, click "Remove MFA" above.
              </p>
            </div>
          )}

          {/* ── Start enrollment button ── */}
          {showEnrollBtn && (
            <div style={{ padding: '24px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 16, textAlign: 'center' }}>
              <ShieldCheck size={40} style={{ color: '#334155', marginBottom: 14 }} />
              <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 20px' }}>
                MFA adds a second layer of security. You'll need an authenticator app like <strong style={{ color: '#94a3b8' }}>Google Authenticator</strong> or <strong style={{ color: '#94a3b8' }}>Authy</strong>.
              </p>
              <button onClick={handleEnroll} disabled={enrolling}
                style={{ padding: '13px 32px', background: enrolling ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #3b82f6, #6366f1)', color: enrolling ? '#475569' : 'white', border: 'none', borderRadius: 12, cursor: enrolling ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={16} /> {enrolling ? 'Generating…' : 'Start Enrollment'}
              </button>
            </div>
          )}

          {/* ── QR + verify panel ── */}
          {showQrPanel && (
            <div className="fade-up" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 24 }}>

              <p style={{ margin: '0 0 20px', fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Step 1 — Scan QR code
              </p>

              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 24 }}>
                {/* QR */}
                <div style={{ padding: 16, background: '#ffffff', borderRadius: 16, flexShrink: 0 }}>
                  <QRCodeSVG
                    value={qrCode}
                    size={180}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="H"
                  />
                </div>

                {/* Manual secret */}
                <div style={{ flex: 1, minWidth: 220 }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, color: '#64748b' }}>
                    Can't scan? Enter this secret manually in your app:
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                    <code style={{ flex: 1, color: '#e2e8f0', fontFamily: "'DM Mono', monospace", fontSize: 14, letterSpacing: 2, wordBreak: 'break-all' }}>
                      {formattedSecret}
                    </code>
                    <button onClick={copySecret}
                      style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, cursor: 'pointer', color: copied ? '#10b981' : '#94a3b8', fontSize: 12, fontWeight: 600 }}>
                      <Copy size={13} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>
                    Open Google Authenticator → + → Enter a setup key → paste the secret above.
                  </p>
                </div>
              </div>

              {/* Verify */}
              <p style={{ margin: '0 0 14px', fontSize: 13, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Step 2 — Enter the 6-digit code
              </p>
              <form onSubmit={handleVerify}>
                <input
                  className="mfa-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={totpCode}
                  onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  required
                  style={{ marginBottom: 14 }}
                />
                <button type="submit"
                  disabled={verifying || totpCode.length !== 6}
                  style={{ width: '100%', padding: 14, background: (verifying || totpCode.length !== 6) ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #22c55e)', color: (verifying || totpCode.length !== 6) ? '#334155' : '#0a0f1e', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: (verifying || totpCode.length !== 6) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}>
                  {verifying ? '⏳ Verifying…' : '✅ Verify & Enable MFA'}
                </button>
              </form>
            </div>
          )}

          {/* ── There's a pending unverified factor but no active QR session ── */}
          {unverifiedFactor && !qrCode && !isEnabled && (
            <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12 }}>
              <p style={{ margin: 0, fontSize: 13, color: '#f59e0b' }}>
                ⚠️ There is a pending (unverified) MFA factor on your account. Remove it above, then start a fresh enrollment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}