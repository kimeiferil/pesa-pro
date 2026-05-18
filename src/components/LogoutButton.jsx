import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export default function LogoutButton({ variant = 'default' }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  if (variant === 'icon') {
    return (
      <>
        <button
          onClick={() => setShowConfirm(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '8px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10,
            cursor: 'pointer',
            color: '#f87171',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
          }}
          title="Logout"
        >
          <LogOut size={18} />
        </button>

        {showConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{
              background: '#1e293b',
              borderRadius: 20,
              padding: 28,
              maxWidth: 400,
              width: '90%',
              textAlign: 'center',
              border: '1px solid rgba(239,68,68,0.3)'
            }}>
              <div style={{
                width: 56,
                height: 56,
                background: 'rgba(239,68,68,0.15)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <AlertCircle size={28} style={{ color: '#f87171' }} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>Confirm Logout</h3>
              <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>Are you sure you want to sign out?</p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setShowConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    color: '#94a3b8',
                    fontWeight: 600
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    border: 'none',
                    borderRadius: 10,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    color: 'white',
                    fontWeight: 600,
                    opacity: loading ? 0.7 : 1
                  }}
                >
                  {loading ? 'Logging out...' : 'Yes, Logout'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Default button variant
  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 20px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12,
          cursor: 'pointer',
          color: '#f87171',
          fontWeight: 600,
          fontSize: 14,
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
        }}
      >
        <LogOut size={18} />
        Logout
      </button>

      {showConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: 20,
            padding: 28,
            maxWidth: 400,
            width: '90%',
            textAlign: 'center',
            border: '1px solid rgba(239,68,68,0.3)'
          }}>
            <div style={{
              width: 56,
              height: 56,
              background: 'rgba(239,68,68,0.15)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertCircle size={28} style={{ color: '#f87171' }} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>Confirm Logout</h3>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>Are you sure you want to sign out?</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  border: 'none',
                  borderRadius: 10,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  color: 'white',
                  fontWeight: 600,
                  opacity: loading ? 0.7 : 1
                }}
              >
                {loading ? 'Logging out...' : 'Yes, Logout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
