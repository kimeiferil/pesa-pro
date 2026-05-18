import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LogoutButton from './LogoutButton';
import { User, Settings } from 'lucide-react';

export default function Header({ title, subtitle }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ 
      background: 'rgba(10,15,30,0.96)', 
      backdropFilter: 'blur(20px)', 
      borderBottom: '1px solid rgba(255,255,255,0.06)', 
      position: 'sticky', 
      top: 0, 
      zIndex: 10 
    }}>
      <div style={{ 
        maxWidth: 1400, 
        margin: '0 auto', 
        padding: '12px 28px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: 16 
      }}>
        {/* Logo Section with Your Image */}
        <div 
          onClick={() => navigate('/dashboard')} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            cursor: 'pointer'
          }}
        >
          <img 
            src="/logo.jpg" 
            alt="Pesa Pro Logo" 
            style={{ 
              width: 45, 
              height: 45, 
              borderRadius: 10,
              objectFit: 'cover'
            }} 
          />
          
          {/* Text Logo */}
          <div>
            <h1 style={{ 
              fontSize: 18, 
              fontWeight: 800, 
              margin: 0, 
              color: '#f1f5f9',
              letterSpacing: '-0.5px'
            }}>
              PESA <span style={{ color: '#10b981' }}>PRO</span>
            </h1>
            <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>Smart Transaction Manager</p>
          </div>
        </div>

        {/* Right Section */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div style={{
                width: 32,
                height: 32,
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <User size={14} style={{ color: 'white' }} />
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0' }}>
                {profile?.full_name || user.email?.split('@')[0]}
              </div>
            </div>
          )}
          <LogoutButton variant="icon" />\n              <button onClick={() => navigate("/mfa")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, cursor: "pointer", color: "#94a3b8" }} title="Security Settings">\n                <ShieldCheck size={16} />\n              </button>
        </div>
      </div>
    </div>
  );
}

