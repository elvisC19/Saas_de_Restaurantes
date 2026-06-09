'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ItemMenu } from '@/types/database';
import { addDecimals, multiplyDecimals, formatCurrency } from '@/lib/math';
import PaymentModal from './PaymentModal';

interface CartItem {
  item: ItemMenu;
  cantidad: number;
}

export default function PosPage() {
  const { rol, empresaId } = useAuth();
  const router = useRouter();

  const [productos, setProductos] = useState<ItemMenu[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdPedidoId, setCreatedPedidoId] = useState<number | null>(null);
  const [pedidoTotal, setPedidoTotal] = useState('0.00');

  useEffect(() => {
    if (!rol) router.push('/');
  }, [rol, router]);

  useEffect(() => {
    async function loadMenu() {
      if (!rol) return;
      setLoadingItems(true);
      try {
        const { data, error } = await supabase
          .from('items_menu')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('nombre', { ascending: true });
        if (error) throw error;
        setProductos(data || []);
      } catch (err: any) {
        setErrorMsg('Error de conexión al cargar el menú.');
      } finally {
        setLoadingItems(false);
      }
    }
    loadMenu();
  }, [rol, empresaId]);

  const addToCart = useCallback((item: ItemMenu) => {
    setAddedId(item.id);
    setTimeout(() => setAddedId(null), 300);
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) => i.item.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      return [...prev, { item, cantidad: 1 }];
    });
  }, []);

  const subtractFromCart = (itemId: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === itemId);
      if (!existing) return prev;
      if (existing.cantidad === 1) return prev.filter((i) => i.item.id !== itemId);
      return prev.map((i) => i.item.id === itemId ? { ...i, cantidad: i.cantidad - 1 } : i);
    });
  };

  const clearCart = () => setCart([]);

  const calcularTotal = (): string => {
    let total = '0.00';
    cart.forEach((ci) => {
      total = addDecimals(total, multiplyDecimals(ci.item.precio, ci.cantidad, 2), 2);
    });
    return total;
  };

  const handleGenerateOrder = async () => {
    if (cart.length === 0) return;
    setSubmittingOrder(true);
    setErrorMsg(null);
    const totalStr = calcularTotal();
    try {
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert([{ empresa_id: empresaId, total: totalStr, estado: 'Pendiente' }])
        .select()
        .single();
      if (pedidoError) throw pedidoError;

      const orderId = pedidoData.id;
      const detalles = cart.map((ci) => ({
        pedido_id: orderId,
        item_menu_id: ci.item.id,
        cantidad: ci.cantidad,
      }));
      const { error: detError } = await supabase.from('detalle_pedidos').insert(detalles);
      if (detError) throw detError;

      setCreatedPedidoId(orderId);
      setPedidoTotal(totalStr);
      setIsModalOpen(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear el pedido.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (!rol) return <div className="flex flex-1 items-center justify-center text-zinc-500">Cargando…</div>;

  const currentTotal = calcularTotal();
  const totalItems = cart.reduce((s, ci) => s + ci.cantidad, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950 lg:flex-row">
      {/* ───── LEFT: Catalog ───── */}
      <div className="flex flex-1 flex-col p-6 overflow-y-auto border-b border-white/[0.03] lg:border-b-0 lg:border-r">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Menú del día</h1>
            <p className="text-[12px] text-zinc-500">Toca un producto para agregarlo al pedido</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-zinc-400">
              {productos.length} ítems
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 text-sm text-rose-400">{errorMsg}</div>
        )}

        {loadingItems ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 rounded-full border-[3px] border-zinc-800 border-t-indigo-500 animate-spin" />
          </div>
        ) : productos.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 rounded-2xl border border-dashed border-white/[0.04]">
            <div className="text-4xl mb-3 opacity-30">☕</div>
            <p className="text-sm text-zinc-500">Menú vacío</p>
            <p className="text-[11px] text-zinc-600 mt-1">Ejecuta el script SQL semilla en Supabase</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {productos.map((prod) => {
              const isJustAdded = addedId === prod.id;
              const inCart = cart.find((ci) => ci.item.id === prod.id);
              return (
                <button
                  key={prod.id}
                  onClick={() => addToCart(prod)}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200 ${
                    isJustAdded
                      ? 'border-emerald-500/30 bg-emerald-500/5 scale-[0.97]'
                      : 'border-white/[0.04] bg-white/[0.015] hover:border-white/[0.08] hover:bg-white/[0.03]'
                  }`}
                >
                  {/* Cart badge */}
                  {inCart && (
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[11px] font-black text-white shadow-lg shadow-indigo-500/30 animate-count-up">
                      {inCart.cantidad}
                    </span>
                  )}

                  <div>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 text-xl">
                      ☕
                    </div>
                    <h3 className="text-[15px] font-bold text-white group-hover:text-amber-300 transition-colors leading-tight">
                      {prod.nombre}
                    </h3>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Precio</p>
                      <p className="text-lg font-extrabold text-white tracking-tight">{formatCurrency(prod.precio)}</p>
                    </div>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ───── RIGHT: Cart ───── */}
      <div className="w-full lg:w-[380px] flex flex-col bg-zinc-950 border-t border-white/[0.03] lg:border-t-0">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[15px] font-bold text-white">Detalle de Venta</h2>
            {totalItems > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500/20 px-1.5 text-[10px] font-bold text-indigo-400">
                {totalItems}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-[11px] font-semibold text-rose-400/70 hover:text-rose-400 transition-colors">
              Vaciar
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-white/[0.06] text-2xl text-zinc-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </div>
              <p className="mt-3 text-xs text-zinc-600">El carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.map((ci) => {
                const sub = multiplyDecimals(ci.item.precio, ci.cantidad, 2);
                return (
                  <div key={ci.item.id} className="flex items-center gap-3 rounded-xl border border-white/[0.03] bg-white/[0.015] p-3 animate-slide-up">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-white truncate">{ci.item.nombre}</p>
                      <p className="text-[11px] text-zinc-500">{formatCurrency(ci.item.precio)} c/u</p>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] px-1 py-0.5">
                      <button onClick={() => subtractFromCart(ci.item.id)} className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-white transition-all text-sm font-bold">
                        −
                      </button>
                      <span className="w-5 text-center text-[12px] font-bold text-white">{ci.cantidad}</span>
                      <button onClick={() => addToCart(ci.item)} className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.06] hover:text-white transition-all text-sm font-bold">
                        +
                      </button>
                    </div>
                    <span className="text-[13px] font-bold text-white w-20 text-right">{formatCurrency(sub)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t border-white/[0.04] bg-zinc-950 px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400 font-medium">Total</span>
            <span className="text-2xl font-extrabold text-white tracking-tight">{formatCurrency(currentTotal)}</span>
          </div>
          <button
            onClick={handleGenerateOrder}
            disabled={cart.length === 0 || submittingOrder}
            className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3.5 font-bold text-white shadow-xl shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 hover:brightness-110 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {submittingOrder ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Procesando…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Generar Pedido
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ───── Payment Modal ───── */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        pedidoId={createdPedidoId}
        total={pedidoTotal}
        onPaymentSuccess={clearCart}
      />
    </div>
  );
}
