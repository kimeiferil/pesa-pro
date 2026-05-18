import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, User, ArrowRight, Shield, CheckCircle, Smartphone, TrendingUp, Award } from 'lucide-react';

export default function Signup() {
  const navigate = useNavigate();
  const { signUp, user } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  const checkPasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 10) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    setPasswordStrength(strength);
    return strength;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'password') {
      checkPasswordStrength(value);
    }
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength === 0) return 'No password';
    if (passwordStrength <= 2) return 'Weak';
    if (passwordStrength <= 3) return 'Fair';
    if (passwordStrength <= 4) return 'Good';
    return 'Strong';
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength <= 2) return '#ef4444';
    if (passwordStrength <= 3) return '#f59e0b';
    if (passwordStrength <= 4) return '#10b981';
    return '#22c55e';
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!acceptedTerms) {
      setError('Please accept the Terms of Service');
      return;
    }

    setLoading(true);

    try {
      await signUp(formData.email, formData.password, {
        full_name: formData.fullName,
        created_at: new Date().toISOString()
      });

      // Show success message and redirect
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (user) {
    return null;
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0a0f1e 0%, #0f1629 50%, #0a0f1e 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      position: 'relative',
      overflow: 'hidden',
      padding: '20px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(5deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .signup-card {
          animation: slideIn 0.6s ease-out;
        }
        
        .bg-circle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%);
          pointer-events: none;
        }
        
        .input-focus:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        
        .strength-bar {
          transition: all 0.3s ease;
        }
      `}</style>

      {/* Background Circles */}
      <div className="bg-circle" style={{ width: 300, height: 300, top: '10%', left: '-5%', animation: 'float 8s ease-in-out infinite' }}></div>
      <div className="bg-circle" style={{ width: 200, height: 200, bottom: '10%', right: '-5%', animation: 'float 10s ease-in-out infinite reverse' }}></div>
      <div className="bg-circle" style={{ width: 150, height: 150, top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 4s ease-in-out infinite' }}></div>

      {/* Signup Card */}
      <div className="signup-card" style={{ 
        width: '100%', 
        maxWidth: 520, 
        position: 'relative',
        zIndex: 10
      }}>
        {/* Logo & Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ 
            width: 70, 
            height: 70, 
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)', 
            borderRadius: 18, 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontSize: 36,
            boxShadow: '0 20px 35px -10px rgba(59,130,246,0.4)',
            marginBottom: 16
          }}>
            💰
          </div>
          <h1 style={{ 
            fontSize: 32, 
            fontWeight: 800, 
            margin: 0, 
            color: '#f1f5f9',
            letterSpacing: '-0.5px'
          }}>
            Pesa <span className="gradient-text">Pro</span>
          </h1>
          <p style={{ fontSize: 13, color: '#475569', margin: '8px 0 0', fontWeight: 500 }}>
            Join the future of M-Pesa management
          </p>
        </div>

        {/* Features Bar */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 24, 
          marginBottom: 28,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Smartphone size={14} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>M-Pesa Ready</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>Real-time Analytics</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={14} style={{ color: '#8b5cf6' }} />
            <span style={{ fontSize: 11, color: '#64748b' }}>Secure Payments</span>
          </div>
        </div>

        {/* Signup Card */}
        <div style={{ 
          background: 'rgba(255,255,255,0.03)', 
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, 
          padding: 32,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>
              Create Account
            </h2>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Get started with Pesa Pro today
            </p>
          </div>

          {/* Error Message */}
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
              <div style={{ width: 8, height: 8, background: '#ef4444', borderRadius: '50%' }}></div>
              <span style={{ fontSize: 12, color: '#fca5a5' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSignup}>
            {/* Full Name Field */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ 
                display: 'block', 
                fontSize: 12, 
                fontWeight: 600, 
                color: '#94a3b8', 
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={18} style={{ 
                  position: 'absolute', 
                  left: 14, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#475569' 
                }} />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="input-focus"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 14,
                    color: '#f1f5f9',
                    transition: 'all 0.2s'
                  }}
                  required
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Field */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ 
                display: 'block', 
                fontSize: 12, 
                fontWeight: 600, 
                color: '#94a3b8', 
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ 
                  position: 'absolute', 
                  left: 14, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#475569' 
                }} />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-focus"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 14,
                    color: '#f1f5f9',
                    transition: 'all 0.2s'
                  }}
                  required
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ 
                display: 'block', 
                fontSize: 12, 
                fontWeight: 600, 
                color: '#94a3b8', 
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ 
                  position: 'absolute', 
                  left: 14, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#475569' 
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="input-focus"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 14,
                    color: '#f1f5f9',
                    transition: 'all 0.2s'
                  }}
                  required
                  placeholder="Minimum 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#475569',
                    padding: 0
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className="strength-bar"
                        style={{
                          flex: 1,
                          height: 3,
                          background: level <= passwordStrength ? getPasswordStrengthColor() : 'rgba(255,255,255,0.1)',
                          borderRadius: 2
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ fontSize: 10, color: getPasswordStrengthColor() }}>
                    Password strength: {getPasswordStrengthText()}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: 'block', 
                fontSize: 12, 
                fontWeight: 600, 
                color: '#94a3b8', 
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ 
                  position: 'absolute', 
                  left: 14, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: '#475569' 
                }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input-focus"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 42px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    fontSize: 14,
                    color: '#f1f5f9',
                    transition: 'all 0.2s'
                  }}
                  required
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#475569',
                    padding: 0
                  }}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  style={{ 
                    width: 18, 
                    height: 18, 
                    cursor: 'pointer',
                    accentColor: '#3b82f6'
                  }}
                />
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  I agree to the{' '}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}
                    onClick={() => window.open('/terms', '_blank')}
                  >
                    Terms of Service
                  </button>
                  {' '}and{' '}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}
                    onClick={() => window.open('/privacy', '_blank')}
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                border: 'none',
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 600,
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s',
                opacity: loading ? 0.7 : 1,
                marginBottom: 20
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 20px -10px rgba(59,130,246,0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {loading ? (
                <>
                  <div style={{ 
                    width: 16, 
                    height: 16, 
                    border: '2px solid white', 
                    borderTopColor: 'transparent', 
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  Creating account...
                </>
              ) : (
                <>
                  Create Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Sign In Link */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#3b82f6',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  Sign in
                </button>
              </p>
            </div>
          </form>
        </div>

        {/* Trust Badges */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 32, 
          marginTop: 24,
          padding: '12px 20px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Shield size={14} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 10, color: '#475569' }}>Secure Encryption</span>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 10, color: '#475569' }}>100% Free</span>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Award size={14} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 10, color: '#475569' }}>24/7 Support</span>
          </div>
        </div>
      </div>
    </div>
  );
}
