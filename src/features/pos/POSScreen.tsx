import React from 'react';
import { useProducts } from '../../hooks/useProducts';
import { useSales } from '../../hooks/useSales';
import { useAuth } from '../../context/AuthContext';

export default function POSScreen({ businessId }: { businessId: string | null }) {
  const { products, loading } = useProducts(businessId);
  const { cart, addToCart, cartItemsCount, cartTotal, checkout } = useSales(businessId, useAuth().user?.id ?? null);

  if (loading) return <div>Loading products...</div>;

  return (
    <div style={{ padding: 12, background: '#0b1120', color: '#e6eef6', minHeight: '100vh' }}>
      <h3 style={{ color: '#00C851' }}>Point of Sale</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 12 }}>
        <div>
          <input placeholder="Search products..." style={{ width: '100%', padding: 8, marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {products.map(p => (
              <div key={p.id} onClick={() => addToCart({ product_id: p.id, name: p.name, unit_price: p.price, quantity: 1 })} style={{ padding: 12, background: '#071226', borderRadius: 8, cursor: 'pointer' }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: '#9aa6b2' }}>KES {p.price.toFixed(2)}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: p.stock_quantity < 5 ? '#ff6b6b' : '#9aa6b2' }}>Stock: {p.stock_quantity}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: 12, background: '#071226', borderRadius: 8 }}>
          <h4>Cart ({cartItemsCount})</h4>
          {cart.length === 0 ? <div>No items</div> : (
            <div>
              {cart.map(item => (
                <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: 8 }}>
                  <div>{item.name} x {item.quantity}</div>
                  <div>KES {(item.quantity * item.unit_price).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ marginTop: 12, fontWeight: 800 }}>Total: KES {cartTotal.toFixed(2)}</div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button onClick={() => checkout({ payment_method: 'cash' })} style={{ background: '#00C851', color: '#021' }}>Pay Cash</button>
                <button onClick={() => checkout({ payment_method: 'mpesa' })} style={{ background: '#06b6d4', color: '#021' }}>Pay M-PESA</button>
                <button onClick={() => checkout({ payment_method: 'credit' })} style={{ background: '#f59e0b', color: '#021' }}>Credit</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
