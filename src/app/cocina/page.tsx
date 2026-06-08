'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PedidoConDetalles, EstadoPedido } from '@/types/database';

export default function CocinaPage() {
  const { rol, empresaId } = useAuth();
  const router = useRouter();

  const [pedidos, setPedidos] = useState<PedidoConDetalles[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Proteger ruta
  useEffect(() => {
    if (!rol) {
      router.push('/');
    }
  }, [rol, router]);

  // Función para cargar los pedidos activos
  const loadActiveOrders = async () => {
    if (!rol) return;
    try {
      // Consultar pedidos que no estén en estado final 'Pagado' (ya que al pagar se consideran servidos y cobrados)
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          detalle_pedidos (
            id,
            pedido_id,
            item_menu_id,
            cantidad,
            items_menu (
              id,
              nombre,
              precio
            )
          )
        `)
        .eq('empresa_id', empresaId)
        .in('estado', ['Pendiente', 'En Preparación', 'Listo'])
        .order('id', { ascending: true });

      if (error) throw error;
      setPedidos((data as any) || []);
    } catch (err: any) {
      console.error('Error al cargar pedidos en KDS:', err);
      setErrorMsg('No se pudieron recuperar los pedidos de cocina.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar pedidos y configurar canal en tiempo real
  useEffect(() => {
    if (!rol) return;

    loadActiveOrders();

    // 1. Configurar canal de tiempo real para escuchar inserciones y actualizaciones
    const channel = supabase
      .channel('kds-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresaId}` },
        () => {
          console.log('Cambio detectado en pedidos. Recargando KDS...');
          loadActiveOrders();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'detalle_pedidos' },
        () => {
          console.log('Cambio detectado en detalle_pedidos. Recargando KDS...');
          loadActiveOrders();
        }
      )
      .subscribe();

    // Limpiar suscripción al desmontar
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rol, empresaId]);

  // Avanzar estado del pedido
  const avanzarEstado = async (pedidoId: number, estadoActual: EstadoPedido) => {
    let nuevoEstado: EstadoPedido;
    if (estadoActual === 'Pendiente') {
      nuevoEstado = 'En Preparación';
    } else if (estadoActual === 'En Preparación') {
      nuevoEstado = 'Listo';
    } else {
      return; // 'Listo' o 'Pagado' no se avanzan desde cocina
    }

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ estado: nuevoEstado })
        .eq('id', pedidoId);

      if (error) throw error;
      // La lista se actualizará mediante el evento Realtime
    } catch (err: any) {
      console.error('Error al actualizar estado:', err);
      alert('Error al actualizar el estado en el servidor.');
    }
  };

  // Filtrar pedidos por columna
  const pendientes = pedidos.filter((p) => p.estado === 'Pendiente');
  const enPreparacion = pedidos.filter((p) => p.estado === 'En Preparación');
  const listos = pedidos.filter((p) => p.estado === 'Listo');

  if (!rol) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-zinc-400">
        Cargando privilegios de Cocina...
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 p-6 overflow-hidden">
      {/* Cabecera */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            🍳 Pantalla de Cocina / KDS
            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400 animate-pulse">
              Tiempo Real Activo
            </span>
          </h2>
          <p className="text-xs text-zinc-400">Canal de preparación en vivo para baristas y cocineros</p>
        </div>
        
        {/* Leyenda académica */}
        <div className="rounded-lg bg-zinc-900/50 border border-zinc-800 p-2.5 max-w-sm text-[11px] text-zinc-400">
          💡 <strong>Demostración:</strong> Cuando crees un pedido en el POS, aparecerá aquí inmediatamente. Tras prepararlo, el Cajero podrá cobrarlo en el POS para activar el Trigger.
        </div>
      </div>

      {errorMsg && (
        <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          ⚠️ {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid flex-1 gap-6 md:grid-cols-3 overflow-hidden">
          {/* Columna Pendiente */}
          <div className="flex flex-col rounded-2xl bg-zinc-900/20 border border-zinc-900/80 p-4 h-[calc(100vh-180px)] overflow-hidden">
            <div className="mb-4 flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                📥 Pendientes
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-bold text-zinc-300">
                {pendientes.length}
              </span>
            </div>
            
            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {pendientes.map((ped) => (
                <div
                  key={ped.id}
                  className="rounded-xl border border-zinc-850 bg-zinc-900/50 p-4 space-y-3 hover:border-amber-500/20 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-amber-400">Pedido #{ped.id}</span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(ped.creado_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  {/* Items */}
                  <div className="border-t border-b border-zinc-800/60 py-2 space-y-1">
                    {ped.detalle_pedidos?.map((det: any) => (
                      <div key={det.id} className="flex justify-between text-xs text-zinc-300">
                        <span>{det.items_menu?.nombre}</span>
                        <span className="font-bold text-zinc-100">x{det.cantidad}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => avanzarEstado(ped.id, 'Pendiente')}
                    className="w-full rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-amber-400"
                  >
                    🔥 Iniciar Preparación
                  </button>
                </div>
              ))}
              {pendientes.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-8">Sin pedidos en espera</p>
              )}
            </div>
          </div>

          {/* Columna En Preparación */}
          <div className="flex flex-col rounded-2xl bg-zinc-900/20 border border-zinc-900/80 p-4 h-[calc(100vh-180px)] overflow-hidden">
            <div className="mb-4 flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                ⚡ En Preparación
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-bold text-amber-400 border border-amber-500/10">
                {enPreparacion.length}
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {enPreparacion.map((ped) => (
                <div
                  key={ped.id}
                  className="rounded-xl border border-zinc-850 bg-zinc-900/50 p-4 space-y-3 hover:border-emerald-500/20 transition-all"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-amber-400">Pedido #{ped.id}</span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(ped.creado_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="border-t border-b border-zinc-800/60 py-2 space-y-1">
                    {ped.detalle_pedidos?.map((det: any) => (
                      <div key={det.id} className="flex justify-between text-xs text-zinc-300">
                        <span>{det.items_menu?.nombre}</span>
                        <span className="font-bold text-zinc-100">x{det.cantidad}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => avanzarEstado(ped.id, 'En Preparación')}
                    className="w-full rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-emerald-400"
                  >
                    ✓ Terminar Preparación
                  </button>
                </div>
              ))}
              {enPreparacion.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-8">Sin pedidos en proceso</p>
              )}
            </div>
          </div>

          {/* Columna Listo */}
          <div className="flex flex-col rounded-2xl bg-zinc-900/20 border border-zinc-900/80 p-4 h-[calc(100vh-180px)] overflow-hidden">
            <div className="mb-4 flex items-center justify-between pb-2 border-b border-zinc-800">
              <span className="text-sm font-bold text-zinc-400 uppercase tracking-wide">
                📦 Listos para Servir
              </span>
              <span className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-bold text-emerald-400 border border-emerald-500/10">
                {listos.length}
              </span>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-1">
              {listos.map((ped) => (
                <div
                  key={ped.id}
                  className="rounded-xl border border-zinc-850 bg-zinc-900/50 p-4 space-y-3 border-emerald-500/10"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-emerald-400">Pedido #{ped.id}</span>
                    <span className="text-[10px] text-zinc-500">
                      {new Date(ped.creado_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="border-t border-b border-zinc-800/60 py-2 space-y-1">
                    {ped.detalle_pedidos?.map((det: any) => (
                      <div key={det.id} className="flex justify-between text-xs text-zinc-300">
                        <span>{det.items_menu?.nombre}</span>
                        <span className="font-bold text-zinc-100">x{det.cantidad}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded bg-emerald-500/10 border border-emerald-500/20 p-2 text-center text-xs font-semibold text-emerald-400">
                    🔔 Esperando Cobro / Entrega en Caja
                  </div>
                </div>
              ))}
              {listos.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-8">Sin pedidos listos</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
