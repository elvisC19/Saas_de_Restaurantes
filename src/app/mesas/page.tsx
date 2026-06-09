'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Mesa, Pedido } from '@/types/database';
import { formatCurrency } from '@/lib/math';
import { usePlanGuard } from '@/hooks/usePlanGuard';
import UpgradePrompt from '@/components/UpgradePrompt';

export default function MesasPage() {
  const { rol, empresaId, giro } = useAuth();
  const router = useRouter();
  const { hasAccess } = usePlanGuard('medio');

  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesa, setSelectedMesa] = useState<Mesa | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Consumo acumulado por mesa ID
  const [consumos, setConsumos] = useState<Record<number, number>>({});

  // Merge (Unión) States
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const loadMesas = async () => {
    if (!rol || !giro) return;
    try {
      // 1. Cargar mesas
      const { data: mesasData, error: mesasErr } = await supabase
        .from('mesas')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('numero_mesa', { ascending: true });

      if (mesasErr) throw mesasErr;
      setMesas(mesasData || []);

      // 2. Cargar consumo acumulado de pedidos activos (Pendiente, En Preparación, Listo)
      const { data: pedidosData, error: pedidosErr } = await supabase
        .from('pedidos')
        .select('total, mesa_id')
        .eq('empresa_id', empresaId)
        .in('estado', ['Pendiente', 'En Preparación', 'Listo']);

      if (pedidosErr) throw pedidosErr;

      const sumMap: Record<number, number> = {};
      (pedidosData || []).forEach((p: any) => {
        if (p.mesa_id) {
          sumMap[p.mesa_id] = (sumMap[p.mesa_id] || 0) + parseFloat(p.total || '0');
        }
      });
      setConsumos(sumMap);
    } catch (err: any) {
      setErrorMsg('Error al cargar mesas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!rol || !giro) return;
    loadMesas();

    // Sincronización Realtime para las mesas
    const channel = supabase
      .channel('mesas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas', filter: `empresa_id=eq.${empresaId}` },
        () => {
          loadMesas();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresaId}` },
        () => {
          loadMesas();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rol, empresaId, giro]);

  const handleUpdateEstado = async (mesaId: number, nuevoEstado: 'Libre' | 'Ocupada' | 'Sucia') => {
    try {
      const { error } = await supabase
        .from('mesas')
        .update({ estado: nuevoEstado })
        .eq('id', mesaId);
      if (error) throw error;
      setSelectedMesa(null);
      await loadMesas();
    } catch {
      setErrorMsg('Error al actualizar estado de la mesa.');
    }
  };

  // Merge (Unión) de Mesas
  const handleToggleMergeMode = () => {
    setMergeMode(!mergeMode);
    setSelectedForMerge([]);
  };

  const handleSelectForMerge = (id: number) => {
    if (selectedForMerge.includes(id)) {
      setSelectedForMerge(selectedForMerge.filter((item) => item !== id));
    } else {
      if (selectedForMerge.length < 2) {
        setSelectedForMerge([...selectedForMerge, id]);
      }
    }
  };

  const handleConfirmMerge = async () => {
    if (selectedForMerge.length !== 2) return;
    const [mesaA, mesaB] = selectedForMerge;
    try {
      // Unir mesa B a mesa A
      const { error } = await supabase
        .from('mesas')
        .update({ unificada_con: mesaA })
        .eq('id', mesaB);

      if (error) throw error;
      setMergeMode(false);
      setSelectedForMerge([]);
      await loadMesas();
    } catch {
      setErrorMsg('Error al unificar mesas.');
    }
  };

  const handleSeparateMesa = async (mesaId: number) => {
    try {
      const { error } = await supabase
        .from('mesas')
        .update({ unificada_con: null })
        .eq('id', mesaId);

      if (error) throw error;
      await loadMesas();
    } catch {
      setErrorMsg('Error al separar mesa.');
    }
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 bg-[var(--bg-base)]">
        <UpgradePrompt />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-[var(--bg-base)] text-[var(--text-dim)]">
        <div className="h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg-base)] overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8 space-y-6">
        
        {/* Header plano mesas */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-[0.5px] border-zinc-800 pb-5">
          <div>
            <h1 className="text-[20px] font-medium text-[var(--text-primary)] tracking-tight">Distribución de Salón</h1>
            <p className="text-[12px] text-[var(--text-dim)] font-normal">Supervisión física de mesas y consumos activos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMergeMode}
              className={`rounded-[var(--radius-sm)] border-[0.5px] px-3.5 py-1.5 text-[11px] font-medium transition-all ${
                mergeMode
                  ? 'border-[var(--danger)] text-[var(--danger)] bg-transparent'
                  : 'border-[var(--accent)] text-[var(--accent)] bg-transparent hover:bg-[var(--accent)] hover:text-white'
              }`}
            >
              {mergeMode ? 'Cancelar Unión' : '🔗 Unificar Mesas'}
            </button>
            {mergeMode && selectedForMerge.length === 2 && (
              <button
                onClick={handleConfirmMerge}
                className="rounded-[var(--radius-sm)] bg-[var(--accent)] text-white px-3.5 py-1.5 text-[11px] font-medium transition-all"
              >
                Confirmar Unión
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--danger)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--danger)] font-normal">
            {errorMsg}
          </div>
        )}

        {/* Plano de Distribución (CSS Grid) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {mesas.map((mesa) => {
            const isSelectedForMerge = selectedForMerge.includes(mesa.id);
            const isUnified = mesa.unificada_con !== null;
            const parentMesa = isUnified ? mesas.find((m) => m.id === mesa.unificada_con) : null;
            const unifiedChildren = mesas.filter((m) => m.unificada_con === mesa.id);

            // Calcular capacidad total si está unificada
            let totalCapacidad = mesa.capacidad;
            if (unifiedChildren.length > 0) {
              totalCapacidad += unifiedChildren.reduce((acc, curr) => acc + curr.capacidad, 0);
            }

            // Consumo acumulado (se suma el de la mesa parent o sus hijos)
            let totalConsumo = consumos[mesa.id] || 0;
            if (unifiedChildren.length > 0) {
              unifiedChildren.forEach((child) => {
                totalConsumo += consumos[child.id] || 0;
              });
            }

            // Color del badge
            let badgeClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            if (mesa.estado === 'Ocupada') {
              badgeClass = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            } else if (mesa.estado === 'Sucia') {
              badgeClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            }

            return (
              <div
                key={mesa.id}
                onClick={() => {
                  if (mergeMode) {
                    if (mesa.estado === 'Libre' && !isUnified) {
                      handleSelectForMerge(mesa.id);
                    }
                  } else {
                    setSelectedMesa(mesa);
                  }
                }}
                className={`relative rounded-[var(--radius-md)] border-[0.5px] bg-[var(--bg-card)] p-5 text-left transition-all ${
                  mergeMode
                    ? mesa.estado !== 'Libre' || isUnified
                      ? 'opacity-30 cursor-not-allowed border-zinc-800'
                      : isSelectedForMerge
                      ? 'border-[var(--accent)] ring-1 ring-[var(--accent)] cursor-pointer'
                      : 'border-zinc-850 hover:border-zinc-800 cursor-pointer'
                    : 'border-zinc-850 hover:border-zinc-800 cursor-pointer'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-[16px] font-medium text-white tracking-tight">Mesa {mesa.numero_mesa}</h3>
                    <p className="text-[10px] text-[var(--text-dim)] font-normal mt-0.5">Cap: {totalCapacidad} personas</p>
                  </div>
                  <span className={`rounded-full border-[0.5px] px-2 py-0.5 text-[9px] font-medium uppercase ${badgeClass}`}>
                    {mesa.estado}
                  </span>
                </div>

                <div className="mt-8 flex items-end justify-between w-full">
                  <div>
                    {mesa.estado === 'Ocupada' && totalConsumo > 0 ? (
                      <>
                        <span className="text-[8px] uppercase tracking-wider text-[var(--text-dim)] font-normal">Consumo</span>
                        <p className="text-[14px] font-medium text-[var(--accent)] mt-0.5">{formatCurrency(totalConsumo.toFixed(2))}</p>
                      </>
                    ) : (
                      <span className="text-[10px] text-[var(--text-dim)] font-normal">Sin cuenta</span>
                    )}
                  </div>

                  {isUnified && (
                    <span className="text-[9px] text-[var(--text-dim)] font-mono">
                      🔗 Mesa {parentMesa?.numero_mesa}
                    </span>
                  )}
                  {unifiedChildren.length > 0 && (
                    <span className="text-[9px] text-[var(--accent-light)] font-mono">
                      🔗 +Mesa {unifiedChildren.map(c => c.numero_mesa).join(', ')}
                    </span>
                  )}
                </div>

                {/* Separar unificación (Solo Admin/Cajero) */}
                {isUnified && !mergeMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeparateMesa(mesa.id);
                    }}
                    className="absolute -top-1.5 -right-1.5 bg-[var(--bg-surface)] text-[var(--danger)] border-[0.5px] border-zinc-800 rounded-full h-5 w-5 flex items-center justify-center text-[10px] hover:bg-zinc-900"
                    title="Separar Mesa"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Modal de Control de Mesa */}
        {selectedMesa && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6">
              <div className="flex items-center justify-between border-b-[0.5px] border-zinc-800 pb-3 mb-4">
                <h3 className="text-[15px] font-medium text-white">Administrar Mesa {selectedMesa.numero_mesa}</h3>
                <button
                  onClick={() => setSelectedMesa(null)}
                  className="text-zinc-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[11px] text-[var(--text-dim)] font-normal">Capacidad física: {selectedMesa.capacidad} personas</p>
                  <p className="text-[11px] text-[var(--text-dim)] font-normal mt-1">
                    Estado actual: <strong className="text-white font-medium">{selectedMesa.estado}</strong>
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleUpdateEstado(selectedMesa.id, 'Libre')}
                    className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-950/40 py-2.5 text-[11px] font-medium text-emerald-400 hover:bg-zinc-900/50"
                  >
                    Libre
                  </button>
                  <button
                    onClick={() => handleUpdateEstado(selectedMesa.id, 'Ocupada')}
                    className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-950/40 py-2.5 text-[11px] font-medium text-rose-400 hover:bg-zinc-900/50"
                  >
                    Ocupar
                  </button>
                  <button
                    onClick={() => handleUpdateEstado(selectedMesa.id, 'Sucia')}
                    className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-950/40 py-2.5 text-[11px] font-medium text-amber-400 hover:bg-zinc-900/50"
                  >
                    Sucia
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
