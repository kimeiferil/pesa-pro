import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type Product = {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  price: number;
  unit: string;
  stock_quantity: number;
  image_url: string | null;
  category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export function useProducts(businessId: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!businessId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;
      setProducts((data ?? []) as Product[]);
    } catch (e: any) {
      setError(e.message ?? 'Unable to load products');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  const createProduct = useCallback(async (product: {
    name: string;
    price: number;
    unit?: string;
    stock_quantity?: number;
    image_url?: string;
    category?: string;
    is_active?: boolean;
    user_id: string;
  }) => {
    if (!businessId) return null;
    const payload = {
      business_id: businessId,
      ...product,
      stock_quantity: product.stock_quantity ?? 0,
      unit: product.unit ?? 'pcs',
      is_active: product.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('products').insert(payload).select().single();
    if (error) throw error;
    setProducts(prev => [data as Product, ...prev]);
    return data as Product;
  }, [businessId]);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>) => {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from('products').update(payload).eq('id', productId).select().single();
    if (error) throw error;
    setProducts(prev => prev.map(item => item.id === productId ? (data as Product) : item));
    return data as Product;
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
    setProducts(prev => prev.filter(item => item.id !== productId));
    return true;
  }, []);

  const lowStockProducts = products.filter(product => product.stock_quantity < 5);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    lowStockProducts,
    refetch: fetchProducts,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
