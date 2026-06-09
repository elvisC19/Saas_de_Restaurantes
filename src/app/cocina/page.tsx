'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PedidoConDetalles, EstadoPedido } from '@/types/database';

function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('0:00');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, '0')}`);
    };
    update();
    intervalRef.current = setInterval(update, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [createdAt]);

  const mins = parseInt(elapsed.split(':')[0]);
  const color = mins >= 10 ? 'text-rose-400' : mins >= 5 ? 'text-amber-400' : 'text-zinc-400';

  return <span className={`font-mono text-[12px] font-bold ${color}`}>{elapsed}</span>;
}

export default function CocinaPage() {
  const { rol, empresaId, giro } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoConDetalles[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const loadActiveOrders = async () => {
    if (!rol || !giro) return;
    try {
      const { data, error } = await supabase
        .from('pedidos')
        .select(`*, detalle_pedidos (id, pedido_id, item_menu_id, cantidad, items_menu (id, nombre, precio))`)
        .eq('empresa_id', empresaId)
        .in('estado', ['Pendiente', 'En Preparación', 'Listo'])
        .order('id', { ascending: true });
      if (error) throw error;
      setPedidos((data as any) || []);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rol || !giro) return;
    loadActiveOrders();
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        console.log('¡Cambio detectado en tiempo real!', payload);
        loadActiveOrders();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rol, empresaId, giro]);

  const avanzarEstado = async (pedidoId: number, estadoActual: EstadoPedido) => {
    const next: EstadoPedido = estadoActual === 'Pendiente' ? 'En Preparación' : 'Listo';
    if (estadoActual !== 'Pendiente' && estadoActual !== 'En Preparación') return;
    try {
      await supabase.from('pedidos').update({ estado: next }).eq('id', pedidoId);
    } catch {
      alert('Error al actualizar estado.');
    }
  };

  const pendientes = pedidos.filter((p) => p.estado === 'Pendiente');
  const enPreparacion = pedidos.filter((p) => p.estado === 'En Preparación');
  const listos = pedidos.filter((p) => p.estado === 'Listo');

  if (!rol) return <div className="flex flex-1 items-center justify-center text-zinc-500">Cargando…</div>;

  const columns: {
    title: string;
    data: PedidoConDetalles[];
    headerColor: string;
    dotColor: string;
    btnLabel: string;
    btnClass: string;
    showBtn: boolean;
    statusBadge?: string;
  }[] = [
    {
      title: 'Nuevos Pedidos',
      data: pendientes,
      headerColor: 'border-amber-500/30',
      dotColor: 'bg-amber-400',
      btnLabel: 'Iniciar Preparación',
      btnClass: 'bg-amber-500 hover:bg-amber-400 text-black',
      showBtn: true,
    },
    {
      title: 'En Preparación',
      data: enPreparacion,
      headerColor: 'border-indigo-500/30',
      dotColor: 'bg-indigo-400',
      btnLabel: 'Marcar como Listo',
      btnClass: 'bg-indigo-500 hover:bg-indigo-400 text-white',
      showBtn: true,
    },
    {
      title: 'Listos para Servir',
      data: listos,
      headerColor: 'border-emerald-500/30',
      dotColor: 'bg-emerald-400',
      btnLabel: '',
      btnClass: '',
      showBtn: false,
      statusBadge: 'Esperando cobro en caja',
    },
  ];

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="border-b border-white/[0.03] px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Kitchen Display System
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              LIVE
            </span>
          </h1>
          <p className="text-[11px] text-zinc-500">Las órdenes llegan automáticamente por Supabase Realtime</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> {pendientes.length} Nuevos</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> {enPreparacion.length} En prep.</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {listos.length} Listos</span>
        </div>
      </div>

      {/* Kanban Columns */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 rounded-full border-[3px] border-zinc-800 border-t-emerald-500 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-0 overflow-hidden">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col border-r border-white/[0.02] last:border-r-0 overflow-hidden">
              {/* Column header */}
              <div className={`flex items-center justify-between px-5 py-3 border-b-2 ${col.headerColor} bg-white/[0.01]`}>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <span className="text-[12px] font-bold text-zinc-300 uppercase tracking-wider">{col.title}</span>
                </div>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-white/[0.04] px-1.5 text-[10px] font-bold text-zinc-400">
                  {col.data.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {col.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-10 w-10 rounded-xl border border-dashed border-white/[0.06] flex items-center justify-center text-zinc-700 text-lg mb-2">
                      {ci === 0 ? '📥' : ci === 1 ? '⚡' : '✓'}
                    </div>
                    <p className="text-[11px] text-zinc-600">Sin pedidos</p>
                  </div>
                ) : (
                  col.data.map((ped) => (
                    <div
                      key={ped.id}
                      className="rounded-xl border border-white/[0.04] bg-white/[0.015] overflow-hidden transition-all hover:border-white/[0.08] animate-slide-up"
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] bg-white/[0.01]">
                        <span className="text-[13px] font-extrabold text-white">#{ped.id}</span>
                        <div className="flex items-center gap-2">
                          <ElapsedTimer createdAt={ped.creado_at || new Date().toISOString()} />
                          <span className="text-[10px] text-zinc-600">
                            {new Date(ped.creado_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Card Body — Items */}
                      <div className="px-4 py-3 space-y-1.5">
                        {ped.detalle_pedidos?.map((det: any) => (
                          <div key={det.id} className="flex items-center justify-between">
                            <span className="text-[12px] text-zinc-300">{det.items_menu?.nombre}</span>
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-md bg-white/[0.04] px-1.5 text-[10px] font-bold text-white">
                              ×{det.cantidad}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Card Footer — Action */}
                      <div className="px-4 py-2.5 border-t border-white/[0.03]">
                        {col.showBtn ? (
                          <button
                            onClick={() => avanzarEstado(ped.id, ped.estado)}
                            className={`w-full rounded-lg px-3 py-2 text-[11px] font-bold transition-all active:scale-[0.97] ${col.btnClass}`}
                          >
                            {col.btnLabel}
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-[11px] font-semibold text-emerald-400">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {col.statusBadge}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
