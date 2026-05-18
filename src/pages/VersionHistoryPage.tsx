import React, { useEffect, useState } from 'react';
import { ChevronLeft, Package, Calendar, Download } from 'lucide-react';
import { updateService, type AppVersion } from '../services/updateService';

interface VersionHistoryPageProps {
  onBack?: () => void;
  currentVersion?: string;
}

export const VersionHistoryPage: React.FC<VersionHistoryPageProps> = ({
  onBack,
  currentVersion = '1.0.0',
}) => {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      setIsLoading(true);
      try {
        const data = await updateService.getVersionHistory();
        setVersions(data);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080d1a 0%, #0b1120 50%, #080d1a 100%)' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.2)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = '#64748b';
            }}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          Version History
        </h1>
      </div>

      {/* Content */}
      <div style={{ padding: '16px', maxWidth: 800, margin: '0 auto' }}>
        {/* Current Version Card */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 16,
            padding: 20,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              borderRadius: '50%',
              padding: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={24} style={{ color: '#10b981' }} />
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', fontWeight: 600 }}>
              Current Version
            </p>
            <p style={{ fontSize: 20, fontWeight: 700, color: '#10b981', margin: 0 }}>
              v{currentVersion}
            </p>
          </div>
        </div>

        {/* Version List */}
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#cbd5e1', margin: '0 0 12px 0', textTransform: 'uppercase' }}>
          Previous Versions
        </h2>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <div style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>
              <Package size={32} />
            </div>
            <p style={{ marginTop: 12 }}>Loading version history...</p>
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
            <p>No version history available</p>
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
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Package size={16} style={{ color: '#64748b' }} />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748b', fontSize: 12 }}>
                    <Calendar size={14} />
                    {new Date(version.release_date).toLocaleDateString()}
                  </div>
                </div>

                {version.changelog && (
                  <p
                    style={{
                      fontSize: 12,
                      color: '#cbd5e1',
                      margin: '8px 0 12px 28px',
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      maxHeight: 80,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {version.changelog}
                  </p>
                )}

                {version.download_url && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <a
                      href={version.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12,
                        color: '#10b981',
                        textDecoration: 'none',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#059669';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#10b981';
                      }}
                    >
                      <Download size={12} />
                      Download
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VersionHistoryPage;
