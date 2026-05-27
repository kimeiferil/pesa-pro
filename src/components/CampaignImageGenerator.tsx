// src/components/CampaignImageGenerator.tsx
import { useState } from 'react';
import { Download, ImageIcon, Info, RefreshCw, X } from 'lucide-react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

interface Props {
  campaign: Campaign;
  onImageGenerated: (dataUrl: string) => void;
  theme?: string;
}

// â”€â”€â”€ Theme palettes keyed by category â”€â”€â”€â”€â”€â”€â”€â”€
const THEMES: Record<string, { accent: string; accent2: string; label: string }> = {
  medical:     { accent: '#10b981', accent2: '#34d399', label: 'ðŸ¥ Medical' },
  education:   { accent: '#3b82f6', accent2: '#60a5fa', label: 'ðŸ“š Education' },
  emergency:   { accent: '#ef4444', accent2: '#f87171', label: 'ðŸš¨ Emergency' },
  community:   { accent: '#f59e0b', accent2: '#fbbf24', label: 'ðŸ¤ Community' },
  business:    { accent: '#8b5cf6', accent2: '#a78bfa', label: 'ðŸ’¼ Business' },
  family:      { accent: '#ec4899', accent2: '#f472b6', label: 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§ Family' },
  default:     { accent: '#10b981', accent2: '#34d399', label: 'ðŸ’š Campaign' },
};

function getTheme(category: string) {
  const key = category?.toLowerCase() ?? '';
  return THEMES[key] ?? THEMES.default;
}

// â”€â”€â”€ Wrap text helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
): number {
  const words = text.split(' ');
  let line = '';
  let lines = 0;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      if (lines >= maxLines - 1) {
        // truncate last line with ellipsis
        while (ctx.measureText(`${line}â€¦`).width > maxWidth && line.length > 0) {
          line = line.slice(0, -1).trimEnd();
        }
        ctx.fillText(`${line}â€¦`, x, y + lines * lineHeight);
        return lines + 1;
      }
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines++;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lines * lineHeight);
    lines++;
  }
  return lines;
}

// â”€â”€â”€ Main generator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generatePoster(campaign: Campaign): Promise<string> {
  const W = 800;
  const H = 1000;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const { accent, accent2 } = getTheme(campaign.category);

  // â”€â”€ Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#080d1a');
  bgGrad.addColorStop(1, '#0a1628');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // â”€â”€ Subtle radial glow top-left
  const glow = ctx.createRadialGradient(120, 120, 0, 120, 120, 420);
  glow.addColorStop(0, `${accent}18`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // â”€â”€ Subtle radial glow bottom-right
  const glow2 = ctx.createRadialGradient(W - 80, H - 100, 0, W - 80, H - 100, 380);
  glow2.addColorStop(0, `${accent2}12`);
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // â”€â”€ Top accent bar (gradient)
  const barGrad = ctx.createLinearGradient(0, 0, W, 0);
  barGrad.addColorStop(0, accent);
  barGrad.addColorStop(1, accent2);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, W, 5);

  // â”€â”€ Decorative circles
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.beginPath();
  ctx.arc(W - 60, 180, 200, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(60, H - 200, 160, 0, Math.PI * 2);
  ctx.fillStyle = accent2;
  ctx.fill();
  ctx.restore();

  // â”€â”€ Category badge
  const categoryLabel = (campaign.category || 'Campaign').toUpperCase();
  const badgeX = 48;
  const badgeY = 42;
  const badgePadX = 14;
  const badgePadY = 7;
  ctx.font = 'bold 11px Arial, sans-serif';
  const badgeW = ctx.measureText(categoryLabel).width + badgePadX * 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, 28, 6);
  ctx.fillStyle = `${accent}22`;
  ctx.fill();
  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = accent;
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.letterSpacing = '0.08em';
  ctx.fillText(categoryLabel, badgeX + badgePadX, badgeY + badgePadY + 9);
  ctx.letterSpacing = '0';

  // â”€â”€ Title
  const titleY = 118;
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'left';
  ctx.font = 'bold 38px Arial, sans-serif';
  const titleLines = wrapText(ctx, campaign.title, 48, titleY, W - 96, 50, 2);
  const titleBottom = titleY + titleLines * 50;

  // â”€â”€ Thin divider
  const divY = titleBottom + 20;
  const divGrad = ctx.createLinearGradient(48, 0, W - 48, 0);
  divGrad.addColorStop(0, accent);
  divGrad.addColorStop(0.4, `${accent}44`);
  divGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = divGrad as unknown as string;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(48, divY);
  ctx.lineTo(W - 48, divY);
  ctx.stroke();

  // â”€â”€ Description
  const descY = divY + 26;
  ctx.font = '15px Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  wrapText(ctx, campaign.description || '', 48, descY, W - 96, 24, 4);

  // â”€â”€ Progress section
  const progressSectionY = descY + 130;

  // Progress background card
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(48, progressSectionY, W - 96, 180, 16);
  ctx.fillStyle = '#0f1729';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  const pct = campaign.target_amount > 0
    ? Math.min((campaign.current_amount / campaign.target_amount) * 100, 100)
    : 0;
  const raised    = campaign.current_amount || 0;
  const goal      = campaign.target_amount  || 0;
  const remaining = Math.max(0, goal - raised);

  // Raised label
  ctx.fillStyle = '#64748b';
  ctx.font = '11px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('TOTAL RAISED', 72, progressSectionY + 30);

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillText(`KES ${raised.toLocaleString()}`, 72, progressSectionY + 68);

  ctx.fillStyle = '#475569';
  ctx.font = '13px Arial, sans-serif';
  ctx.fillText(`of KES ${goal.toLocaleString()} goal`, 72, progressSectionY + 90);

  // Percentage badge
  ctx.textAlign = 'right';
  ctx.fillStyle = pct >= 100 ? accent : '#f8fafc';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.fillText(`${pct.toFixed(0)}%`, W - 72, progressSectionY + 68);
  ctx.fillStyle = '#475569';
  ctx.font = '11px Arial, sans-serif';
  ctx.fillText('funded', W - 72, progressSectionY + 88);

  // Progress bar track
  const barY  = progressSectionY + 108;
  const barX  = 72;
  const barW  = W - 144;
  const barH  = 10;
  const barR  = 6;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barR);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fill();
  ctx.restore();

  // Progress bar fill
  if (pct > 0) {
    const fillW = Math.max((pct / 100) * barW, barR * 2);
    const fillGrad = ctx.createLinearGradient(barX, 0, barX + fillW, 0);
    fillGrad.addColorStop(0, accent);
    fillGrad.addColorStop(1, accent2);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, barR);
    ctx.fillStyle = fillGrad;
    ctx.fill();
    ctx.restore();
  }

  // Stats row
  const statsY = barY + 36;
  const stats = [
    { label: 'Still Needed', value: remaining > 0 ? `KES ${remaining.toLocaleString()}` : 'Goal Reached! ðŸŽ‰' },
    { label: 'Progress',     value: `${pct.toFixed(1)}%` },
  ];
  const colW = (W - 144) / stats.length;
  stats.forEach((s, i) => {
    const cx = barX + colW * i;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '10px Arial, sans-serif';
    ctx.fillText(s.label.toUpperCase(), cx, statsY);
    ctx.fillStyle = i === 0 ? '#f8fafc' : accent;
    ctx.font = 'bold 13px Arial, sans-serif';
    ctx.fillText(s.value, cx, statsY + 18);
  });

  // â”€â”€ Beneficiary / M-Pesa card
  const infoY = progressSectionY + 208;

  if (campaign.beneficiary_name || campaign.payment_details || campaign.beneficiary_contact) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(48, infoY, W - 96, 112, 16);
    const infoGrad = ctx.createLinearGradient(48, infoY, W - 48, infoY + 112);
    infoGrad.addColorStop(0, `${accent}18`);
    infoGrad.addColorStop(1, `${accent}06`);
    ctx.fillStyle = infoGrad;
    ctx.fill();
    ctx.strokeStyle = `${accent}33`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = accent;
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText('HOW TO CONTRIBUTE', 72, infoY + 26);

    if (campaign.beneficiary_name) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Arial, sans-serif';
      ctx.fillText('Beneficiary:', 72, infoY + 52);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 14px Arial, sans-serif';
      ctx.fillText(campaign.beneficiary_name, 72, infoY + 70);
    }

    const mpesa = campaign.beneficiary_contact?.trim()
      || campaign.payment_details?.split('|')[0]?.trim()
      || '';
    if (mpesa) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Arial, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('M-Pesa:', W - 72, infoY + 52);
      ctx.fillStyle = accent;
      ctx.font = 'bold 18px "Courier New", monospace';
      ctx.fillText(mpesa, W - 72, infoY + 76);
    }
  }

  // â”€â”€ Deadline badge
  if (campaign.end_date) {
    const deadlineY = infoY + 136;
    const deadlineStr = new Date(campaign.end_date).toLocaleDateString('en-KE', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '12px Arial, sans-serif';
    ctx.fillText(`ðŸ“…  Campaign ends: ${deadlineStr}`, 48, deadlineY);
  }

  // â”€â”€ Bottom CTA strip
  const ctaY = H - 78;
  const ctaGrad = ctx.createLinearGradient(0, ctaY, W, ctaY);
  ctaGrad.addColorStop(0, accent);
  ctaGrad.addColorStop(1, accent2);
  ctx.fillStyle = ctaGrad;
  ctx.fillRect(0, ctaY, W, 78);

  ctx.fillStyle = '#022c22';
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('Every contribution counts. Share & help us reach our goal.', W / 2, ctaY + 30);
  ctx.font = '12px Arial, sans-serif';
  ctx.fillStyle = 'rgba(2,44,34,0.7)';
  ctx.fillText('Generated by Pesa Pro  â€¢  pesa.pro', W / 2, ctaY + 56);

  return canvas.toDataURL('image/png');
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
};

export default function CampaignImageGenerator({ campaign, onImageGenerated }: Props) {
  const [preview, setPreview]       = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const dataUrl = await generatePoster(campaign);
      setPreview(dataUrl);
      onImageGenerated(dataUrl);
    } catch (err) {
      console.error('Poster generation failed:', err);
      alert('Failed to generate poster. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      {!preview ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <ImageIcon size={28} color={C.primary} />
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: C.text }}>
            Generate Campaign Poster
          </p>
          <p style={{ margin: '0 0 24px', fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Creates a professional shareable image with your campaign details, progress, and M-Pesa info.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              padding: '13px 32px',
              background: generating ? 'rgba(16,185,129,0.4)' : C.primary,
              color: '#022c22',
              border: 'none', borderRadius: 12,
              fontWeight: 800, fontSize: 14,
              cursor: generating ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              transition: 'opacity 0.15s',
            }}
          >
            {generating ? (
              <>
                <div style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(2,44,34,0.3)',
                  borderTopColor: '#022c22',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} />
                Generating Posterâ€¦
              </>
            ) : (
              <><ImageIcon size={16} /> Generate Poster</>
            )}
          </button>
        </div>
      ) : (
        <div style={{ animation: 'fadeIn 0.35s ease forwards' }}>
          <img
            src={preview}
            alt="Campaign poster"
            style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 12 }}
          />
          <button
            onClick={() => { setPreview(null); onImageGenerated(''); }}
            style={{
              width: '100%', padding: '9px',
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 10, color: C.muted,
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} /> Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
