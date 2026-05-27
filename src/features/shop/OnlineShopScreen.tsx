import React, { useState } from 'react';
import { useBusinesses } from '../../hooks/useBusinesses';
import { supabase } from '../../lib/supabase';

export default function OnlineShopScreen() {
  const { currentBusiness, refetch } = useBusinesses();
  const biz = currentBusiness;
  const [enabled, setEnabled] = useState(biz?.shop_is_active ?? false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (!biz) return;
    setLoading(true);
    try {
      const res = await fetch('/.netlify/functions/setup-online-shop', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}` },
        body: JSON.stringify({ business_id: biz.id, enabled: !enabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setEnabled(json.shop_is_active);
      alert(`Shop ${json.shop_is_active ? 'enabled' : 'disabled'} — ${json.shop_url}`);
      await refetch();
    } catch (e: any) {
      alert(e.message || 'Failed');
    } finally { setLoading(false); }
  };

  if (!biz) return <div>Select a business first</div>;

  return (
    <div style={{ padding: 12, background: '#0b1120', color: '#e6eef6', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>Online Shop</h3>
      <div style={{ marginTop: 12 }}>
        <div>Shop URL: {biz.slug ? `${window.location.origin}/shop/${biz.slug}` : 'Not configured'}</div>
        <div style={{ marginTop: 12 }}>
          <button onClick={toggle} style={{ background: '#00C851', color: '#021' }}>{enabled ? 'Disable Shop' : 'Enable Shop'}</button>
          <button style={{ marginLeft: 8 }} onClick={() => { navigator.share && navigator.share({ title: biz.name, url: `${window.location.origin}/shop/${biz.slug}` }); }}>Share</button>
        </div>
      </div>
    </div>
  );
}
