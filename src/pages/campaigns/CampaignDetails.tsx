// src/pages/campaigns/CampaignDetails.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Target, Share2, Download, Copy,
  CheckCircle, AlertCircle, Trash2,
  Heart, MessageCircle, TrendingUp, Users, BarChart2, Zap,
} from 'lucide-react';
import {
  getCampaign,
  getCampaignContributions,
  deleteCampaign,
} from '../../features/campaigns/campaignService';
import CampaignImageGenerator from '../../components/CampaignImageGenerator';
import { QRCodeSVG } from 'qrcode.react';

// ─── Types ───────────────────────────────────
interface Contribution {
  id: number;
  donor_name: string;
  amount: number;
  phone?: string;
  transaction_code?: string;
  created_at: string;
}

interface Campaign {
  id: number;
  title: string;
  category: string;
  description: string;
  target_amount: number;
  current_amount: number;
  beneficiary_name?: string;
  beneficiary_contact?: string;
  payment_details?: string;
  end_date?: string;
  created_at: string;
}

type Tab = 'overview' | 'contributions' | 'poster';

// ─── Tokens ──────────────────────────────────
const C = {
  bg: '#080d1a',
  surface: '#0f1729',
  surface2: '#131f35',
  border: 'rgba(255,255,255,0.06)',
  borderHi: 'rgba(255,255,255,0.12)',
  text: '#f8fafc',
  muted: '#64748b',
  sub: '#94a3b8',
  primary: '#10b981',
  blue: '#3b82f6',
  red: '#ef4444',
  amber: '#f59e0b',
};

// ─── InfoRow ─────────────────────────────────
function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ margin: '0 0 2px', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 13, color: C.sub, fontFamily: mono ? 'monospace' : 'inherit', fontWeight: mono ? 700 : 500 }}>{value}</p>
    </div>
  );
}

// ─── WhatsApp message builder ─────────────────
function buildWhatsAppMessage(campaign: Campaign, contributions: Contribution[]): string {
  const total     = campaign.current_amount || 0;
  const goal      = campaign.target_amount  || 0;
  const pct       = goal > 0 ? Math.round((total / goal) * 100) : 0;
  const remaining = Math.max(0, goal - total);

  const date = new Date().toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const sorted  = [...contributions].sort((a, b) => b.amount - a.amount);
  const display = sorted.slice(0, 20);

  // ── Helpers
  const kes  = (n: number) => `KES ${n.toLocaleString()}`;
  const padR = (s: string, n: number) =>
    s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
  const padL = (s: string, n: number) =>
    s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;

  // ── Column widths
  const RANK_W    = 2;   // medal emoji or "1."
  const NAME_W    = 18;  // contributor name
  const AMT_W     = 12;  // "KES 15,000"
  const ROW_INNER = RANK_W + 1 + NAME_W + 1 + AMT_W;
  const LINE      = '─'.repeat(ROW_INNER + 4);

  const medals: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

  // ── Border lines
  const top = `┌${LINE}┐`;
  const mid = `├${LINE}┤`;
  const bot = `└${LINE}┘`;

  // ── Header row
  const hRank    = padR('', RANK_W);
  const hName    = padR('Contributor', NAME_W);
  const hAmt     = padL('Amount', AMT_W);
  const headerRow = `│  ${hRank} ${hName} ${hAmt}  │`;

  // ── Data rows
  const rows = display.map((c, i) => {
    const rank = medals[i] ?? padR(`${i + 1}.`, RANK_W);
    const name = padR((c.donor_name || 'Anonymous').trim(), NAME_W);
    const amt  = padL(kes(c.amount), AMT_W);
    return `│  ${rank} ${name} ${amt}  │`;
  });

  // ── Total row
  const tLabel  = padR('TOTAL', NAME_W + RANK_W + 1);
  const tAmt    = padL(kes(total), AMT_W);
  const totalRow = `│  ${tLabel} ${tAmt}  │`;

  // ── Progress bar (20 steps = 5% each)
  const filled  = Math.round(pct / 5);
  const bar     = '█'.repeat(filled) + '░'.repeat(20 - filled);
  const barLine = `\`${bar} ${pct}%\``;

  // ── M-Pesa number
  const mpesa =
    campaign.beneficiary_contact?.trim() ||
    campaign.payment_details?.split('|')[0]?.trim() ||
    '';

  // ── Assemble
  const lines: string[] = [];

  lines.push(`*${campaign.title.toUpperCase()}*`);
  lines.push(`_Fundraiser Report · ${date}_`);
  lines.push('');

  if (display.length > 0) {
    lines.push('```');
    lines.push(top);
    lines.push(headerRow);
    lines.push(mid);
    lines.push(...rows);
    lines.push(mid);
    lines.push(totalRow);
    lines.push(bot);
    lines.push('```');
  } else {
    lines.push('_No contributions recorded yet._');
  }

  if (contributions.length > 20) {
    lines.push(`_+ ${contributions.length - 20} more contributors not shown_`);
  }

  lines.push('');
  lines.push('*Progress*');
  lines.push(barLine);
  lines.push('');
  lines.push(`✅ *Raised:*   ${kes(total)}`);
  lines.push(`🎯 *Goal:*     ${kes(goal)}`);
  lines.push(
    remaining > 0
      ? `🔔 *Needed:*   ${kes(remaining)}`
      : `🎊 *Goal fully reached!*`,
  );

  if (mpesa) {
    lines.push('');
    lines.push(`📱 *M-Pesa:* \`${mpesa}\``);
  }

  if (campaign.end_date) {
    const deadline = new Date(campaign.end_date).toLocaleDateString('en-KE', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    lines.push(`⏳ *Deadline:* ${deadline}`);
  }

  lines.push('');
  lines.push('_Thank you for your generosity 🙏_');
  lines.push('_Sent via Pesa Pro_');

  return lines.join('\n');
}

// ─── Canvas table image generator ────────────
async function generateTableImage(campaign: Campaign, contributions: Contribution[]): Promise<string> {
  const canvas   = document.createElement('canvas');
  const ctx      = canvas.getContext('2d')!;
  const monoFont = "'Courier New', monospace";
  const fontSize  = 14;
  const lineH     = 26;
  const pad       = 32;

  const sorted   = [...contributions].sort((a, b) => b.amount - a.amount);
  const display  = sorted.slice(0, 30);
  const maxName  = Math.min(28, Math.max(...display.map(c => c.donor_name.length), 10));

  const canvasW  = 720;
  const headerH  = 110;
  const tableH   = (display.length + 3) * lineH;
  const footerH  = 44;
  const canvasH  = pad + headerH + tableH + footerH + pad;

  canvas.width  = canvasW;
  canvas.height = canvasH;

  // ── Background
  ctx.fillStyle = '#0f1729';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // ── Top accent bar
  const grad = ctx.createLinearGradient(0, 0, canvasW, 0);
  grad.addColorStop(0, '#10b981');
  grad.addColorStop(1, '#34d399');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, 4);

  // ── Title
  ctx.textAlign  = 'center';
  ctx.fillStyle  = '#f8fafc';
  ctx.font       = 'bold 20px Arial, sans-serif';
  ctx.fillText(campaign.title.toUpperCase(), canvasW / 2, pad + 30);

  // ── Subtitle
  ctx.font      = '13px Arial, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(
    `Contribution Report  •  ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    canvasW / 2, pad + 56,
  );

  // ── Stats strip
  const statY = pad + 82;
  const stats = [
    { label: 'Contributors', value: display.length.toString() },
    { label: 'Total Raised', value: `KES ${(campaign.current_amount || 0).toLocaleString()}` },
    { label: 'Goal',         value: `KES ${campaign.target_amount.toLocaleString()}` },
  ];
  const colW = canvasW / stats.length;
  stats.forEach((s, i) => {
    const cx = colW * i + colW / 2;
    ctx.textAlign  = 'center';
    ctx.font       = 'bold 15px Arial, sans-serif';
    ctx.fillStyle  = '#10b981';
    ctx.fillText(s.value, cx, statY);
    ctx.font       = '11px Arial, sans-serif';
    ctx.fillStyle  = '#475569';
    ctx.fillText(s.label, cx, statY + 18);
  });

  // ── Separator
  let y = pad + headerH;
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(canvasW - pad, y);
  ctx.stroke();
  y += lineH;

  // ── Table header row
  const col1X = pad;
  const col2X = pad + 46;
  const col3X = canvasW - pad;

  ctx.textAlign  = 'left';
  ctx.font       = `bold ${fontSize}px ${monoFont}`;
  ctx.fillStyle  = '#10b981';
  ctx.fillText('#',             col1X, y);
  ctx.fillText('CONTRIBUTOR',  col2X, y);
  ctx.textAlign  = 'right';
  ctx.fillText('AMOUNT (KES)', col3X, y);

  y += 6;
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(canvasW - pad, y);
  ctx.stroke();
  y += lineH - 4;

  // ── Data rows
  ctx.font = `${fontSize}px ${monoFont}`;
  display.forEach((c, i) => {
    const isEven = i % 2 === 0;
    if (isEven) {
      ctx.fillStyle = 'rgba(255,255,255,0.015)';
      ctx.fillRect(pad - 8, y - lineH + 8, canvasW - pad * 2 + 16, lineH);
    }
    ctx.fillStyle  = '#f8fafc';
    ctx.textAlign  = 'left';
    ctx.fillText((i + 1).toString(), col1X, y);
    ctx.fillText((c.donor_name || 'Anonymous').slice(0, maxName), col2X, y);
    ctx.textAlign  = 'right';
    ctx.fillStyle  = '#cbd5e1';
    ctx.fillText(c.amount.toLocaleString(), col3X, y);
    y += lineH;
  });

  // ── Total row
  y += 4;
  ctx.strokeStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(pad, y - lineH + 14);
  ctx.lineTo(canvasW - pad, y - lineH + 14);
  ctx.stroke();

  ctx.font       = `bold ${fontSize + 1}px ${monoFont}`;
  ctx.fillStyle  = '#10b981';
  ctx.textAlign  = 'left';
  ctx.fillText('TOTAL', col2X, y);
  ctx.textAlign  = 'right';
  ctx.fillText((campaign.current_amount || 0).toLocaleString(), col3X, y);

  // ── Footer
  const footerY = canvasH - 18;
  ctx.textAlign  = 'center';
  ctx.font       = '11px Arial, sans-serif';
  ctx.fillStyle  = '#334155';
  ctx.fillText('Generated by Pesa Pro  •  pesa.pro', canvasW / 2, footerY);

  return canvas.toDataURL('image/png');
}

// ─────────────────────────────────────────────
export default function CampaignDetails() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [campaign, setCampaign]                   = useState<Campaign | null>(null);
  const [contributions, setContributions]         = useState<Contribution[]>([]);
  const [loading, setLoading]                     = useState(true);
  const [deleting, setDeleting]                   = useState(false);
  const [error, setError]                         = useState<string | null>(null);
  const [generatedImage, setGeneratedImage]       = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copied, setCopied]                       = useState(false);
  const [tab, setTab]                             = useState<Tab>('overview');
  const [tableImage, setTableImage]               = useState<string | null>(null);
  const [generatingTable, setGeneratingTable]     = useState(false);

  // ── Load
  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    try {
      setLoading(true);
      const [camp, contribs] = await Promise.all([
        getCampaign(parseInt(id!)),
        getCampaignContributions(parseInt(id!)),
      ]);
      setCampaign(camp as Campaign);
      setContributions(contribs as Contribution[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  };

  // ── Delete
  const handleDelete = async () => {
    try {
      setDeleting(true);
      await deleteCampaign(parseInt(id!));
      navigate('/campaigns');
    } catch (err: unknown) {
      alert('Failed to delete: ' + (err instanceof Error ? err.message : 'Unknown error'));
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // ── Share actions
  const shareOnWhatsApp = () => {
    if (!campaign) return;
    const msg = buildWhatsAppMessage(campaign, contributions);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const copyMessage = async () => {
    if (!campaign) return;
    const msg = buildWhatsAppMessage(campaign, contributions);
    await navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const downloadPosterImage = () => {
    if (!generatedImage || !campaign) return;
    const a    = document.createElement('a');
    a.download = `${campaign.title.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.href     = generatedImage;
    a.click();
  };

  // ── Table image handlers
  const handleGenerateTableImage = async () => {
    if (!campaign) return;
    setGeneratingTable(true);
    try {
      const img = await generateTableImage(campaign, contributions);
      setTableImage(img);
    } catch {
      alert('Failed to generate table image');
    } finally {
      setGeneratingTable(false);
    }
  };

  const downloadTableImage = () => {
    if (!tableImage || !campaign) return;
    const a    = document.createElement('a');
    a.download = `${campaign.title.replace(/\s+/g, '_')}_contributions.png`;
    a.href     = tableImage;
    a.click();
  };

  const shareTableImage = async () => {
    if (!tableImage || !campaign) return;
    try {
      const res  = await fetch(tableImage);
      const blob = await res.blob();
      const file = new File([blob], 'contributions.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: campaign.title, text: 'Contribution Report' });
      } else {
        downloadTableImage();
        alert('Direct sharing not supported on this device — the image has been downloaded. Share it manually on WhatsApp.');
      }
    } catch {
      alert('Failed to share image');
    }
  };

  // ── Derived
  const progress  = campaign ? Math.min((campaign.current_amount / campaign.target_amount) * 100, 100) : 0;
  const remaining = campaign ? Math.max(0, campaign.target_amount - campaign.current_amount) : 0;

  // ── Loading / error states
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ width: 36, height: 36, border: `3px solid rgba(16,185,129,0.15)`, borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.85s linear infinite' }} />
        <p style={{ color: C.muted, fontSize: 13 }}>Loading campaign…</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          <AlertCircle size={40} color={C.red} style={{ marginBottom: 16 }} />
          <h2 style={{ color: C.text, marginBottom: 8 }}>Campaign not found</h2>
          <p style={{ color: C.muted, marginBottom: 24 }}>{error}</p>
          <button onClick={() => navigate('/campaigns')} style={{ padding: '12px 24px', background: C.blue, color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 700 }}>
            Back to Campaigns
          </button>
        </div>
      </div>
    );
  }

  // ── Render
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-up  { animation: fadeUp 0.35s ease forwards; }
        .btn-ghost { background: transparent; border: 1px solid ${C.border}; color: ${C.muted}; cursor: pointer; border-radius: 9px; display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; transition: all 0.15s; }
        .btn-ghost:hover { border-color: ${C.borderHi}; color: ${C.text}; }
        .row-card { background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 14px; padding: 13px 16px; display: flex; align-items: center; gap: 12px; transition: border-color 0.15s; }
        .row-card:hover { border-color: ${C.borderHi}; }
      `}</style>

      {/* ── Delete confirm modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="fade-up" style={{ background: '#0f172a', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 22, padding: 28, maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, background: 'rgba(239,68,68,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={28} color={C.red} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Delete Campaign?</h3>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.65, marginBottom: 24 }}>
              All contribution records for <strong style={{ color: C.text }}>{campaign.title}</strong> will be permanently deleted.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost" style={{ flex: 1, padding: '11px' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '11px', background: C.red, color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(8,13,26,0.94)', backdropFilter: 'blur(18px)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate('/campaigns')} className="btn-ghost" style={{ padding: '6px 10px', flexShrink: 0 }}>
            <ArrowLeft size={15} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 14, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{campaign.title}</h1>
            <p style={{ margin: 0, fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{campaign.category}</p>
          </div>
          <button onClick={() => setShowDeleteConfirm(true)} className="btn-ghost" style={{ padding: '6px 10px', color: C.red, borderColor: 'rgba(239,68,68,0.2)', flexShrink: 0 }}>
            <Trash2 size={14} />
          </button>
        </div>

        {/* ── Tabs */}
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 16px', display: 'flex', gap: 2 }}>
          {([
            { key: 'overview'      as Tab, label: 'Overview',      icon: <BarChart2 size={13} /> },
            { key: 'contributions' as Tab, label: 'Contributions', icon: <Users     size={13} />, badge: contributions.length },
            { key: 'poster'        as Tab, label: 'Poster',        icon: <Share2    size={13} /> },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '9px 14px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? C.primary : C.muted,
                borderBottom: `2px solid ${tab === t.key ? C.primary : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
              }}
            >
              {t.icon} {t.label}
              {'badge' in t && t.badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: tab === t.key ? 'rgba(16,185,129,0.18)' : 'rgba(255,255,255,0.07)', color: tab === t.key ? C.primary : C.muted }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* ══════════════════════════════════ */}
        {/* TAB: OVERVIEW                      */}
        {/* ══════════════════════════════════ */}
        {tab === 'overview' && (
          <div className="fade-up">
            {/* Progress card */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Total Raised</p>
                  <p style={{ margin: 0, fontSize: 32, fontWeight: 900, color: C.text, letterSpacing: '-0.5px' }}>
                    KES {(campaign.current_amount || 0).toLocaleString()}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>of KES {campaign.target_amount.toLocaleString()} goal</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 900, color: progress >= 100 ? C.primary : C.text }}>
                    {progress.toFixed(0)}%
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>progress</p>
                </div>
              </div>

              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: `linear-gradient(90deg, ${C.primary}, #34d399)`, borderRadius: 10, transition: 'width 0.6s ease' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Contributors', value: contributions.length,          icon: <Users     size={14} color={C.blue}  />, small: false },
                  { label: 'Still needed', value: `KES ${remaining.toLocaleString()}`, icon: <Target    size={14} color={C.amber} />, small: true  },
                  { label: 'Avg. donation', value: contributions.length > 0 ? `KES ${Math.round((campaign.current_amount || 0) / contributions.length).toLocaleString()}` : '—', icon: <TrendingUp size={14} color={C.primary} />, small: true },
                ].map(s => (
                  <div key={s.label} style={{ background: C.surface2, borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ marginBottom: 4 }}>{s.icon}</div>
                    <p style={{ margin: 0, fontSize: s.small ? 12 : 18, fontWeight: 800, color: C.text }}>{s.value}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: C.muted }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* About */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: C.sub, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>About</h3>
              <p style={{ fontSize: 13, color: C.sub, lineHeight: 1.7, margin: '0 0 16px', whiteSpace: 'pre-wrap' }}>{campaign.description}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {campaign.beneficiary_name    && <InfoRow label="Beneficiary" value={campaign.beneficiary_name} />}
                {campaign.beneficiary_contact && <InfoRow label="M-Pesa" value={campaign.beneficiary_contact} mono />}
                {campaign.end_date            && <InfoRow label="Deadline" value={new Date(campaign.end_date).toLocaleDateString()} />}
                <InfoRow label="Created" value={new Date(campaign.created_at).toLocaleDateString()} />
              </div>
            </div>

            {/* M-Pesa / QR */}
            {campaign.payment_details && (
              <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
                <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pay via M-Pesa</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: C.text }}>
                      {campaign.payment_details.split('|')[0]?.trim()}
                    </p>
                    {campaign.payment_details.includes('|') && (
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: C.muted }}>{campaign.payment_details.split('|')[1]?.trim()}</p>
                    )}
                  </div>
                  <div style={{ background: '#fff', padding: 6, borderRadius: 10, flexShrink: 0 }}>
                    <QRCodeSVG value={campaign.payment_details} size={52} level="H" />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setTab('contributions')}
              style={{ width: '100%', padding: '14px', background: C.primary, color: '#022c22', border: 'none', borderRadius: 14, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Users size={16} /> View & Share Contributions ({contributions.length})
            </button>
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* TAB: CONTRIBUTIONS                 */}
        {/* ══════════════════════════════════ */}
        {tab === 'contributions' && (
          <div className="fade-up">
            {contributions.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Heart size={28} color={C.border} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.muted, margin: '0 0 6px' }}>No contributions yet</p>
                <p style={{ fontSize: 13, color: '#334155', margin: '0 0 24px' }}>
                  Import an M-Pesa SMS and link it to this campaign to see contributors here.
                </p>
                <button
                  onClick={() => navigate('/import')}
                  style={{ padding: '12px 24px', background: C.primary, color: '#022c22', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Zap size={15} /> Import M-Pesa SMS
                </button>
              </div>
            ) : (
              <>
                {/* ── Professional Table Image */}
                <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.09), rgba(59,130,246,0.06))', border: '1px solid rgba(16,185,129,0.22)', borderRadius: 20, padding: 18, marginBottom: 16 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    📊 Professional Table Image
                  </p>

                  {!tableImage ? (
                    <button
                      onClick={handleGenerateTableImage}
                      disabled={generatingTable}
                      style={{ width: '100%', padding: '13px', background: C.primary, color: '#022c22', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: generatingTable ? 'not-allowed' : 'pointer', opacity: generatingTable ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      {generatingTable ? (
                        <><div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#022c22', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Generating…</>
                      ) : (
                        <><Download size={16} /> Generate Table Image</>
                      )}
                    </button>
                  ) : (
                    <>
                      <img src={tableImage} alt="Contribution table" style={{ width: '100%', borderRadius: 12, marginBottom: 12, display: 'block' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <button
                          onClick={downloadTableImage}
                          style={{ padding: '13px', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                          <Download size={16} /> Download PNG
                        </button>
                        <button
                          onClick={shareTableImage}
                          style={{ padding: '13px', background: '#25D366', color: '#0a2e15', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                          <MessageCircle size={16} /> Share to WhatsApp
                        </button>
                      </div>
                      <button
                        onClick={() => setTableImage(null)}
                        style={{ marginTop: 10, width: '100%', padding: '9px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Regenerate
                      </button>
                    </>
                  )}
                </div>

                {/* ── WhatsApp Text Preview */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 18, marginBottom: 16 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    WhatsApp Text Preview
                  </p>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 12, padding: '13px 15px', fontFamily: 'monospace', fontSize: 12, color: C.sub, lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
                    {buildWhatsAppMessage(campaign, contributions)}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                    <button
                      onClick={shareOnWhatsApp}
                      style={{ padding: '13px 0', background: '#25D366', color: '#0a2e15', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                    >
                      <MessageCircle size={17} /> Share Text
                    </button>
                    <button
                      onClick={copyMessage}
                      style={{ padding: '13px 16px', border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.05)', borderRadius: 12, color: copied ? C.primary : C.sub, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 13, transition: 'color 0.2s', whiteSpace: 'nowrap' }}
                    >
                      {copied ? <><CheckCircle size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
                    </button>
                  </div>
                </div>

                {/* ── Summary strip */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Contributors</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.text }}>{contributions.length}</p>
                  </div>
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 2px', fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Total Raised</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: C.primary }}>KES {(campaign.current_amount || 0).toLocaleString()}</p>
                  </div>
                </div>

                {/* ── Contributor list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {contributions.map((c, i) => (
                    <div key={c.id} className="row-card" style={{ animation: `fadeUp 0.3s ease forwards ${i * 0.04}s`, opacity: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: `rgba(16,185,129,0.12)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: C.primary }}>
                        {c.donor_name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.donor_name}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 11, color: C.muted }}>{new Date(c.created_at).toLocaleDateString('en-KE')}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.primary }}>KES {c.amount.toLocaleString()}</p>
                        {c.transaction_code && <p style={{ margin: '2px 0 0', fontSize: 10, color: C.muted, fontFamily: 'monospace' }}>{c.transaction_code}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════ */}
        {/* TAB: POSTER                        */}
        {/* ══════════════════════════════════ */}
        {tab === 'poster' && (
          <div className="fade-up">
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 20, marginBottom: 14 }}>
              <p style={{ margin: '0 0 14px', fontSize: 10, fontWeight: 700, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Campaign Poster</p>
              <CampaignImageGenerator campaign={campaign} onImageGenerated={setGeneratedImage} theme={campaign.category as never} />
            </div>

            {generatedImage && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={downloadPosterImage} style={{ padding: '13px', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Download size={16} /> Download
                </button>
                <button
                  onClick={() => { downloadPosterImage(); setTimeout(() => alert('Saved! Share on WhatsApp Status or Social Media'), 800); }}
                  style={{ padding: '13px', background: '#25D366', color: '#0a2e15', border: 'none', borderRadius: 12, fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Share2 size={16} /> WhatsApp Status
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}