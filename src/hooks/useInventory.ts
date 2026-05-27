import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
};

export type InventoryPurchase = {
  id: string;
  business_id: string;
  user_id: string;
  supplier_id: string | null;
  purchase_date: string;
  currency: string;
  status: 'draft' | 'confirmed';
  created_at: string;
  updated_at: string;
};

export type InventoryPurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string | null;
  quantity: number;
  unit_cost: number;
  subtotal: number;
};

export function useInventory(businessId: string | null) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<InventoryPurchase[]>([]);
  const [items, setItems] = useState<InventoryPurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInventory = useCallback(async () => {
    if (!businessId) {
      setSuppliers([]);
      setPurchases([]);
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [{ data: supplierData, error: supplierError }, { data: purchaseData, error: purchaseError }] =
        await Promise.all([
          supabase.from('suppliers').select('*').eq('business_id', businessId).order('created_at', { ascending: false }),
          supabase.from('inventory_purchases').select('*').eq('business_id', businessId).order('created_at', { descending: true }),
        ]);

      if (supplierError) throw supplierError;
      if (purchaseError) throw purchaseError;

      setSuppliers((supplierData ?? []) as Supplier[]);
      setPurchases((purchaseData ?? []) as InventoryPurchase[]);
    } catch (e: any) {
      setError(e.message ?? 'Unable to load inventory');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const createSupplier = useCallback(async (supplier: {
    name: string;
    phone?: string;
    email?: string;
    user_id: string;
  }) => {
    if (!businessId) return null;
    const payload = {
      business_id: businessId,
      ...supplier,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('suppliers').insert(payload).select().single();
    if (error) throw error;
    setSuppliers(prev => [data as Supplier, ...prev]);
    return data as Supplier;
  }, [businessId]);

  const createPurchase = useCallback(async (purchase: {
    supplier_id?: string | null;
    currency?: string;
    user_id: string;
    purchase_date?: string;
  }) => {
    if (!businessId) return null;
    const payload = {
      business_id: businessId,
      supplier_id: purchase.supplier_id ?? null,
      currency: purchase.currency ?? 'KES',
      status: 'draft',
      purchase_date: purchase.purchase_date ?? new Date().toISOString().split('T')[0],
      user_id: purchase.user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('inventory_purchases').insert(payload).select().single();
    if (error) throw error;
    setPurchases(prev => [data as InventoryPurchase, ...prev]);
    return data as InventoryPurchase;
  }, [businessId]);

  const addPurchaseItem = useCallback(async (item: {
    purchase_id: string;
    product_id?: string | null;
    quantity: number;
    unit_cost: number;
  }) => {
    const payload = {
      purchase_id: item.purchase_id,
      product_id: item.product_id ?? null,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      subtotal: item.quantity * item.unit_cost,
    };
    const { data, error } = await supabase.from('inventory_purchase_items').insert(payload).select().single();
    if (error) throw error;
    setItems(prev => [...prev, data as InventoryPurchaseItem]);
    return data as InventoryPurchaseItem;
  }, []);

  const confirmPurchase = useCallback(async (purchaseId: string, userId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: purchase, error: purchaseError } = await supabase
        .from('inventory_purchases')
        .select('*')
        .eq('id', purchaseId)
        .single();
      if (purchaseError || !purchase) throw purchaseError ?? new Error('Purchase not found');

      const { data: purchaseItems, error: itemError } = await supabase
        .from('inventory_purchase_items')
        .select('*')
        .eq('purchase_id', purchaseId);
      if (itemError) throw itemError;

      await Promise.all((purchaseItems ?? []).map(async (item: any) => {
        if (!item.product_id) return;
        const { data: existing, error: fetchError } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single();
        if (fetchError) throw fetchError;
        const currentQty = Number(existing?.stock_quantity ?? 0);
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock_quantity: currentQty + item.quantity })
          .eq('id', item.product_id);
        if (updateError) throw updateError;
      }));

      const totalAmount = (purchaseItems ?? []).reduce((sum: number, item: any) => sum + Number(item.subtotal || 0), 0);
      await supabase.from('inventory_purchases').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', purchaseId);

      await supabase.from('transactions').insert({
        business_id: purchase.business_id,
        amount: totalAmount,
        direction: 'debit',
        type: 'inventory',
        category: 'inventory',
        raw_text: `Inventory purchase ${purchaseId}`,
        txn_date: new Date(purchase.purchase_date).toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      });

      setPurchases(prev => prev.map(item => item.id === purchaseId ? { ...(item as InventoryPurchase), status: 'confirmed' } : item));
      return true;
    } catch (e: any) {
      setError(e.message ?? 'Unable to confirm purchase');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventory();
  }, [fetchInventory]);

  return {
    suppliers,
    purchases,
    items,
    loading,
    error,
    refetch: fetchInventory,
    createSupplier,
    createPurchase,
    addPurchaseItem,
    confirmPurchase,
  };
}
