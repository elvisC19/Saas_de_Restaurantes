'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { InventarioInsumo } from '@/types/database';
import { formatCurrency, addDecimals, subtractDecimals } from '@/lib/math';
import { usePlanGuard } from '@/hooks/usePlanGuard';
import UpgradePrompt from '@/components/UpgradePrompt';

// Umbrales de stock para barras de progreso (basados en la data semilla extendida)
const STOCK_CAPS: Record<string, number> = {
  // Cafetería
  'Café en grano': 5000,
  'Leche entera': 10000,
  'Azúcar': 3000,
  'Agua purificada': 20000,
  'Taza descartable 8oz': 200,
  // Restaurante
  'Lomo de res': 10000,
  'Papas': 100,
  'Arroz': 5000,
  'Aceite': 2000,
  'Huevo': 50,
};

const UNIT_LABELS: Record<string, string> = {
  gr: 'gramos',
  ml: 'mililitros',
  unidades: 'unidades',
};

export default function AdminPage() {
  const { rol, empresaId, giro, empresaNombre, plan } = useAuth();
  const router = useRouter();
  const { hasAccess } = usePlanGuard('medio');

  const [activeTab, setActiveTab] = useState<'inventario' | 'turnos'>('inventario');
  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pedidosHoy, setPedidosHoy] = useState(0);
  const [ingresoHoy, setIngresoHoy] = useState('0.00');
  const [itemsMenuCount, setItemsMenuCount] = useState(0);

  const [turnos, setTurnos] = useState<any[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(false);

  const loadTurnos = async () => {
    if (!rol || !giro) return;
    try {
      setLoadingTurnos(true);
      const { data, error } = await supabase
        .from('turnos_personal')
        .select('*, usuarios(nombre)')
        .eq('empresa_id', empresaId)
        .eq('estado', 'Cerrado')
        .order('fecha_cierre', { ascending: false });

      if (error) throw error;
      setTurnos(data || []);
    } catch (err) {
      console.error('Error al cargar turnos:', err);
    } finally {
      setLoadingTurnos(false);
    }
  };

  useEffect(() => {
    if (rol && giro && activeTab === 'turnos') {
      loadTurnos();
    }
  }, [rol, giro, activeTab]);

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const loadInventory = async () => {
    if (!rol || !giro) return;
    try {
      // Filtrar insumos en tiempo real por giro a nivel de base de datos
      const { data, error } = await supabase
        .from('inventario_insumos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('giro', giro)
        .order('id', { ascending: true });
      if (error) throw error;
      
      setInsumos(data || []);
    } catch {
      setErrorMsg('Error al cargar inventario.');
    } finally {
      setLoading(false);
    }
  };

  const loadKPIs = async () => {
    if (!rol || !giro) return;
    try {
      const { data: pedidosData } = await supabase
        .from('pedidos')
        .select('id, total, estado')
        .eq('empresa_id', empresaId)
        .eq('estado', 'Pagado');

      if (pedidosData) {
        setPedidosHoy(pedidosData.length);
        let total = 0;
        pedidosData.forEach((p: any) => {
          total += parseFloat(p.total || '0');
        });
        setIngresoHoy(total.toFixed(2));
      }

      // Obtener cantidad de productos filtrados del giro activo en la BD
      const { data: itemsData } = await supabase
        .from('items_menu')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('giro', giro);
      
      if (itemsData) {
        setItemsMenuCount(itemsData.length);
      }
    } catch {
      // silently fail KPIs
    }
  };

  useEffect(() => {
    if (!rol || !giro) return;
    loadInventory();
    loadKPIs();

    const channel = supabase
      .channel('admin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_insumos', filter: `empresa_id=eq.${empresaId}` }, () => {
        loadInventory();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresaId}` }, () => {
        loadKPIs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rol, empresaId, giro]);

  const handleResetStock = async () => {
    setResetting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const { data: dbInsumos } = await supabase
        .from('inventario_insumos')
        .select('id, nombre')
        .eq('empresa_id', empresaId)
        .eq('giro', giro);

      if (!dbInsumos) throw new Error('No se encontraron insumos.');

      const defaultStocks: Record<string, string> = {
        // Cafetería
        'Café en grano': '5000.0000',
        'Leche entera': '10000.0000',
        'Azúcar': '3000.0000',
        'Agua purificada': '20000.0000',
        'Taza descartable 8oz': '200.0000',
        // Restaurante
        'Lomo de res': '10000.0000',
        'Papas': '100.0000',
        'Arroz': '5000.0000',
        'Aceite': '2000.0000',
        'Huevo': '50.0000',
      };

      for (const item of dbInsumos) {
        const defaultVal = defaultStocks[item.nombre];
        if (defaultVal) {
          const { error } = await supabase
            .from('inventario_insumos')
            .update({ stock_actual: defaultVal })
            .eq('id', item.id)
            .eq('empresa_id', empresaId);
          if (error) throw error;
        }
      }
      setSuccessMsg('Stock restablecido a valores semilla.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadInventory();
    } catch {
      setErrorMsg('Error al reestablecer stock.');
    } finally {
      setResetting(false);
    }
  };

  if (!rol) return <div className="flex flex-1 items-center justify-center text-[var(--text-dim)] bg-[var(--bg-base)]">Cargando…</div>;

  const getStockPercent = (insumo: InventarioInsumo) => {
    const cap = STOCK_CAPS[insumo.nombre] || 1000;
    const current = parseFloat(insumo.stock_actual);
    return Math.min(Math.max((current / cap) * 100, 0), 100);
  };

  const getBarColor = (pct: number) => {
    if (pct > 50) return 'bg-emerald-500';
    if (pct > 20) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getStatusLabel = (pct: number) => {
    if (pct > 50) return { text: 'Óptimo', color: 'text-emerald-400 bg-emerald-500/10 border-zinc-800' };
    if (pct > 20) return { text: 'Bajo', color: 'text-amber-400 bg-amber-500/10 border-zinc-800' };
    return { text: 'Crítico', color: 'text-rose-400 bg-rose-500/10 border-zinc-800' };
  };

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg-base)] overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8 space-y-6">
        
        {/* ───── Header con Nombre de Negocio y Plan Badge ───── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-[0.5px] border-zinc-800 pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-[20px] font-medium text-[var(--text-primary)] tracking-tight">{empresaNombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] text-[var(--text-dim)] font-normal">Giro: {giro === 'CAFETERIA' ? '☕ Cafetería' : '🍽️ Restaurante'} · Plan:</span>
              <span className="rounded-full border-[0.5px] border-zinc-800 bg-[var(--accent-dark)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent-light)] uppercase tracking-wider">
                {plan === 'premium' ? 'Premium' : plan === 'medio' ? 'Medio' : 'Básico'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-3 py-1 text-[11px] font-normal text-[var(--accent-light)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Realtime Activo
            </span>
            {hasAccess && (
              <button
                onClick={handleResetStock}
                disabled={resetting}
                className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--accent)] bg-transparent px-3.5 py-1.5 text-[11px] font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all disabled:opacity-40"
              >
                {resetting ? 'Reseteando…' : '↻ Reset Semilla'}
              </button>
            )}
          </div>
        </div>

        {/* ───── Alerts ───── */}
        {errorMsg && (
          <div className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--danger)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--danger)] font-normal">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--accent)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--accent)] font-normal">{successMsg}</div>
        )}

        {/* ───── KPI Cards ───── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Ingresos Recaudados',
              value: formatCurrency(ingresoHoy),
            },
            {
              label: 'Pedidos Procesados',
              value: `${pedidosHoy}`,
            },
            {
              label: 'Ítems en Menú',
              value: `${itemsMenuCount}`,
            },
            {
              label: 'Plan Activo',
              value: plan === 'premium' ? 'Premium' : plan === 'medio' ? 'Medio' : 'Básico',
            },
          ].map((kpi, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-md)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-5"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-dim)]">{kpi.label}</span>
              <p className="mt-2 text-[24px] font-medium text-[var(--accent)] tracking-tight leading-none">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ───── PostgreSQL explanation ───── */}
        <div className="rounded-[var(--radius-md)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="max-w-xl">
            <h3 className="text-[13px] font-medium text-white flex items-center gap-2">
              Trigger PostgreSQL — Inventario Automático
            </h3>
            <p className="text-[11px] text-[var(--text-dim)] mt-1 leading-relaxed font-normal">
              Al confirmar un pago en el POS, el trigger calcula las reducciones agrupadas de insumos base usando tipos NUMERIC precisos para evitar mermas financieras.
            </p>
          </div>
          <div className="shrink-0 rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] px-3 py-2 font-mono text-[10px] text-[var(--text-dim)] font-normal">
            AFTER UPDATE ON pedidos
          </div>
        </div>

        {/* ───── Inventory Table with Progress Bars & Shift Audit Tabs ───── */}
        {!hasAccess ? (
          <UpgradePrompt />
        ) : (
          <div className="space-y-6">
            {/* Tabs Selector */}
            <div className="flex border-b border-zinc-800 gap-6 text-[12px] font-medium uppercase tracking-wider pb-1">
              <button
                onClick={() => setActiveTab('inventario')}
                className={`pb-3 border-b-2 transition-all ${
                  activeTab === 'inventario'
                    ? 'border-[var(--accent)] text-[var(--accent-light)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                }`}
              >
                📦 Inventario de Insumos
              </button>
              <button
                onClick={() => setActiveTab('turnos')}
                className={`pb-3 border-b-2 transition-all ${
                  activeTab === 'turnos'
                    ? 'border-[var(--accent)] text-[var(--accent-light)]'
                    : 'border-transparent text-[var(--text-dim)] hover:text-[var(--text-muted)]'
                }`}
              >
                🔒 Auditoría de Cajas
              </button>
            </div>

            {/* Tab: Inventario */}
            {activeTab === 'inventario' && (
              loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-6 w-6 border-2 border-zinc-800 border-t-[var(--accent)] rounded-full animate-spin" />
                </div>
              ) : (
                <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] overflow-hidden">
                  <div className="grid grid-cols-12 gap-4 bg-[var(--bg-surface)] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] border-b-[0.5px] border-zinc-800">
                    <div className="col-span-1">ID</div>
                    <div className="col-span-3">Materia Prima</div>
                    <div className="col-span-4">Nivel de Stock</div>
                    <div className="col-span-2 text-right">Cantidad</div>
                    <div className="col-span-2 text-right">Estado</div>
                  </div>

                  {insumos.map((ins) => {
                    const pct = getStockPercent(ins);
                    const barColor = getBarColor(pct);
                    const status = getStatusLabel(pct);
                    return (
                      <div
                        key={ins.id}
                        className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b-[0.5px] border-zinc-800 last:border-b-0 hover:bg-[var(--bg-surface)] transition-colors"
                      >
                        <div className="col-span-1 text-[12px] font-mono text-[var(--text-dim)] font-normal">#{ins.id}</div>
                        <div className="col-span-3">
                          <p className="text-[13px] font-medium text-white">{ins.nombre}</p>
                          <p className="text-[10px] text-[var(--text-dim)] font-normal">{UNIT_LABELS[ins.unidad_medida] || ins.unidad_medida}</p>
                        </div>
                        <div className="col-span-4">
                          <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)] border-[0.5px] border-zinc-800">
                            <div
                              className={`absolute left-0 top-0 h-full rounded-full ${barColor} transition-all duration-300`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] text-[var(--text-dim)] font-mono font-normal">{pct.toFixed(1)}%</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <span className="text-[14px] font-medium text-white font-mono">{ins.stock_actual}</span>
                          <span className="text-[10px] text-[var(--text-dim)] ml-1 font-normal">{ins.unidad_medida}</span>
                        </div>
                        <div className="col-span-2 flex justify-end">
                          <span className={`inline-flex items-center rounded-full border-[0.5px] border-zinc-800 px-2.5 py-0.5 text-[10px] font-medium ${status.color}`}>
                            {status.text}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Tab: Turnos */}
            {activeTab === 'turnos' && (
              loadingTurnos ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-6 w-6 border-2 border-zinc-800 border-t-[var(--accent)] rounded-full animate-spin" />
                </div>
              ) : turnos.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-12 text-center">
                  <p className="text-[12px] text-[var(--text-dim)] font-normal">No hay turnos cerrados en el historial</p>
                </div>
              ) : (
                <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] overflow-hidden">
                  <div className="grid grid-cols-12 gap-3 bg-[var(--bg-surface)] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] border-b-[0.5px] border-zinc-800">
                    <div className="col-span-2">Operador</div>
                    <div className="col-span-3">Apertura / Cierre</div>
                    <div className="col-span-2 text-right">Efectivo Apertura</div>
                    <div className="col-span-2 text-right">Venta (Sist.)</div>
                    <div className="col-span-2 text-right">Arqueo Real</div>
                    <div className="col-span-1 text-right">Diferencia</div>
                  </div>

                  <div className="divide-y divide-zinc-800/60">
                    {turnos.map((t) => {
                      const operatorName = t.usuarios ? (Array.isArray(t.usuarios) ? t.usuarios[0]?.nombre : t.usuarios.nombre) : 'Desconocido';
                      const esperado = addDecimals(t.monto_apertura, t.ventas_calculadas, 2);
                      const diferencia = subtractDecimals(t.monto_cierre || '0.00', esperado, 2);
                      const diffFloat = parseFloat(diferencia);
                      
                      let diffColor = 'text-[var(--text-dim)]';
                      let diffText = '0.00';
                      let badgeColor = 'text-zinc-400 bg-zinc-500/10 border-zinc-800';
                      let badgeText = 'Ok';

                      if (diffFloat < 0) {
                        diffColor = 'text-rose-400';
                        diffText = `${diferencia}`;
                        badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-950';
                        badgeText = 'Faltante';
                      } else if (diffFloat > 0) {
                        diffColor = 'text-emerald-400';
                        diffText = `+${diferencia}`;
                        badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-950';
                        badgeText = 'Sobrante';
                      }

                      return (
                        <div key={t.id} className="grid grid-cols-12 gap-3 items-center px-5 py-4 hover:bg-[var(--bg-surface)] transition-colors">
                          <div className="col-span-2">
                            <p className="text-[13px] font-medium text-white">{operatorName}</p>
                            {t.notas_caja && (
                              <p className="text-[10px] text-[var(--text-dim)] font-normal truncate max-w-[150px]" title={t.notas_caja}>
                                {t.notas_caja}
                              </p>
                            )}
                          </div>
                          <div className="col-span-3 text-[10px] text-[var(--text-muted)] space-y-0.5 font-normal leading-normal">
                            <p>Apertura: {new Date(t.fecha_apertura).toLocaleString('es-BO')}</p>
                            <p>Cierre: {t.fecha_cierre ? new Date(t.fecha_cierre).toLocaleString('es-BO') : 'N/A'}</p>
                          </div>
                          <div className="col-span-2 text-right text-[12px] font-mono text-white font-normal">
                            {formatCurrency(t.monto_apertura)}
                          </div>
                          <div className="col-span-2 text-right text-[12px] font-mono text-[var(--text-muted)] font-normal">
                            {formatCurrency(t.ventas_calculadas)}
                          </div>
                          <div className="col-span-2 text-right text-[12px] font-mono text-[var(--accent-light)] font-normal">
                            {t.monto_cierre !== null ? formatCurrency(t.monto_cierre) : 'N/A'}
                          </div>
                          <div className="col-span-1 text-right flex flex-col items-end gap-1">
                            <span className={`text-[12px] font-mono ${diffColor}`}>{diffText}</span>
                            <span className={`inline-flex items-center rounded-full border-[0.5px] px-2 py-0.2 text-[8px] font-medium uppercase ${badgeColor}`}>
                              {badgeText}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}

      </div>
    </div>
  );
}
