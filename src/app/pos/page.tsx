'use client';

import React, { useState, useEffect } from 'react';
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

  // Estados del POS
  const [productos, setProductos] = useState<ItemMenu[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados del Modal de Pago
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createdPedidoId, setCreatedPedidoId] = useState<number | null>(null);
  const [pedidoTotal, setPedidoTotal] = useState('0.00');

  // Proteger la ruta (redirecciona si no hay rol)
  useEffect(() => {
    if (!rol) {
      router.push('/');
    }
  }, [rol, router]);

  // Cargar productos del menú desde Supabase
  useEffect(() => {
    async function loadMenu() {
      if (!rol) return;
      setLoadingItems(true);
      setErrorMsg(null);
      try {
        const { data, error } = await supabase
          .from('items_menu')
          .select('*')
          .eq('empresa_id', empresaId)
          .order('nombre', { ascending: true });

        if (error) throw error;
        setProductos(data || []);
      } catch (err: any) {
        console.error('Error al cargar menú:', err);
        setErrorMsg('No se pudo conectar con la base de datos para cargar el menú.');
      } finally {
        setLoadingItems(false);
      }
    }
    loadMenu();
  }, [rol, empresaId]);

  // Agregar item al carrito
  const addToCart = (item: ItemMenu) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.item.id === item.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { item, cantidad: 1 }];
    });
  };

  // Restar item del carrito
  const subtractFromCart = (itemId: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.item.id === itemId);
      if (!existing) return prev;
      if (existing.cantidad === 1) {
        return prev.filter((i) => i.item.id !== itemId);
      }
      return prev.map((i) =>
        i.item.id === itemId ? { ...i, cantidad: i.cantidad - 1 } : i
      );
    });
  };

  // Quitar por completo del carrito
  const removeFromCart = (itemId: number) => {
    setCart((prev) => prev.filter((i) => i.item.id !== itemId));
  };

  // Limpiar todo el carrito
  const clearCart = () => setCart([]);

  // Calcular el total del carrito con precisión fija
  const calcularTotal = (): string => {
    let total = '0.00';
    cart.forEach((cartItem) => {
      const itemTotal = multiplyDecimals(cartItem.item.precio, cartItem.cantidad, 2);
      total = addDecimals(total, itemTotal, 2);
    });
    return total;
  };

  // Registrar pedido en la base de datos
  const handleGenerateOrder = async () => {
    if (cart.length === 0) return;
    setSubmittingOrder(true);
    setErrorMsg(null);

    const totalStr = calcularTotal();

    try {
      // 1. Insertar el Pedido (Cabecera) en estado 'Pendiente'
      const { data: pedidoData, error: pedidoError } = await supabase
        .from('pedidos')
        .insert([
          {
            empresa_id: empresaId,
            total: totalStr,
            estado: 'Pendiente',
          },
        ])
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      const orderId = pedidoData.id;

      // 2. Insertar los detalles correspondientes
      const detallesInsertables = cart.map((cartItem) => ({
        pedido_id: orderId,
        item_menu_id: cartItem.item.id,
        cantidad: cartItem.cantidad,
      }));

      const { error: detallesError } = await supabase
        .from('detalle_pedidos')
        .insert(detallesInsertables);

      if (detallesError) {
        // En un caso real, deberíamos borrar el pedido huérfano, pero para la demo manejamos la excepción
        throw detallesError;
      }

      // 3. Abrir modal de pago con los datos generados
      setCreatedPedidoId(orderId);
      setPedidoTotal(totalStr);
      setIsModalOpen(true);
    } catch (err: any) {
      console.error('Error al registrar pedido:', err);
      setErrorMsg(err.message || 'Error de conexión al crear el pedido.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (!rol) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-zinc-400">
        Cargando privilegios...
      </div>
    );
  }

  const currentTotal = calcularTotal();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950 lg:flex-row">
      {/* Sección Izquierda: Catálogo del Menú */}
      <div className="flex flex-1 flex-col border-b border-zinc-800 p-6 lg:border-b-0 lg:border-r overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-100">Menú Comercial</h2>
            <p className="text-xs text-zinc-400">Haz clic en un producto para agregarlo al pedido</p>
          </div>
          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold text-amber-400 border border-zinc-700">
            {productos.length} Productos
          </span>
        </div>

        {errorMsg && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            ⚠️ {errorMsg}
          </div>
        )}

        {loadingItems ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <span className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          </div>
        ) : productos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10">
            <span className="text-4xl mb-3">☕</span>
            <p className="text-sm text-zinc-400">No hay productos registrados en el menú.</p>
            <p className="text-xs text-zinc-600 mt-1">Asegúrate de correr el script SQL semilla en Supabase.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {productos.map((prod) => (
              <button
                key={prod.id}
                onClick={() => addToCart(prod)}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 text-left transition-all hover:border-amber-500/40 hover:bg-zinc-900/60"
              >
                <div className="mb-4">
                  <span className="text-2xl mb-2 block">☕</span>
                  <h3 className="font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
                    {prod.nombre}
                  </h3>
                </div>
                <div className="flex items-center justify-between mt-2 w-full">
                  <span className="text-sm font-semibold text-zinc-400">Precio</span>
                  <span className="text-base font-extrabold text-zinc-100">
                    {formatCurrency(prod.precio)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sección Derecha: Carrito / Resumen del Pedido */}
      <div className="w-full lg:w-96 bg-zinc-950 flex flex-col justify-between p-6 border-t border-zinc-800 lg:border-t-0">
        <div className="flex flex-col flex-1 overflow-y-auto">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
            <h2 className="text-lg font-bold text-zinc-200">Detalle de Venta</h2>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                Limpiar todo
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 py-16 text-zinc-500 text-center">
              <span className="text-3xl mb-2">🛒</span>
              <p className="text-xs">El carrito está vacío.</p>
              <p className="text-[10px] text-zinc-600 mt-1">Selecciona items del catálogo de la izquierda.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {cart.map((cartItem) => {
                const subtotal = multiplyDecimals(cartItem.item.precio, cartItem.cantidad, 2);
                return (
                  <div
                    key={cartItem.item.id}
                    className="flex justify-between items-start rounded-xl border border-zinc-800 bg-zinc-900/20 p-3 text-sm"
                  >
                    <div className="flex-1 pr-3">
                      <p className="font-semibold text-zinc-200">{cartItem.item.nombre}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{formatCurrency(cartItem.item.precio)} c/u</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-bold text-zinc-100">{formatCurrency(subtotal)}</span>
                      <div className="flex items-center gap-2 rounded-lg border border-zinc-850 bg-zinc-900 px-2 py-1">
                        <button
                          onClick={() => subtractFromCart(cartItem.item.id)}
                          className="text-xs text-zinc-400 hover:text-zinc-200 w-4 text-center font-bold"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-zinc-300 px-1">{cartItem.cantidad}</span>
                        <button
                          onClick={() => addToCart(cartItem.item)}
                          className="text-xs text-zinc-400 hover:text-zinc-200 w-4 text-center font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Totales y Botones de Compra */}
        <div className="pt-4 border-t border-zinc-850 bg-zinc-950 mt-4">
          <div className="flex justify-between items-center mb-6">
            <span className="text-zinc-400 text-sm font-semibold">Total General</span>
            <span className="text-2xl font-extrabold text-zinc-100">
              {formatCurrency(currentTotal)}
            </span>
          </div>

          <button
            onClick={handleGenerateOrder}
            disabled={cart.length === 0 || submittingOrder}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 px-4 py-3.5 font-bold text-white transition-all hover:brightness-110 shadow-lg shadow-amber-950/20 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submittingOrder ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Registrando Pedido...
              </>
            ) : (
              <>
                📝 Generar Pedido
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal de Pago Financiero */}
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
