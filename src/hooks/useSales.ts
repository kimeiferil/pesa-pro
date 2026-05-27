import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useOnlineStatus } from '../shared/offline';

const QUEUE_KEY = 'pesapro_pending_sales';

type CartItem = {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
};

type PendingSale = {
  cart: CartItem[];
  business_id: string;
  payment_method: 'mpesa' | 'cash' | 'credit';
  customer_id?: string;
  user_id: string;
  created_at: string;
};

export function useSales(businessId: string | null, userId: string | null) {
  const online = useOnlineStatus();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pendingSales, setPendingSales] = useState<PendingSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveQueue = useCallback((queue: PendingSale[]) => {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    setPendingSales(queue);
  }, []);

  const loadQueue = useCallback(() => {
    try {
      const raw = localStorage.getItem(QUEUE_KEY) || '[]';
      const parsed = JSON.parse(raw) as PendingSale[];
      setPendingSales(parsed);
    } catch {
      setPendingSales([]);
    }
  }, []);

  const addToCart = useCallback((item: CartItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === item.product_id);
      if (existing) {
        return prev.map(i => i.product_id === item.product_id ? { ...i, quantity: i.quantity + item.quantity } : i);
      }
      return [...prev, item];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const syncPendingSales = useCallback(async () => {
    if (!online || pendingSales.length === 0) return;
    setLoading(true);
    setError(null);

    const queue = [...pendingSales];
    const remaining: PendingSale[] = [];

    for (const sale of queue) {
      try {
        await commitSale(sale);
      } catch (e: any) {
        remaining.push(sale);
        console.error('Sale sync failed:', e);
      }
    }

    saveQueue(remaining);
    setLoading(false);
  }, [online, pendingSales, saveQueue]);

  const commitSale = useCallback(async (sale: PendingSale) => {
    const { data: saleRow, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: sale.user_id,
        business_id: sale.business_id,
        total_amount: sale.cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
        payment_method: sale.payment_method,
        customer_id: sale.customer_id ?? null,
        created_at: sale.created_at,
      })
      .select()
      .single();

    if (saleError || !saleRow) throw saleError ?? new Error('Failed to create sale');

    const saleItems = sale.cart.map(item => ({
      sale_id: saleRow.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price,
    }));

    const { error: itemError } = await supabase.from('sale_items').insert(saleItems);
    if (itemError) throw itemError;

    await Promise.all(sale.cart.map(async item => {
      const { error: updateError } = await supabase
        .from('products')
        .update({})
        .eq('id', item.product_id)
        .increment('stock_quantity', -item.quantity);
      if (updateError) throw updateError;
    }));

    if (sale.payment_method === 'credit' && sale.customer_id) {
      const { error: debtError } = await supabase.from('debts').insert({
        business_id: sale.business_id,
        customer_id: sale.customer_id,
        amount: sale.cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
        status: 'unpaid',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      if (debtError) throw debtError;
    }

    return saleRow;
  }, []);

  const checkout = useCallback(async (options: {
    payment_method: 'mpesa' | 'cash' | 'credit';
    customer_id?: string;
  }) => {
    if (!businessId || !userId) {
      setError('Unable to checkout without business and user context');
      return null;
    }

    const payload: PendingSale = {
      business_id: businessId,
      user_id: userId,
      payment_method: options.payment_method,
      customer_id: options.customer_id,
      cart,
      created_at: new Date().toISOString(),
    };

    if (!online) {
      const queued = [...pendingSales, payload];
      saveQueue(queued);
      clearCart();
      return { queued: true };
    }

    setLoading(true);
    setError(null);
    try {
      const result = await commitSale(payload);
      clearCart();
      return { queued: false, sale: result };
    } catch (e: any) {
      setError(e.message ?? 'Checkout failed');
      const queued = [...pendingSales, payload];
      saveQueue(queued);
      clearCart();
      return { queued: true };
    } finally {
      setLoading(false);
    }
  }, [businessId, userId, cart, commitSale, clearCart, online, pendingSales, saveQueue]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    void syncPendingSales();
  }, [online, syncPendingSales]);

  const cartTotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const cartItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return {
    cart,
    pendingSales,
    loading,
    error,
    cartTotal,
    cartItemsCount,
    addToCart,
    removeFromCart,
    clearCart,
    checkout,
    syncPendingSales,
  };
}
