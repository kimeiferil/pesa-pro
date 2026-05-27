import React from 'react';
import { useBusinesses } from '../../hooks/useBusinesses';
import { useAuth } from '../../context/AuthContext';

export default function MoreScreen() {
  const { currentBusiness } = useBusinesses();
  const auth = useAuth();

  return (
    <div style={{ padding: 12, color: '#e6eef6', background: '#0b1120', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>More</h3>
      <div style={{ marginTop: 12 }}>
        <h4>Settings</h4>
        <div style={{ padding: 8 }}><a href="#/settings">Business Settings</a></div>
        <div style={{ padding: 8 }}><a href="#/settings/online-shop">Online Shop Settings</a></div>
        <div style={{ padding: 8 }}><a href="#/billing">Billing</a></div>
        <div style={{ padding: 8 }}><a href="#/settings/payment-integrations">Payment Integrations</a></div>
        <div style={{ padding: 8 }}><a href="#/profile">Profile</a></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <h4>Support</h4>
        <div style={{ padding: 8 }}><a href="https://youtube.com">Watch Tutorials (YouTube)</a></div>
        <div style={{ padding: 8 }}><a href={`https://wa.me/${currentBusiness?.phone ?? ''}`}>Get Help on WhatsApp</a></div>
        <div style={{ padding: 8 }}><a href="https://calendly.com">Book Guided Setup Call</a></div>
      </div>

      <div style={{ position: 'fixed', bottom: 24, right: 24 }}>
        <button style={{ background: '#00C851', color: '#021', borderRadius: 28, padding: '12px 18px', fontWeight: 800 }}>+ Create</button>
      </div>
    </div>
  );
}
