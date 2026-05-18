import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, AlertCircle, Sparkles, Eye, EyeOff, Download, Share2, Palette, ChevronRight, Zap } from 'lucide-react';
import CampaignImageGenerator from '../../components/CampaignImageGenerator';
import { createCampaign } from '../../features/campaigns/campaignService';

// ─── Template definitions ────────────────────────────────────────────────────
interface CampaignTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  accent: string;
  bg: string;
  border: string;
  preview: { headerBg: string; badge: string; };
}

const TEMPLATES: CampaignTemplate[] = [
  {
    id: 'bold_green',
    name: 'Bold Green',
    description: 'Clean emerald style — great for harambee & community',
    icon: '🤝', accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.25)',
    preview: { headerBg: 'linear-gradient(135deg,#10b981,#059669)', badge: '#d1fae5' }
  },
  {
    id: 'urgent_red',
    name: 'Urgent Appeal',
    description: 'High-contrast red — drives action fast',
    icon: '🚨', accent: '#f43f5e', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.25)',
    preview: { headerBg: 'linear-gradient(135deg,#f43f5e,#dc2626)', badge: '#ffe4e6' }
  },
  {
    id: 'royal_blue',
    name: 'Royal Blue',
    description: 'Trustworthy tone for education & medical',
    icon: '💙', accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)',
    preview: { headerBg: 'linear-gradient(135deg,#3b82f6,#6366f1)', badge: '#dbeafe' }
  },
  {
    id: 'gold_celebration',
    name: 'Gold Celebration',
    description: 'Festive amber for celebrations & thanksgiving',
    icon: '🎉', accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)',
    preview: { headerBg: 'linear-gradient(135deg,#f59e0b,#d97706)', badge: '#fef3c7' }
  },
  {
    id: 'purple_faith',
    name: 'Faith & Spirit',
    description: 'Regal purple for church & religious campaigns',
    icon: '🕌', accent: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)',
    preview: { headerBg: 'linear-gradient(135deg,#a78bfa,#7c3aed)', badge: '#ede9fe' }
  },
  {
    id: 'dark_minimal',
    name: 'Dark Minimal',
    description: 'Sleek dark theme — modern and professional',
    icon: '🖤', accent: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)',
    preview: { headerBg: 'linear-gradient(135deg,#1e293b,#0f172a)', badge: '#e2e8f0' }
  },
  {
    id: 'warm_orange',
    name: 'Warm Orange',
    description: 'Energetic and warm — for youth & sports fundraising',
    icon: '🔥', accent: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)',
    preview: { headerBg: 'linear-gradient(135deg,#f97316,#ea580c)', badge: '#ffedd5' }
  },
  {
    id: 'teal_hope',
    name: 'Teal Hope',
    description: 'Calm and hopeful — ideal for medical & recovery',
    icon: '💊', accent: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.25)',
    preview: { headerBg: 'linear-gradient(135deg,#06b6d4,#0891b2)', badge: '#cffafe' }
  },
];

const CATEGORIES = [
  { value: 'religious',   label: 'Church/Harambee',  icon: '🕌' },
  { value: 'medical',     label: 'Medical',           icon: '🏥' },
  { value: 'urgent',      label: 'Urgent Appeal',     icon: '🚨' },
  { value: 'celebration', label: 'Celebration',       icon: '🎉' },
  { value: 'harambee',    label: 'Harambee',          icon: '🤝' },
  { value: 'education',   label: 'Education',         icon: '📚' },
  { value: 'funeral',     label: 'Funeral/Memorial',  icon: '🕯️' },
];

export default function CreateCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'template' | 'done'>('details');
  const [selectedTemplate, setSelectedTemplate] = useState<CampaignTemplate>(TEMPLATES[0]);
  const [formData, setFormData] = useState({
    title: '', category: 'harambee', description: '',
    target_amount: '', end_date: '', beneficiary_name: '',
    beneficiary_contact: '', payment_details: '',
    contributions_count: 0, is_urgent: false
  });
  const [loading, setLoading] = useState(false);
  const [createdCampaign, setCreatedCampaign] = useState<any>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const loadSample = () => {
    setFormData({
      title: 'MERCY WANJIKU MEDICAL FUND',
      category: 'medical',
      description: 'Mercy Wanjiku, 28, single mother of two, needs urgent heart surgery. Total cost is KES 250,000.',
      target_amount: '250000',
      end_date: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString().split('T')[0],
      beneficiary_name: 'Mercy Wanjiku',
      beneficiary_contact: '+254712345678',
      payment_details: 'Paybill: 123456 | Account: MERCY2024',
      contributions_count: 0,
      is_urgent: true
    });
    setSelectedTemplate(TEMPLATES[1]); // Urgent red
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!formData.title || !formData.description || !formData.target_amount) {
      setError('Please fill in all required fields');
      return;
    }
    setLoading(true);

    try {
      const created = await createCampaign({
        title: formData.title,
        category: formData.category,
        description: formData.description,
        target_amount: parseFloat(formData.target_amount),
        start_date: new Date().toISOString(),
        end_date: formData.end_date || undefined,
        beneficiary_name: formData.beneficiary_name || undefined,
        beneficiary_contact: formData.beneficiary_contact || undefined,
        payment_details: formData.payment_details || undefined,
      });

      setCreatedCampaign({ ...created, current_amount: 0, target_amount: parseFloat(formData.target_amount) });
      setStep('template');
    } catch (err: any) {
      setError(err?.message || 'Unable to save campaign. Please try again.');
      console.error('Create campaign failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('details'); setCreatedCampaign(null); setGeneratedImage(null);
    setFormData({ title: '', category: 'harambee', description: '', target_amount: '', end_date: '', beneficiary_name: '', beneficiary_contact: '', payment_details: '', contributions_count: 0, is_urgent: false });
  };

  // ── Step: Template picker ────────────────────────────────────────────────────
  if (step === 'template' && createdCampaign) {
    return (
      <div style={{ minHeight: '100vh', background: '#080d1a', color: '#e2e8f0', fontFamily: "'Sora','DM Sans',sans-serif" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;700&display=swap');
          * { box-sizing: border-box; }
          .tmpl-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:20px; cursor:pointer; transition:all 0.2s; padding:20px; }
          .tmpl-card:hover { transform:translateY(-3px); box-shadow:0 12px 30px rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.1); }
          .tmpl-card.selected { border: 2px solid #10b981; background: rgba(16,185,129,0.05); }
        `}</style>

        <div style={{ background: 'rgba(8,13,26,0.98)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => setStep('details')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>Poster Template</h1>
              <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Customizing Visual Style</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700 }}>
              <CheckCircle size={14} /> Campaign Live
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, marginBottom: 32 }}>
            {TEMPLATES.map(tmpl => (
              <div
                key={tmpl.id}
                className={`tmpl-card ${selectedTemplate.id === tmpl.id ? 'selected' : ''}`}
                style={{ background: selectedTemplate.id === tmpl.id ? tmpl.bg : 'rgba(255,255,255,0.02)' }}
                onClick={() => setSelectedTemplate(tmpl)}
              >
                <div style={{ height: 40, borderRadius: 10, background: tmpl.preview.headerBg, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {tmpl.icon}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>{tmpl.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: '#475569', lineHeight: 1.5 }}>{tmpl.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: 24 }}>
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ width: 40, height: 40, background: `${selectedTemplate.accent}15`, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${selectedTemplate.accent}30` }}>
                  <Palette size={20} style={{ color: selectedTemplate.accent }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>Generate Poster</h3>
                  <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>High-resolution fundraising image</p>
                </div>
              </div>
              <div style={{ borderRadius: 16, overflow: 'hidden' }}>
                <CampaignImageGenerator
                  campaign={createdCampaign}
                  onImageGenerated={setGeneratedImage}
                  theme={(createdCampaign.category as string) ?? 'harambee'}
                />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 32 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 20px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
                 <Eye size={18} style={{ color: '#3b82f6' }} /> Sharing Preview
              </h3>
              {generatedImage ? (
                <>
                  <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', marginBottom: 24 }}>
                    <img src={generatedImage} alt="Campaign poster" style={{ width: '100%', display: 'block' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      onClick={() => { const l = document.createElement('a'); l.download = `${createdCampaign.title.toLowerCase().replace(/\s+/g,'-')}.png`; l.href = generatedImage; l.click(); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#0a0f1e', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 14 }}
                    >
                      <Download size={18} /> Download Image
                    </button>
                    <button
                      onClick={() => {
                        const l = document.createElement('a'); l.download = `${createdCampaign.title.toLowerCase().replace(/\s+/g,'-')}.png`; l.href = generatedImage; l.click();
                        setTimeout(() => alert('Saved! Share on WhatsApp Status or Social Media'), 800);
                      }}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', background: '#25D366', color: '#0a0f1e', border: 'none', borderRadius: 12, cursor: 'pointer', fontWeight: 800, fontSize: 14 }}
                    >
                      <Share2 size={18} /> WhatsApp Status
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ aspectRatio: '1', background: 'rgba(255,255,255,0.01)', border: `2px dashed rgba(255,255,255,0.05)`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#1e293b' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Palette size={32} />
                  </div>
                  <p style={{ fontSize: 14, textAlign: 'center', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>Generate your poster<br />on the left to preview it</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 24 }}>
            <button onClick={() => navigate('/campaigns')} style={{ padding: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, cursor: 'pointer', color: '#94a3b8', fontWeight: 700, fontSize: 14 }}>
              View Dashboard
            </button>
            <button onClick={resetForm} style={{ padding: '14px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white', border: 'none', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: 14 }}>
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: Details form ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#080d1a', color: '#e2e8f0', fontFamily: "'Sora','DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;700&display=swap');
        * { box-sizing: border-box; }
        .field-group { margin-bottom: 24px; }
        .field-group label { display:block; font-size:11px; font-weight:800; color:#475569; text-transform:uppercase; letter-spacing:1px; margin-bottom:10px; }
        .field-group input, .field-group select, .field-group textarea {
          width:100%; padding:14px 18px; background:rgba(255,255,255,0.03); border:1.5px solid rgba(255,255,255,0.08);
          border-radius:14px; font-size:14px; color:#f1f5f9; transition:all 0.2s;
          font-family:inherit;
        }
        .field-group input:focus, .field-group select:focus, .field-group textarea:focus {
          outline:none; border-color:rgba(59,130,246,0.5); background: rgba(255,255,255,0.05);
        }
        .field-group input::placeholder, .field-group textarea::placeholder { color:#1e293b; }
        .cat-chip { display:inline-flex; align-items:center; gap:8px; padding:10px 18px; background:rgba(255,255,255,0.02); border:1.5px solid rgba(255,255,255,0.06); border-radius:12px; cursor:pointer; transition:all 0.2s; font-size:13px; font-weight:600; color:#64748b; }
        .cat-chip.selected { background:rgba(59,130,246,0.1); border-color:rgba(59,130,246,0.35); color:#60a5fa; }
        .cat-chip:hover:not(.selected) { background:rgba(255,255,255,0.05); color:#94a3b8; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'rgba(8,13,26,0.98)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={() => navigate('/campaigns')} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
              <ArrowLeft size={16} /> Back
            </button>
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>Start Campaign</h1>
              <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Step 1 of 3: Detailed Info</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={loadSample} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, cursor: 'pointer', color: '#f59e0b', fontSize: 13, fontWeight: 700 }}>
              <Sparkles size={16} /> Load Example
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'grid', gap: 24, gridTemplateColumns: showPreview && formData.title ? '1fr 400px' : '1fr' }}>

          {/* Form */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
               <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Campaign Information</h2>
               <button onClick={() => setShowPreview(!showPreview)} style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {showPreview ? 'Hide Preview' : 'Show Live Preview'}
               </button>
            </div>

            {error && (
              <div style={{ marginBottom: 24, padding: '14px 20px', background: 'rgba(244,63,94,0.05)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <AlertCircle size={18} style={{ color: '#f43f5e', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#fda4af', fontWeight: 500 }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="field-group">
                <label>What are you raising for? *</label>
                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g., MERCY WANJIKU MEDICAL FUND" />
              </div>

              <div className="field-group">
                <label>Select Category *</label>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat.value} type="button" className={`cat-chip ${formData.category === cat.value ? 'selected' : ''}`}
                      onClick={() => setFormData({...formData, category: cat.value})}>
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label>Campaign Story *</label>
                <textarea required rows={5} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Be specific and compelling. Why is this goal important? How will the funds be used?" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <label>Goal Amount (KES) *</label>
                  <input type="number" required min="100" step="1000" value={formData.target_amount} onChange={e => setFormData({...formData, target_amount: e.target.value})} placeholder="250000" />
                </div>
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <label>Deadline (Optional)</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <label>Who is the beneficiary?</label>
                  <input type="text" value={formData.beneficiary_name} onChange={e => setFormData({...formData, beneficiary_name: e.target.value})} placeholder="Full name of person or group" />
                </div>
                <div className="field-group" style={{ marginBottom: 0 }}>
                  <label>Contact Info</label>
                  <input type="text" value={formData.beneficiary_contact} onChange={e => setFormData({...formData, beneficiary_contact: e.target.value})} placeholder="+254700000000" />
                </div>
              </div>

              <div className="field-group">
                <label>M-Pesa Instructions</label>
                <textarea rows={2} value={formData.payment_details} onChange={e => setFormData({...formData, payment_details: e.target.value})} placeholder="Paybill: 123456 | Account: MERCY2024" />
                <p style={{ fontSize: 10, color: '#475569', marginTop: 8 }}>Use "|" to separate Paybill and Account for the best visual display.</p>
              </div>

              <div style={{ marginBottom: 32, padding: '16px 20px', background: formData.is_urgent ? 'rgba(244,63,94,0.05)' : 'rgba(255,255,255,0.01)', border: `1.5px solid ${formData.is_urgent ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.05)'}`, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                onClick={() => setFormData({...formData, is_urgent: !formData.is_urgent})}>
                <div style={{ width: 44, height: 24, background: formData.is_urgent ? '#f43f5e' : '#1e293b', borderRadius: 999, position: 'relative', transition: 'all 0.3s' }}>
                  <div style={{ position: 'absolute', top: 3, left: formData.is_urgent ? 23 : 3, width: 18, height: 18, background: 'white', borderRadius: '50%', transition: 'all 0.3s' }} />
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: formData.is_urgent ? '#fda4af' : '#94a3b8' }}>High Urgency</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569' }}>Highlight this campaign with an urgent badge on the poster</p>
                </div>
              </div>

              <button type="submit" disabled={loading} style={{ width: '100%', padding: '16px', background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #10b981, #059669)', color: '#0a0f1e', border: 'none', borderRadius: 16, fontWeight: 900, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 20px rgba(16,185,129,0.2)' }}>
                {loading ? (
                  <><div style={{ width: 18, height: 18, border: '3px solid rgba(0,0,0,0.1)', borderTopColor: 'black', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Processing…</>
                ) : (
                  <><Zap size={18} /> Continue to Templates</>
                )}
              </button>
            </form>
          </div>

          {/* Live Preview Panel */}
          {showPreview && formData.title && (
            <div style={{ position: 'sticky', top: 84, height: 'fit-content', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px' }}>Real-time Preview</span>
              </div>
              <div style={{ borderRadius: 16, overflow: 'hidden' }}>
                 <CampaignImageGenerator
                    campaign={{ ...formData, id: 0, created_at: new Date().toISOString(), current_amount: 0, target_amount: parseFloat(formData.target_amount) || 0 }}
                    onImageGenerated={() => {}}
                    theme={(formData.category as string) ?? 'harambee'}
                  />
              </div>
              <p style={{ fontSize: 11, color: '#475569', marginTop: 16, textAlign: 'center', fontWeight: 500 }}>Looking good! You can customize fonts and colors in the next step.</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
    </div>
  );
}
