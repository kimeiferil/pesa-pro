import React from 'react';

export default function Logo({ size = 'medium', showText = true, onClick }) {
  const sizes = {
    small: { img: 30, text: 14 },
    medium: { img: 45, text: 18 },
    large: { img: 80, text: 24 }
  };
  
  const currentSize = sizes[size] || sizes.medium;
  
  return (
    <div 
      onClick={onClick} 
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 12,
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      <img 
        src="/logo.jpg" 
        alt="Pesa Pro Logo" 
        style={{ 
          width: currentSize.img, 
          height: currentSize.img, 
          borderRadius: currentSize.img * 0.2,
          objectFit: 'cover',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }} 
      />
      
      {showText && (
        <div>
          <h1 style={{ 
            fontSize: currentSize.text, 
            fontWeight: 800, 
            margin: 0, 
            color: '#f1f5f9',
            letterSpacing: '-0.5px'
          }}>
            PESA <span style={{ color: '#10b981' }}>PRO</span>
          </h1>
          {size !== 'small' && (
            <p style={{ fontSize: currentSize.text * 0.6, color: '#475569', margin: 0 }}>
              Smart Transaction Manager
            </p>
          )}
        </div>
      )}
    </div>
  );
}
