import React from 'react';
import { useInventory } from '../../hooks/useInventory';

export default function InventoryScreen({ businessId }: { businessId: string | null }) {
  const { suppliers, purchases, loading, error } = useInventory(businessId);

  if (loading) return <div>Loading inventory...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: 12, color: '#e6eef6', background: '#0b1120', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>Inventory Purchases</h3>
      <div style={{ marginTop: 12 }}>
        <h4>Suppliers</h4>
        {suppliers.length === 0 ? <div>No suppliers</div> : suppliers.map(s => (
          <div key={s.id} style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>{s.name} • {s.phone}</div>
        ))}

        <h4 style={{ marginTop: 12 }}>Purchases</h4>
        {purchases.length === 0 ? <div>No purchases yet</div> : purchases.map(p => (
          <div key={p.id} style={{ padding: 8, borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <div style={{ fontWeight: 800 }}>{p.id}</div>
            <div style={{ color: '#9aa6b2' }}>{p.purchase_date} • {p.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
