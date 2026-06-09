'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { PedidoConDetalles, EstadoPedido } from '@/types/database';

// Pedido extendido para soportar prioridad y mesa en TypeScript
interface PedidoKDS extends PedidoConDetalles {
  numero_mesa?: number;
  prioridad?: 'Alta' | 'Media' | 'Baja';
}

function ElapsedTimer({ createdAt, giro }: { createdAt: string; giro: 'CAFETERIA' | 'RESTAURANTE' }) {
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
  
  // Cafetería cambia a ámbar a los 3 min. Restaurante a los 5 min (ámbar) y 10 min (rojo).
  let color = 'text-[var(--text-dim)]';
  if (giro === 'CAFETERIA') {
    color = mins >= 3 ? 'text-[var(--warn)]' : 'text-[var(--text-dim)]';
  } else {
    color = mins >= 10 ? 'text-[var(--danger)]' : mins >= 5 ? 'text-[var(--warn)]' : 'text-[var(--text-dim)]';
  }

  return <span className={`font-mono text-[12px] font-medium ${color}`}>{elapsed}</span>;
}

export default function CocinaPage() {
  const { rol, empresaId, giro } = useAuth();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<PedidoKDS[]>([]);
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
      .channel('pedidos-cocina')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresaId}` },
        () => {
          loadActiveOrders();
        }
      )
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

  const handleUpdatePrioridad = async (pedidoId: number, newPrioridad: 'Alta' | 'Media' | 'Baja') => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ prioridad: newPrioridad })
        .eq('id', pedidoId);
      if (error) throw error;
      await loadActiveOrders();
    } catch (err) {
      console.error('Error al actualizar prioridad:', err);
    }
  };

  const getCookingTime = (nombre: string): string => {
    if (nombre.includes('Lomo')) return '15 min';
    if (nombre.includes('Sopa')) return '10 min';
    return '3 min';
  };

  const getPriorityColor = (prio: 'Alta' | 'Media' | 'Baja') => {
    if (prio === 'Alta') return 'text-[var(--danger)] border-[var(--danger)] bg-[var(--danger)]/5';
    if (prio === 'Baja') return 'text-[var(--text-dim)] border-[var(--border-default)]';
    return 'text-[var(--warn)] border-[var(--warn)] bg-[var(--warn)]/5';
  };

  const pendientes = pedidos.filter((p) => p.estado === 'Pendiente');
  const enPreparacion = pedidos.filter((p) => p.estado === 'En Preparación');
  const listos = pedidos.filter((p) => p.estado === 'Listo');

  if (!rol || !giro) return <div className="flex flex-1 items-center justify-center text-[var(--text-dim)] bg-[var(--bg-base)]">Cargando…</div>;

  const columns: {
    title: string;
    data: PedidoKDS[];
    leftBorderColor: string;
    btnLabel: string;
    showBtn: boolean;
    statusBadge?: string;
  }[] = [
    {
      title: giro === 'CAFETERIA' ? 'BEBIDAS NUEVAS' : 'NUEVOS PEDIDOS',
      data: pendientes,
      leftBorderColor: 'border-l-[var(--accent)]',
      btnLabel: 'Iniciar Preparación',
      showBtn: true,
    },
    {
      title: 'EN PREPARACIÓN',
      data: enPreparacion,
      leftBorderColor: 'border-l-[var(--warn)]',
      btnLabel: 'Marcar como Listo',
      showBtn: true,
    },
    {
      title: 'LISTOS PARA SERVIR',
      data: listos,
      leftBorderColor: 'border-l-[#5DCAA5]',
      btnLabel: '',
      showBtn: false,
      statusBadge: 'Esperando cobro',
    },
  ];

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg-base)] overflow-hidden">
      {/* Header */}
      <div className="border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[18px] font-medium text-white tracking-tight flex items-center gap-2">
            KDS · {giro === 'CAFETERIA' ? 'Barra de Cafetería' : 'Cocina de Restaurante'}
            <span className="flex items-center gap-1.5 rounded-full border-[0.5px] border-[var(--accent)] bg-[var(--accent-dark)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent-light)]">
              LIVE
            </span>
          </h1>
          <p className="text-[11px] text-[var(--text-dim)] font-normal">Sincronización en tiempo real con el terminal de ventas</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1 font-normal"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> {pendientes.length} Nuevos</span>
          <span className="flex items-center gap-1 font-normal"><span className="h-1.5 w-1.5 rounded-full bg-[var(--warn)]" /> {enPreparacion.length} En prep.</span>
          <span className="flex items-center gap-1 font-normal"><span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-light)]" /> {listos.length} Listos</span>
        </div>
      </div>

      {/* Kanban Columns */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-0 overflow-hidden bg-[var(--bg-base)]">
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col border-r-[0.5px] border-[var(--border-default)] last:border-r-0 overflow-hidden">
              {/* Column header */}
              <div className="flex items-center justify-between px-5 py-3 border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)]">
                <span className="text-[11px] font-medium text-[var(--text-muted)] tracking-wider">{col.title}</span>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] px-1.5 text-[10px] font-medium text-[var(--text-muted)]">
                  {col.data.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-base)]">
                {col.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <p className="text-[11px] text-[var(--text-dim)] font-normal">Sin pedidos</p>
                  </div>
                ) : (
                  col.data.map((ped) => (
                    <div
                      key={ped.id}
                      className={`rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] border-l-[2px] ${col.leftBorderColor} overflow-hidden`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between px-4 py-2.5 border-b-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)]">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[var(--text-primary)]">#{ped.id}</span>
                          {giro === 'RESTAURANTE' && ped.numero_mesa && (
                            <span className="rounded bg-[var(--accent-dark)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-light)]">
                              Mesa {ped.numero_mesa}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <ElapsedTimer createdAt={ped.creado_at || new Date().toISOString()} giro={giro} />
                          <span className="text-[10px] text-[var(--text-dim)] font-normal">
                            {new Date(ped.creado_at || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* Card Body — Items + Cooking Times */}
                      <div className="px-4 py-3 space-y-1.5">
                        {ped.detalle_pedidos?.map((det: any) => (
                          <div key={det.id} className="flex items-center justify-between gap-1.5">
                            <div className="flex flex-col">
                              <span className="text-[12px] text-[var(--text-primary)] font-normal">{det.items_menu?.nombre}</span>
                              {giro === 'RESTAURANTE' && (
                                <span className="text-[10px] text-[var(--text-dim)] font-normal">
                                  Cocción est: {getCookingTime(det.items_menu?.nombre)}
                                </span>
                              )}
                            </div>
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-1.5 text-[10px] font-medium text-[var(--text-primary)]">
                              ×{det.cantidad}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Card Footer — Action + Priority */}
                      <div className="px-4 py-2.5 border-t-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col gap-2">
                        {giro === 'RESTAURANTE' && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-medium text-[var(--text-dim)] uppercase tracking-wider">Prioridad:</span>
                            <select
                              value={ped.prioridad || 'Media'}
                              onChange={(e) => handleUpdatePrioridad(ped.id, e.target.value as any)}
                              className={`rounded-[var(--radius-sm)] border-[0.5px] px-2 py-0.5 text-[10px] font-medium outline-none bg-zinc-950 ${getPriorityColor(ped.prioridad || 'Media')}`}
                            >
                              <option value="Alta">Alta 🔴</option>
                              <option value="Media">Media 🟡</option>
                              <option value="Baja">Baja ⚪</option>
                            </select>
                          </div>
                        )}

                        {col.showBtn ? (
                          <button
                            onClick={() => avanzarEstado(ped.id, ped.estado)}
                            className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--accent)] bg-transparent text-[var(--accent)] text-[11px] font-medium py-1.5 transition-all hover:bg-[var(--accent)] hover:text-white active:scale-[0.97]"
                          >
                            {col.btnLabel}
                          </button>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--accent-dark)] bg-transparent px-3 py-1.5 text-[11px] font-medium text-[var(--accent-light)]">
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
