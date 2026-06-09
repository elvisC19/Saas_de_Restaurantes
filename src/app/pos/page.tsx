'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { ItemMenu, Mesa } from '@/types/database';
import { addDecimals, multiplyDecimals, formatCurrency } from '@/lib/math';
import PaymentModal from './PaymentModal';
import { usePlanGuard } from '@/hooks/usePlanGuard';

interface CartItem {
  item: ItemMenu;
  cantidad: number;
}

export default function PosPage() {
  const { rol, empresaId, giro, plan, logout } = useAuth();
  const router = useRouter();

  // Guard de Plan para habilitar el Plano de Mesas
  const { hasAccess: planPermiteMesas } = usePlanGuard('medio');

  const [productos, setProductos] = useState<(ItemMenu & { hasStock: boolean })[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<number | null>(null);

  // Selector de Mesa para Restaurante
  const [mesa, setMesa] = useState('');
  const [dbMesas, setDbMesas] = useState<Mesa[]>([]);
  const [selectedMesaId, setSelectedMesaId] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdPedidoId, setCreatedPedidoId] = useState<number | null>(null);
  const [pedidoTotal, setPedidoTotal] = useState('0.00');

  // Control de Turnos
  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [checkingShift, setCheckingShift] = useState(true);
  const [montoApertura, setMontoApertura] = useState('');
  const [notasApertura, setNotasApertura] = useState('');
  const [openingShift, setOpeningShift] = useState(false);

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const checkActiveShift = async () => {
    if (rol !== 'Cajero' || (plan !== 'medio' && plan !== 'premium')) {
      setCheckingShift(false);
      return;
    }
    try {
      setCheckingShift(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setCheckingShift(false);
        return;
      }
      const { data: active, error } = await supabase
        .from('turnos_personal')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('estado', 'Abierto')
        .maybeSingle();

      if (error) throw error;
      setActiveShift(active);
    } catch (err) {
      console.error('Error al verificar turno activo:', err);
    } finally {
      setCheckingShift(false);
    }
  };

  useEffect(() => {
    if (rol && plan) {
      checkActiveShift();
    }
  }, [rol, plan]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(montoApertura);
    if (isNaN(monto) || monto < 0) {
      alert('Por favor ingrese un monto de apertura válido (mayor o igual a 0).');
      return;
    }
    try {
      setOpeningShift(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado.');

      const { data: newShift, error } = await supabase
        .from('turnos_personal')
        .insert({
          empresa_id: empresaId,
          usuario_id: user.id,
          monto_apertura: monto,
          notas_caja: notasApertura || null,
          estado: 'Abierto',
          fecha_apertura: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      setActiveShift(newShift);
    } catch (err) {
      console.error('Error al abrir turno:', err);
      alert('Error al abrir el turno. Inténtelo de nuevo.');
    } finally {
      setOpeningShift(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const loadMenu = async () => {
    if (!rol || !giro) return;
    try {
      const { data: menuData, error: menuError } = await supabase
        .from('items_menu')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('giro', giro)
        .order('nombre', { ascending: true });
      if (menuError) throw menuError;

      const { data: insumosData, error: insumosError } = await supabase
        .from('inventario_insumos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('giro', giro);
      if (insumosError) throw insumosError;

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

      const itemsWithStock = (menuData || []).map((item) => {
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

  const loadDbMesas = async () => {
    if (giro !== 'RESTAURANTE' || !planPermiteMesas) return;
    try {
      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('numero_mesa', { ascending: true });
      if (error) throw error;
      setDbMesas(data || []);
    } catch (err) {
      console.error('Error al cargar mesas en POS:', err);
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

  useEffect(() => {
    if (giro === 'RESTAURANTE' && planPermiteMesas) {
      loadDbMesas();
    }
  }, [giro, planPermiteMesas, empresaId]);

  const handleSelectMesa = (val: string) => {
    setSelectedMesaId(val);
    const selected = dbMesas.find((m) => String(m.id) === val);
    if (selected) {
      setMesa(String(selected.numero_mesa));
    } else {
      setMesa('');
    }
  };

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

  const clearCart = () => {
    setCart([]);
    setMesa('');
    setSelectedMesaId('');
    loadDbMesas();
  };

  const calcularTotal = (): string => {
    let total = '0.00';
    cart.forEach((ci) => {
      total = addDecimals(total, multiplyDecimals(ci.item.precio, ci.cantidad, 2), 2);
    });
    return total;
  };

  const handleGenerateOrder = async () => {
    if (cart.length === 0) return;
    
    // Validación de Mesa obligatoria para Restaurante
    if (giro === 'RESTAURANTE') {
      if (planPermiteMesas && !selectedMesaId) {
        setErrorMsg('Debes seleccionar una mesa del plano antes de confirmar el pedido.');
        return;
      }
      if (!planPermiteMesas && !mesa) {
        setErrorMsg('Debes asignar un número de mesa antes de confirmar el pedido.');
        return;
      }
    }

    setSubmittingOrder(true);
    setErrorMsg(null);
    const totalStr = calcularTotal();
    try {
      const pedidoInsert = {
        empresa_id: empresaId,
        total: totalStr,
        estado: 'Pendiente',
        ...(giro === 'RESTAURANTE' ? { 
          numero_mesa: parseInt(mesa),
          ...(planPermiteMesas ? { mesa_id: parseInt(selectedMesaId) } : {})
        } : {})
      };

      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert([pedidoInsert])
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

      // Actualizar estado de la mesa a 'Ocupada' en caliente
      if (giro === 'RESTAURANTE' && planPermiteMesas && selectedMesaId) {
        await supabase
          .from('mesas')
          .update({ estado: 'Ocupada' })
          .eq('id', parseInt(selectedMesaId));
      }

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

  if (checkingShift && rol === 'Cajero' && (plan === 'medio' || plan === 'premium')) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--bg-base)]">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 border-2 border-zinc-800 border-t-[var(--accent)] rounded-full animate-spin" />
          <p className="text-[12px] text-[var(--text-dim)] font-normal">Validando turno de caja…</p>
        </div>
      </div>
    );
  }

  const showShiftModal = rol === 'Cajero' && (plan === 'medio' || plan === 'premium') && !activeShift;

  if (showShiftModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
        <div className="w-full max-w-md rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-dark)] text-[var(--accent-light)] text-lg">
              💵
            </div>
            <h2 className="text-[16px] font-medium text-white">Apertura de Turno Requerida</h2>
            <p className="text-[11px] text-[var(--text-dim)] font-normal leading-relaxed">
              Por favor, ingrese el monto inicial de efectivo en caja para habilitar el Punto de Venta (POS).
            </p>
          </div>

          <form onSubmit={handleOpenShift} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Efectivo Inicial (BOB)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={montoApertura}
                onChange={(e) => setMontoApertura(e.target.value)}
                placeholder="Ej. 100.00"
                className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-3.5 py-2.5 text-[12px] text-white focus:outline-none focus:border-[var(--accent)] font-normal"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Notas de Caja (Opcional)
              </label>
              <textarea
                value={notasApertura}
                onChange={(e) => setNotasApertura(e.target.value)}
                placeholder="Indique si tiene billetes rotos, monedas, etc."
                rows={3}
                className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-3.5 py-2.5 text-[12px] text-white focus:outline-none focus:border-[var(--accent)] font-normal resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] py-3 text-[12px] font-medium text-zinc-400 hover:text-white transition-all hover:bg-[var(--bg-card)]"
              >
                Cerrar Sesión
              </button>
              <button
                type="submit"
                disabled={openingShift}
                className="flex-1 rounded-[var(--radius-sm)] bg-[var(--accent)] py-3 text-[12px] font-medium text-white hover:bg-[var(--accent-dark)] transition-all disabled:opacity-40"
              >
                {openingShift ? 'Abriendo…' : 'Abrir Caja'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const currentTotal = calcularTotal();
  const totalItems = cart.reduce((s, ci) => s + ci.cantidad, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg-base)] lg:flex-row">
      {/* ───── LEFT: Catalog ───── */}
      <div className="flex flex-1 flex-col p-6 overflow-y-auto">
        {/* Header Adaptable */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight">
              {giro === 'CAFETERIA' ? 'Punto de Venta Rápida' : 'Menú de Platos Compuestos'}
            </h1>
            <p className="text-[12px] text-[var(--text-dim)] font-normal">
              {giro === 'CAFETERIA' ? 'Catálogo optimizado de cafés y bebidas de barra' : 'Fórmula de insumos y recetas de cocina compuestas'}
            </p>
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
            <p className="text-[13px] text-[var(--text-dim)] font-normal">No hay productos de este giro en el menú</p>
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
                    <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-medium text-white">
                      {inCart.cantidad}
                    </span>
                  )}

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
                      <p className="text-[16px] font-medium text-[var(--accent)] tracking-tight leading-none mt-1">
                        {formatCurrency(prod.precio)}
                      </p>
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

        {/* Asignación de Mesa (Solo Restaurante, Requerido) */}
        {giro === 'RESTAURANTE' && (
          <div className="px-6 py-3 border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)]">
            <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] block mb-1.5">
              Mesa de Consumo (Requerido)
            </label>
            {planPermiteMesas ? (
              <select
                value={selectedMesaId}
                onChange={(e) => handleSelectMesa(e.target.value)}
                className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] font-normal bg-zinc-950"
              >
                <option value="">-- Seleccionar Mesa --</option>
                {dbMesas.map((m) => (
                  <option key={m.id} value={m.id} disabled={m.estado === 'Sucia'}>
                    Mesa {m.numero_mesa} ({m.estado}) {m.unificada_con ? '🔗' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min="1"
                required
                value={mesa}
                onChange={(e) => setMesa(e.target.value)}
                placeholder="Ej. 4"
                className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)] placeholder-zinc-750"
              />
            )}
          </div>
        )}

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
            className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-3.5 font-medium text-white text-[13px] transition-all hover:bg-[var(--accent-dark)] active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
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
