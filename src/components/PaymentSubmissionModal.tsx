import { useState } from 'react';
import { X, CheckCircle, MessageCircle, Send, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Plan } from '../config/planLimits';

const PLAN_PRICES: Record<Exclude<Plan, 'basic'>, number> = {
  pro: 299,
  premium: 699,
};

const PAYBILL        = '522533';
const ACCOUNT_NUMBER = '8066214';
const WHATSAPP       = '254115942586'; // 254 format for wa.me

interface Props {
  userId: string;
  userPhone: string;
  planRequested: Exclude<Plan, 'basic'>;
  onClose: () => void;
}

type Step = 'instructions' | 'form' | 'submitted';

export default function PaymentSubmissionModal({
  userId, userPhone, planRequested, onClose,
}: Props) {
  const [step, setStep]       = useState<Step>('instructions');
  const [code, setCode]       = useState('');
  const [phone, setPhone]     = useState(userPhone ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const amount   = PLAN_PRICES[planRequested];
  const planName = planRequested === 'pro' ? 'Pro' : 'Premium';

  const whatsappMessage = encodeURIComponent(
    `Hi, I've paid KES ${amount} for PesaPro ${planName}.\n` +
    `M-Pesa Code: ${code || 'XXXXXXXXXX'}\n` +
    `Phone: ${phone}\n` +
    `User ID: ${userId}`
  );
  const whatsappUrl = `https://wa.me/${WHATSAPP}?text=${whatsappMessage}`;

  const handleSubmit = async () => {
    if (!code.trim() || code.length < 8) {
      setError('Please enter a valid M-Pesa confirmation code.');
      return;
    }
    if (!phone.trim()) {
      setError('Please enter the phone number you paid from.');
      return;
    }
    setError('');
    setLoading(true);

    const { error: dbError } = await supabase
      .from('payment_submissions')
      .insert({
        user_id:        userId,
        phone:          phone.trim(),
        mpesa_code:     code.trim().toUpperCase(),
        plan_requested: planRequested,
        amount,
        status:         'pending',
      });

    setLoading(false);
    if (dbError) {
      setError('Something went wrong. Please use the WhatsApp option below.');
      return;
    }
    setStep('submitted');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: '#0f1729', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24, width: '100%', maxWidth: 420,
        maxHeight: '92vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '20px 20px 0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', margin: 0 }}>
            {step === 'submitted' ? 'Submission Received 🎉' : `Upgrade to ${planName}`}
          </h2>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><X size={16} /></button>
        </div>

        <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Step 1: Payment instructions ── */}
          {step === 'instructions' && (
            <>
              <div style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.2)',
                borderRadius: 14, padding: '14px 16px',
              }}>
                <p style={{
                  fontSize: 12, color: '#86efac', fontWeight: 700,
                  marginBottom: 10, letterSpacing: '.04em',
                }}>
                  SEND PAYMENT VIA M-PESA PAYBILL
                </p>
                {[
                  ['Paybill Number', PAYBILL],
                  ['Account Number', ACCOUNT_NUMBER],
                  ['Amount',         `KES ${amount}`],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 13, marginBottom: 8,
                    paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <span style={{
                      color: '#f8fafc', fontWeight: 800,
                      letterSpacing: label === 'Amount' ? 'normal' : '.04em',
                    }}>{value}</span>
                  </div>
                ))}
                {/* Step-by-step M-Pesa guide */}
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 6, lineHeight: 1.7 }}>
                  M-Pesa → Lipa na M-Pesa → Pay Bill → Enter Paybill &amp; Account above
                </p>
              </div>

              <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', margin: 0 }}>
                Once paid, tap below to submit your confirmation code for verification.
              </p>

              <button onClick={() => setStep('form')} style={{
                width: '100%', padding: '13px',
                background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontWeight: 800, fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'inherit',
              }}>
                <Send size={15} /> I've Paid — Submit Code
              </button>
            </>
          )}

          {/* ── Step 2: Submission form ── */}
          {step === 'form' && (
            <>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                Enter the M-Pesa confirmation code from your SMS (e.g.{' '}
                <strong style={{ color: '#f8fafc' }}>QBC4X12PO8</strong>).
              </p>

              {[
                {
                  label:       'M-Pesa Confirmation Code',
                  value:       code,
                  setter:      setCode,
                  placeholder: 'e.g. QBC4X12PO8',
                  upper:       true,
                },
                {
                  label:       'Phone Number You Paid From',
                  value:       phone,
                  setter:      setPhone,
                  placeholder: 'e.g. 0712345678',
                  upper:       false,
                },
              ].map(({ label, value, setter, placeholder, upper }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{
                    fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: '.04em',
                  }}>
                    {label.toUpperCase()}
                  </label>
                  <input
                    value={value}
                    onChange={e => setter(upper ? e.target.value.toUpperCase() : e.target.value)}
                    placeholder={placeholder}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10, padding: '12px 14px',
                      color: '#f8fafc', fontSize: 14, outline: 'none',
                      fontFamily: 'inherit',
                      letterSpacing: upper ? '.08em' : 'normal',
                    }}
                  />
                </div>
              ))}

              {error && (
                <p style={{ fontSize: 12, color: '#f87171', margin: 0 }}>{error}</p>
              )}

              <button onClick={handleSubmit} disabled={loading} style={{
                width: '100%', padding: '13px',
                background: loading
                  ? 'rgba(59,130,246,0.4)'
                  : 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontWeight: 800, fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: 'inherit',
              }}>
                {loading
                  ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Send size={15} />}
                {loading ? 'Submitting...' : 'Submit for Verification'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: '#475569', marginBottom: 8 }}>
                  Having trouble? Send proof via WhatsApp instead.
                </p>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 13, fontWeight: 700, color: '#4ade80', textDecoration: 'none',
                }}>
                  <MessageCircle size={14} /> Send on WhatsApp
                </a>
              </div>
            </>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'submitted' && (
            <>
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <CheckCircle size={48} style={{ color: '#4ade80', margin: '0 auto 12px', display: 'block' }} />
                <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7 }}>
                  Your payment code has been submitted. We'll verify and activate your{' '}
                  <strong style={{ color: '#f8fafc' }}>{planName}</strong> plan — usually within a few hours.
                </p>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 12,
                padding: '12px 14px', fontSize: 12, color: '#64748b', lineHeight: 1.7,
              }}>
                💡 Your plan will update automatically in the app once approved — no need to log out or refresh.
              </div>

              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px', borderRadius: 12,
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.2)',
                color: '#4ade80', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}>
                <MessageCircle size={15} /> Also notify us on WhatsApp (faster)
              </a>

              <button onClick={onClose} style={{
                width: '100%', padding: '12px',
                background: 'rgba(255,255,255,0.06)',
                color: '#94a3b8', border: 'none', borderRadius: 12,
                fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}