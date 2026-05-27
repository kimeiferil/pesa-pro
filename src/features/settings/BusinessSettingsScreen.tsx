import React, { useState } from 'react';
import { useBusinesses } from '../../hooks/useBusinesses';
import { supabase } from '../../lib/supabase';

export default function BusinessSettingsScreen() {
  const { currentBusiness, refetch } = useBusinesses();
  const biz = currentBusiness;
  const [logoUploading, setLogoUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeLogo = async (file: File | null) => {
    if (!file || !biz) return;
    setLogoUploading(true);
    setError(null);
    try {
      const path = `business-logos/${biz.id}.jpg`;
      const { data, error } = await supabase.storage.from('business-logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('business-logos').getPublicUrl(path);
      await supabase.from('businesses').update({ logo_url: urlData.publicUrl }).eq('id', biz.id);
      await refetch();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const saveInfo = async (updates: any) => {
    if (!biz) return;
    setError(null);
    try {
      await supabase.from('businesses').update(updates).eq('id', biz.id);
      await refetch();
      alert('Saved');
    } catch (e: any) {
      setError(e.message || 'Save failed');
    }
  };

  return (
    <div style={{ padding: 12, color: '#e6eef6', background: '#0b1120', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>Business Settings</h3>
      {!biz ? <div>Select a business first</div> : (
        <div style={{ maxWidth: 720 }}>
          <div>
            <div>Logo</div>
            <div style={{ marginTop: 8 }}>{biz.logo_url ? <img src={biz.logo_url} alt="logo" style={{ width: 120 }} /> : <div style={{ width: 120, height: 80, background: '#0f1724' }}>Your Company Logo</div>}</div>
            <div style={{ marginTop: 8 }}>
              <input type="file" accept="image/*" onChange={e => changeLogo(e.target.files?.[0] ?? null)} />
              {logoUploading && <div>Uploading...</div>}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label>Business name</label>
            <input defaultValue={biz.name} onBlur={e => saveInfo({ name: e.target.value })} />
            <label>Phone</label>
            <input defaultValue={biz.phone ?? ''} onBlur={e => saveInfo({ phone: e.target.value })} />
            <label>Address</label>
            <input defaultValue={biz.address ?? ''} onBlur={e => saveInfo({ address: e.target.value })} />
          </div>

          <div style={{ marginTop: 20 }}>
            <h4>Customer Document Preferences</h4>
            <label><input type="checkbox" defaultChecked={true} /> Show business logo on debt reminder SMS</label>
            <label><input type="checkbox" defaultChecked={true} /> Include due date in reminders</label>
          </div>

          <div style={{ marginTop: 20 }}>
            <h4>Danger Zone</h4>
            <button style={{ background: '#ff4d4f', color: '#fff' }} onClick={async () => {
              if (!confirm('Delete your account? This cannot be undone')) return;
              try {
                // admin delete must be performed server-side — instruct user
                alert('Account deletion requires contacting support or using admin console');
              } catch (e: any) {
                alert(e.message || 'Failed');
              }
            }}>Delete My Account</button>
          </div>

          {error && <div style={{ color: '#ff6b6b' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}
