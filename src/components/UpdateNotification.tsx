import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, AlertTriangle, CheckCircle } from 'lucide-react';
import type { UpdateCheckResult } from '../services/updateService';

interface UpdateNotificationProps {
  update: UpdateCheckResult | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  isRequired?: boolean;
}

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  update,
  isOpen,
  onClose,
  onUpdate,
  isRequired = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  if (!update || !update.hasUpdate) return null;

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      onUpdate();
      if (update.downloadUrl) {
        // For web, refresh the page; for mobile, could trigger OTA update
        if (window.location.hostname === 'localhost') {
          window.location.reload();
        } else {
          window.open(update.downloadUrl, '_blank');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isRequired) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              maxWidth: '90%',
              width: 400,
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #080d1a 0%, #0b1120 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 16,
                padding: 24,
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isRequired ? (
                    <AlertTriangle
                      size={24}
                      style={{ color: '#f59e0b', flexShrink: 0 }}
                    />
                  ) : (
                    <CheckCircle
                      size={24}
                      style={{ color: '#10b981', flexShrink: 0 }}
                    />
                  )}
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#f1f5f9',
                      margin: 0,
                    }}
                  >
                    {isRequired ? 'Update Required' : 'Update Available'}
                  </h2>
                </div>
                {!isRequired && (
                  <button
                    onClick={handleClose}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Version Info */}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px 0' }}>
                      Current Version
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                      v{update.currentVersion}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px 0' }}>
                      New Version
                    </p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#10b981', margin: 0 }}>
                      v{update.latestVersion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Changelog */}
              {update.changelog && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', fontWeight: 600 }}>
                    What's New
                  </p>
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: 8,
                      padding: 12,
                      maxHeight: 120,
                      overflowY: 'auto',
                      fontSize: 13,
                      color: '#cbd5e1',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                    }}
                  >
                    {update.changelog}
                  </div>
                </div>
              )}

              {/* Date */}
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 16px 0' }}>
                Released: {new Date(update.releaseDate).toLocaleDateString()}
              </p>

              {/* Warning for required updates */}
              {isRequired && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    fontSize: 12,
                    color: '#fcd34d',
                    lineHeight: 1.5,
                  }}
                >
                  ⚠️ This is a required security update. You must update to continue using Pesa Pro.
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
                <button
                  onClick={handleUpdate}
                  disabled={isLoading}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: 12,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: isLoading ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  <Download size={16} />
                  {isLoading ? 'Updating...' : 'Update Now'}
                </button>

                {!isRequired && (
                  <button
                    onClick={handleClose}
                    style={{
                      padding: '12px 24px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 12,
                      color: '#cbd5e1',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
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
                    Remind Later
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default UpdateNotification;
