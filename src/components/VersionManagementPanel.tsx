import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Check, X, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AppVersion } from '../services/updateService';

interface FormData {
  version: string;
  changelog: string;
  is_required: boolean;
  download_url?: string;
}

export const VersionManagementPanel: React.FC = () => {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    version: '',
    changelog: '',
    is_required: false,
    download_url: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch versions
  const fetchVersions = async () => {
    setIsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('app_versions')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setVersions(data as AppVersion[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch versions';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!formData.version || !formData.changelog) {
      setError('Version and changelog are required');
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        // Update existing version
        const { error: err } = await supabase
          .from('app_versions')
          .update({
            changelog: formData.changelog,
            is_required: formData.is_required,
            download_url: formData.download_url || null,
          })
          .eq('id', editingId);

        if (err) throw err;
      } else {
        // Create new version
        const { error: err } = await supabase
          .from('app_versions')
          .insert([
            {
              version: formData.version,
              changelog: formData.changelog,
              is_required: formData.is_required,
              download_url: formData.download_url || null,
            },
          ]);

        if (err) throw err;
      }

      setSuccess(true);
      setFormData({ version: '', changelog: '', is_required: false, download_url: '' });
      setEditingId(null);
      setShowForm(false);
      fetchVersions();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save version';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle edit
  const handleEdit = (version: AppVersion) => {
    setFormData({
      version: version.version,
      changelog: version.changelog,
      is_required: version.is_required,
      download_url: version.download_url || '',
    });
    setEditingId(version.id);
    setShowForm(true);
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this version?')) return;

    try {
      const { error: err } = await supabase
        .from('app_versions')
        .delete()
        .eq('id', id);

      if (err) throw err;
      fetchVersions();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete version';
      setError(message);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ version: '', changelog: '', is_required: false, download_url: '' });
    setError(null);
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', marginBottom: 20 }}>
        Version Management
      </h2>

      {/* Add Version Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 20,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
        >
          <Plus size={16} />
          Add New Version
        </button>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
              Version Number
            </label>
            <input
              type="text"
              placeholder="e.g., 1.0.1"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              disabled={!!editingId}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                opacity: editingId ? 0.6 : 1,
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
              Changelog
            </label>
            <textarea
              placeholder="Describe the changes in this version..."
              value={formData.changelog}
              onChange={(e) => setFormData({ ...formData, changelog: e.target.value })}
              rows={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>
              Download URL (optional)
            </label>
            <input
              type="url"
              placeholder="https://example.com/app.apk"
              value={formData.download_url}
              onChange={(e) => setFormData({ ...formData, download_url: e.target.value })}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                color: '#f1f5f9',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="is_required"
              checked={formData.is_required}
              onChange={(e) => setFormData({ ...formData, is_required: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="is_required" style={{ fontSize: 14, color: '#cbd5e1', cursor: 'pointer' }}>
              Mark as required update
            </label>
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                color: '#fca5a5',
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
                color: '#a7f3d0',
                fontSize: 12,
              }}
            >
              Version saved successfully!
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: isSaving ? 0.6 : 1,
                transition: 'opacity 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {isSaving ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              style={{
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                color: '#cbd5e1',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Version List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
          <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
            <Loader size={32} />
          </div>
          <p style={{ marginTop: 12 }}>Loading versions...</p>
        </div>
      ) : versions.length === 0 ? (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          <p>No versions found</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {versions.map((version) => (
            <div
              key={version.id}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
                    v{version.version}
                  </span>
                  {version.is_required && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: '#fff',
                        background: '#f59e0b',
                        padding: '2px 8px',
                        borderRadius: 4,
                        textTransform: 'uppercase',
                      }}
                    >
                      Required
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: '#64748b', margin: 0, marginBottom: 4 }}>
                  Released: {new Date(version.release_date).toLocaleDateString()}
                </p>
                <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, maxHeight: 40, overflow: 'hidden', whiteSpace: 'pre-wrap' }}>
                  {version.changelog}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                <button
                  onClick={() => handleEdit(version)}
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: 8,
                    color: '#60a5fa',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  }}
                >
                  <Edit size={14} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(version.id)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: 8,
                    color: '#f87171',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                  }}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionManagementPanel;
