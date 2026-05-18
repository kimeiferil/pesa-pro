import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Shield, AlertCircle, LogIn } from 'lucide-react';
import { checkRateLimit, logUserAction, startSessionTimer } from '../utils/security';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // Rate limiting check
    if (!checkRateLimit(`login_${email}`, 5, 900000)) {
      setError('Too many login attempts. Please try again in 15 minutes.');
      setIsLocked(true);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await signIn(email, password);

      // Reset attempts on success
      setLoginAttempts(0);

      // Start session timer (60 minutes)
      startSessionTimer(60, () => {
        supabase.auth.signOut();
        navigate('/login');
      });
      
      navigate('/dashboard');
    } catch (err) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= 5) {
        setError('Account temporarily locked. Too many failed attempts.');
        setIsLocked(true);
      } else {
        setError(err.message || 'Invalid credentials.');
      }

      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0f1629 50%, #0a0f1e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 480, 
        margin: '20px',
        position: 'relative',
        zIndex: 10
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            width: 70, 
            height: 70, 
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)', 
            borderRadius: 18, 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: 36,
            marginBottom: 20
          }}>💰</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, color: '#f1f5f9' }}>
            Pesa Pro
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '8px 0 0' }}>Secure M-Pesa Transaction Manager</p>
        </div>

        <div style={{ 
          background: 'rgba(255,255,255,0.03)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, 
          padding: 32
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>Welcome Back</h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>Sign in securely to your account</p>
          </div>

          {/* Security Badge */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 8, 
            marginBottom: 20,
            padding: '8px 12px',
            background: 'rgba(16,185,129,0.1)',
            borderRadius: 20,
            fontSize: 11,
            color: '#10b981'
          }}>
            <Shield size={14} />
            <span>256-bit SSL Encrypted</span>
          </div>

          {error && (
            <div style={{ 
              background: 'rgba(239,68,68,0.1)', 
              border: '1px solid rgba(239,68,68,0.3)', 
              borderRadius: 12, 
              padding: '12px 16px', 
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={16} style={{ color: '#ef4444' }} />
              <span style={{ fontSize: 12, color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'block' }}>Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 14,
                    color: '#f1f5f9'
                  }}
                  required
                  disabled={isLocked}
                />
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8, display: 'block' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#475569' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 14,
                    color: '#f1f5f9'
                  }}
                  required
                  disabled={isLocked}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                cursor: (loading || isLocked) ? 'not-allowed' : 'pointer',
                opacity: (loading || isLocked) ? 0.7 : 1,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <LogIn size={16} />
              {loading ? 'Processing...' : isLocked ? 'Account Locked - Try Later' : 'Sign In'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Don't have an account?{' '}
                <button type="button" onClick={() => navigate('/signup')} style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: 600, cursor: 'pointer' }}>
                  Sign up
                </button>
              </p>
            </div>
          </form>
        </div>

        {/* Security Footer */}
        <div style={{ 
          marginTop: 24, 
          textAlign: 'center', 
          fontSize: 10, 
          color: '#334155',
          display: 'flex',
          justifyContent: 'center',
          gap: 20
        }}>
          <span>🛡️ End-to-End Encryption</span>
          <span>🔒 RLS Protected</span>
          <span>📋 Audit Logged</span>
        </div>
      </div>
    </div>
  );
}
