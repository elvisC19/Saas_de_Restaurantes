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
  const { rol, empresaId, giro } = useAuth();
  const router = useRouter();

  const [productos, setProductos] = useState<(ItemMenu & { hasStock: boolean })[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<number | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdPedidoId, setCreatedPedidoId] = useState<number | null>(null);
  const [pedidoTotal, setPedidoTotal] = useState('0.00');

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const loadMenu = async () => {
    if (!rol || !giro) return;
    try {
      // 1. Cargar items del menú
      const { data: menuData, error: menuError } = await supabase
        .from('items_menu')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre', { ascending: true });
      if (menuError) throw menuError;

      // 2. Cargar insumos
      const { data: insumosData, error: insumosError } = await supabase
        .from('inventario_insumos')
        .select('*')
        .eq('empresa_id', empresaId);
      if (insumosError) throw insumosError;

      // 3. Cargar recetas
      const { data: recetasData, error: recetasError } = await supabase
        .from('receta_detail')
        .select('*');
      if (recetasError) throw recetasError;

      const insumoMap = new Map<number, number>();
      (insumosData || []).forEach((ins) => {
        insumoMap.set(ins.id, parseFloat(ins.stock_actual || '0'));
      });

      const itemRecetas = (recetasData || []).reduce((acc: Record<number, { insumoId: number; qty: number }[]>, r: any) => {
        if (!acc[r.item_menu_id]) acc[r.item_menu_id] = [];
        acc[r.item_menu_id].push({ insumoId: r.insumo_id, qty: parseFloat(r.cantidad_requerida || '0') });
        return acc;
      }, {});

      const allItems = menuData || [];
      const filtered = allItems.filter((item) => {
        if (giro === 'RESTAURANTE') {
          return item.nombre === 'Lomo Saltado' || item.nombre === 'Sopa de Maní';
        } else {
          // CAFETERIA
          return item.nombre === 'Café Americano' || item.nombre === 'Café con Leche' || item.nombre === 'Café Espresso' || item.nombre === 'Capuccino';
        }
      });

      const itemsWithStock = filtered.map((item) => {
        const recipe = itemRecetas[item.id] || [];
        let hasSufficientStock = true;
        if (recipe.length > 0) {
          hasSufficientStock = recipe.every((r) => {
            const currentStock = insumoMap.get(r.insumoId) || 0;
            return currentStock >= r.qty;
          });
        }
        return {
          ...item,
          hasStock: hasSufficientStock,
        };
      });

      setProductos(itemsWithStock);
    } catch (err: any) {
      setErrorMsg('Error de conexión al cargar el menú.');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (!rol || !giro) return;
    loadMenu();

    const channel = supabase
      .channel('pos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario_insumos', filter: `empresa_id=eq.${empresaId}` },
        () => {
          loadMenu();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rol, empresaId, giro]);

  const addToCart = useCallback((item: ItemMenu & { hasStock: boolean }) => {
    if (!item.hasStock) return;
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

  if (!rol) return <div className="flex flex-1 items-center justify-center text-[var(--text-dim)] bg-[var(--bg-base)]">Cargando…</div>;

  const currentTotal = calcularTotal();
  const totalItems = cart.reduce((s, ci) => s + ci.cantidad, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-base)] lg:flex-row">
      {/* ───── LEFT: Catalog ───── */}
      <div className="flex flex-1 flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight">Menú del día</h1>
            <p className="text-[12px] text-[var(--text-dim)] font-normal">Toca un producto para agregarlo al pedido</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)]">
              {productos.length} ítems
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--danger)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--danger)] font-normal">
            {errorMsg}
          </div>
        )}

        {loadingItems ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        ) : productos.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 py-20 rounded-[var(--radius-lg)] border-[0.5px] border-dashed border-[var(--border-default)] bg-[var(--bg-card)]">
            <p className="text-[13px] text-[var(--text-dim)] font-normal">Menú vacío</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {productos.map((prod) => {
              const inCart = cart.find((ci) => ci.item.id === prod.id);
              const hasStock = prod.hasStock;

              return (
                <button
                  key={prod.id}
                  onClick={() => hasStock && addToCart(prod)}
                  disabled={!hasStock}
                  className={`group relative flex flex-col justify-between rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] p-5 text-left transition-all duration-150 ${
                    !hasStock
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:border-[var(--accent)] active:scale-[0.98]'
                  }`}
                >
                  {/* Cart badge */}
                  {inCart && (
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-medium text-white shadow-none">
                      {inCart.cantidad}
                    </span>
                  )}

                  {/* Header card info */}
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[15px] font-medium text-[var(--text-primary)] leading-tight">
                        {prod.nombre}
                      </h3>
                      {!hasStock && (
                        <span className="shrink-0 bg-[var(--danger)] text-white text-[9px] font-medium px-2 py-0.5 rounded-[var(--radius-sm)]">
                          Sin stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-8 flex items-end justify-between w-full">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-normal">Precio</p>
                      <p className="text-[16px] font-medium text-[var(--accent)] tracking-tight leading-none mt-1">{formatCurrency(prod.precio)}</p>
                    </div>
                    {hasStock && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-[0.5px] border-[var(--accent)] bg-transparent text-[var(--accent)] group-hover:bg-[var(--accent)] group-hover:text-white transition-all text-xs font-medium">
                        +
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ───── RIGHT: Cart ───── */}
      <div className="w-full lg:w-[380px] flex flex-col bg-[var(--bg-surface)] border-l-[0.5px] border-[var(--border-default)]">
        {/* Cart Header */}
        <div className="flex items-center justify-between border-b-[0.5px] border-[var(--border-default)] px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-medium text-[var(--text-primary)]">Detalle de Venta</h2>
            {totalItems > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-dark)] px-1.5 text-[10px] font-medium text-[var(--accent-light)]">
                {totalItems}
              </span>
            )}
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-[11px] font-medium text-[var(--danger)] bg-transparent hover:underline"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <p className="text-[12px] text-[var(--text-dim)] font-normal">El carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.map((ci) => {
                const sub = multiplyDecimals(ci.item.precio, ci.cantidad, 2);
                return (
                  <div
                    key={ci.item.id}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{ci.item.nombre}</p>
                      <p className="text-[11px] text-[var(--text-dim)] font-normal">{formatCurrency(ci.item.precio)} c/u</p>
                    </div>
                    
                    {/* Cantidad controles */}
                    <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-1 py-0.5">
                      <button
                        onClick={() => subtractFromCart(ci.item.id)}
                        className="flex h-5 w-5 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-medium"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-[12px] font-medium text-[var(--text-primary)]">{ci.cantidad}</span>
                      <button
                        onClick={() => {
                          const prodStock = productos.find(p => p.id === ci.item.id);
                          if (prodStock && prodStock.hasStock) {
                            addToCart(prodStock);
                          }
                        }}
                        className="flex h-5 w-5 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-medium"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[13px] font-medium text-[var(--text-primary)] w-20 text-right">{formatCurrency(sub)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart Footer */}
        <div className="border-t-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[var(--text-muted)] font-normal">Total</span>
            <span className="text-[20px] font-medium text-[var(--accent)] tracking-tight">{formatCurrency(currentTotal)}</span>
          </div>
          <button
            onClick={handleGenerateOrder}
            disabled={cart.length === 0 || submittingOrder}
            className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-3.5 font-medium text-white text-[13px] transition-all hover:bg-[var(--accent-dark)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed shadow-none"
          >
            {submittingOrder ? 'Procesando…' : 'Confirmar pedido'}
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
