import React, { useEffect, useState, useCallback } from 'react';
import {
  Package, Plus, Trash2, Edit3, Check, X,
  AlertTriangle, Calendar, Download, RefreshCw,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { updateService, type AppVersion, type CreateVersionPayload } from '../services/updateService';

const APP_VERSION = '1.0.0'; // Keep in sync with App.tsx

// ── helpers ────────────────────────────────────────────────────────────────
const isNewer = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) > 0;

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-KE', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

const EMPTY_FORM: CreateVersionPayload = {
  version: '',
  is_required: false,
  changelog: '',
  download_url: '',
  release_date: new Date().toISOString().split('T')[0],
};

// ── VersionForm ─────────────────────────────────────────────────────────────
interface VersionFormProps {
  initial?: Partial<CreateVersionPayload>;
  onSave: (payload: CreateVersionPayload) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

function VersionForm({ initial, onSave, onCancel, saving }: VersionFormProps) {
  const [form, setForm] = useState<CreateVersionPayload>({
    ...EMPTY_FORM,
    ...initial,
    download_url: initial?.download_url ?? '',
  });
  const [err, setErr] = useState<string | null>(null);

  const set = (k: keyof CreateVersionPayload, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.version.trim()) { setErr('Version is required'); return; }
    if (!/^\d+\.\d+\.\d+/.test(form.version.trim())) {
      setErr('Use semver format: 1.2.3'); return;
    }
    setErr(null);
    try {
      await onSave({
        ...form,
        version: form.version.trim(),
        download_url: form.download_url?.trim() || null,
      });
    } catch (e: any) {
      setErr(e.message ?? 'Save failed');
    }
  };

  return (
    <div style={S.formWrap}>
      <div style={S.formRow}>
        <label style={S.label}>Version *</label>
        <input
          style={S.input}
          placeholder="e.g. 1.0.1"
          value={form.version}
          onChange={e => set('version', e.target.value)}
        />
      </div>

      <div style={S.formRow}>
        <label style={S.label}>Release Date *</label>
        <input
          type="date"
          style={S.input}
          value={form.release_date.split('T')[0]}
          onChange={e => set('release_date', e.target.value)}
        />
      </div>

      <div style={S.formRow}>
        <label style={S.label}>Changelog</label>
        <textarea
          style={{ ...S.input, minHeight: 100, resize: 'vertical' }}
          placeholder="• What changed in this version"
          value={form.changelog}
          onChange={e => set('changelog', e.target.value)}
        />
      </div>

      <div style={S.formRow}>
        <label style={S.label}>Download URL</label>
        <input
          style={S.input}
          placeholder="https://... (APK or Play Store link)"
          value={form.download_url ?? ''}
          onChange={e => set('download_url', e.target.value)}
        />
      </div>

      <div style={{ ...S.formRow, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          id="is_required"
          checked={form.is_required}
          onChange={e => set('is_required', e.target.checked)}
          style={{ width: 16, height: 16, accentColor: '#ef4444' }}
        />
        <label htmlFor="is_required" style={{ ...S.label, color: '#ef4444', margin: 0, cursor: 'pointer' }}>
          Force update (users must update before continuing)
        </label>
      </div>

      {err && (
        <div style={S.errBanner}>
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button style={S.btnPrimary} onClick={submit} disabled={saving}>
          {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
          {saving ? 'Saving…' : 'Save Version'}
        </button>
        <button style={S.btnGhost} onClick={onCancel} disabled={saving}>
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ── VersionRow ───────────────────────────────────────────────────────────────
interface VersionRowProps {
  version: AppVersion;
  isCurrent: boolean;
  isLatest: boolean;
  onEdit: (v: AppVersion) => void;
  onDelete: (id: string) => void;
}

function VersionRow({ version: v, isCurrent, isLatest, onEdit, onDelete }: VersionRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div style={{
      ...S.versionCard,
      borderColor: isLatest
        ? 'rgba(16,185,129,0.4)'
        : isCurrent
        ? 'rgba(59,130,246,0.3)'
        : 'rgba(255,255,255,0.08)',
      background: isLatest
        ? 'rgba(16,185,129,0.06)'
        : 'rgba(255,255,255,0.03)',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ ...S.versionIcon, background: isLatest ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)' }}>
          <Package size={16} style={{ color: isLatest ? '#10b981' : '#64748b' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
              v{v.version}
            </span>
            {isLatest && (
              <span style={S.badge('#10b981')}>LATEST</span>
            )}
            {isCurrent && (
              <span style={S.badge('#3b82f6')}>RUNNING</span>
            )}
            {v.is_required && (
              <span style={S.badge('#ef4444')}>REQUIRED</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Calendar size={11} style={{ color: '#64748b' }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{fmt(v.release_date)}</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          {v.download_url && (
            <a
              href={v.download_url}
              target="_blank"
              rel="noopener noreferrer"
              style={S.iconBtn}
              title="Open download URL"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button style={S.iconBtn} onClick={() => onEdit(v)} title="Edit">
            <Edit3 size={14} />
          </button>
          {!confirmDelete ? (
            <button style={{ ...S.iconBtn, color: '#f87171' }} onClick={() => setConfirmDelete(true)} title="Delete">
              <Trash2 size={14} />
            </button>
          ) : (
            <>
              <button
                style={{ ...S.iconBtn, color: '#ef4444', background: 'rgba(239,68,68,0.15)' }}
                onClick={() => onDelete(v.id)}
                title="Confirm delete"
              >
                <Check size={14} />
              </button>
              <button style={S.iconBtn} onClick={() => setConfirmDelete(false)} title="Cancel">
                <X size={14} />
              </button>
            </>
          )}
          <button
            style={S.iconBtn}
            onClick={() => setExpanded(e => !e)}
            title="Toggle changelog"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Changelog */}
      {expanded && v.changelog && (
        <pre style={S.changelog}>{v.changelog}</pre>
      )}
      {expanded && !v.changelog && (
        <p style={{ fontSize: 12, color: '#475569', marginTop: 10, fontStyle: 'italic' }}>
          No changelog provided.
        </p>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function VersionManagementPanel() {
  const [versions,     setVersions    ] = useState<AppVersion[]>([]);
  const [loading,      setLoading     ] = useState(true);
  const [saving,       setSaving      ] = useState(false);
  const [error,        setError       ] = useState<string | null>(null);
  const [showForm,     setShowForm    ] = useState(false);
  const [editTarget,   setEditTarget  ] = useState<AppVersion | null>(null);

  const latest = versions[0] ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await updateService.getVersionHistory();
      setVersions(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (payload: CreateVersionPayload) => {
    setSaving(true);
    try {
      await updateService.createVersion(payload);
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (payload: CreateVersionPayload) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await updateService.updateVersion(editTarget.id, payload);
      setEditTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await updateService.deleteVersion(id);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Delete failed');
    }
  };

  return (
    <div style={S.panel}>
      {/* Header */}
      <div style={S.panelHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={S.panelIcon}>
            <Package size={20} style={{ color: '#10b981' }} />
          </div>
          <div>
            <h2 style={S.panelTitle}>Version Management</h2>
            <p style={S.panelSub}>
              Running <strong style={{ color: '#f1f5f9' }}>v{APP_VERSION}</strong>
              {latest && isNewer(latest.version, APP_VERSION) && (
                <span style={{ color: '#f59e0b', marginLeft: 8 }}>
                  ↑ v{latest.version} available
                </span>
              )}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btnGhost} onClick={load} disabled={loading} title="Refresh">
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Refresh
          </button>
          <button
            style={S.btnPrimary}
            onClick={() => { setShowForm(true); setEditTarget(null); }}
            disabled={showForm}
          >
            <Plus size={14} /> New Version
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={S.errBanner}>
          <AlertTriangle size={14} /> {error}
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
            onClick={() => setError(null)}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Create Form */}
      {showForm && !editTarget && (
        <div style={S.formSection}>
          <p style={S.formSectionLabel}>New Release</p>
          <VersionForm
            onSave={handleCreate}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Edit Form */}
      {editTarget && (
        <div style={S.formSection}>
          <p style={S.formSectionLabel}>Edit v{editTarget.version}</p>
          <VersionForm
            initial={{
              version:      editTarget.version,
              is_required:  editTarget.is_required,
              changelog:    editTarget.changelog,
              download_url: editTarget.download_url ?? '',
              release_date: editTarget.release_date.split('T')[0],
            }}
            onSave={handleUpdate}
            onCancel={() => setEditTarget(null)}
            saving={saving}
          />
        </div>
      )}

      {/* Version List */}
      {loading ? (
        <div style={S.emptyState}>
          <RefreshCw size={28} style={{ color: '#10b981', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: 12, color: '#64748b' }}>Loading versions…</p>
        </div>
      ) : versions.length === 0 ? (
        <div style={S.emptyState}>
          <Package size={36} style={{ color: '#334155' }} />
          <p style={{ marginTop: 12, color: '#64748b' }}>No versions yet. Create your first one above.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {versions.map((v, i) => (
            <VersionRow
              key={v.id}
              version={v}
              isCurrent={v.version === APP_VERSION}
              isLatest={i === 0}
              onEdit={(ver) => { setEditTarget(ver); setShowForm(false); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  panel: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 24,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap' as const,
  },
  panelIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    background: 'rgba(16,185,129,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: { fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  panelSub:   { fontSize: 12, color: '#64748b', marginTop: 2 },

  formSection: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 16,
  },
  formSectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginBottom: 12,
  },
  formWrap: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  formRow:  { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  label:    { fontSize: 12, fontWeight: 600, color: '#94a3b8' },
  input: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#f1f5f9',
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,

  versionCard: {
    border: '1px solid',
    borderRadius: 14,
    padding: '14px 16px',
    transition: 'border-color 0.2s',
  },
  versionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badge: (color: string) => ({
    fontSize: 9,
    fontWeight: 800,
    color: '#fff',
    background: color,
    padding: '2px 7px',
    borderRadius: 4,
    letterSpacing: '0.04em',
  }),
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#94a3b8',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    textDecoration: 'none',
  } as React.CSSProperties,
  changelog: {
    marginTop: 12,
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    fontSize: 12,
    color: '#cbd5e1',
    whiteSpace: 'pre-wrap' as const,
    fontFamily: 'monospace',
    lineHeight: 1.6,
    border: '1px solid rgba(255,255,255,0.06)',
  },

  btnPrimary: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    background: 'linear-gradient(135deg,#10b981,#059669)',
    border: 'none',
    borderRadius: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  btnGhost: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,

  errBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#f87171',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
};
