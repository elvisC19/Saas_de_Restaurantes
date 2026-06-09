'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { InventarioInsumo } from '@/types/database';
import { formatCurrency } from '@/lib/math';

// Umbrales de stock para barras de progreso (basados en la data semilla)
const STOCK_CAPS: Record<string, number> = {
  'Café en grano': 5000,
  'Leche entera': 10000,
  'Azúcar': 3000,
  'Agua purificada': 20000,
  'Taza descartable 8oz': 200,
};

const UNIT_LABELS: Record<string, string> = {
  gr: 'gramos',
  ml: 'mililitros',
  unidades: 'unidades',
};

export default function AdminPage() {
  const { rol, empresaId } = useAuth();
  const router = useRouter();

  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pedidosHoy, setPedidosHoy] = useState(0);
  const [ingresoHoy, setIngresoHoy] = useState('0.00');

  useEffect(() => {
    if (!rol) router.push('/');
  }, [rol, router]);

  const loadInventory = async () => {
    if (!rol) return;
    try {
      const { data, error } = await supabase
        .from('inventario_insumos')
        .select('*')
        .eq('empresa_id', empresaId)
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
    if (!rol) return;
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
    } catch {
      // silently fail KPIs
    }
  };

  useEffect(() => {
    if (!rol) return;
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
  }, [rol, empresaId]);

  const handleResetStock = async () => {
    setResetting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const defaults = [
        { id: 1, stock: '5000.0000' },
        { id: 2, stock: '10000.0000' },
        { id: 3, stock: '3000.0000' },
        { id: 4, stock: '20000.0000' },
        { id: 5, stock: '200.0000' },
      ];
      for (const item of defaults) {
        const { error } = await supabase
          .from('inventario_insumos')
          .update({ stock_actual: item.stock })
          .eq('id', item.id)
          .eq('empresa_id', empresaId);
        if (error) throw error;
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

  if (!rol) return <div className="flex flex-1 items-center justify-center text-zinc-500">Cargando…</div>;

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
    if (pct > 50) return { text: 'Óptimo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (pct > 20) return { text: 'Bajo', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { text: 'Crítico', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8 space-y-6">
        {/* ───── Header ───── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
            <p className="text-[12px] text-zinc-500 mt-0.5">Monitoreo de inventario y métricas operativas en tiempo real</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-semibold text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Realtime Activo
            </span>
            <button
              onClick={handleResetStock}
              disabled={resetting}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-semibold text-zinc-300 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
            >
              {resetting ? 'Reseteando…' : '↻ Reset Semilla'}
            </button>
          </div>
        </div>

        {/* ───── Alerts ───── */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 text-sm text-rose-400">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/5 p-3 text-sm text-emerald-400">{successMsg}</div>
        )}

        {/* ───── KPI Cards ───── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Ingresos Recaudados',
              value: formatCurrency(ingresoHoy),
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              gradient: 'from-emerald-500/10 to-teal-500/5',
              accentColor: 'text-emerald-400',
            },
            {
              label: 'Pedidos Procesados',
              value: `${pedidosHoy}`,
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
              ),
              gradient: 'from-indigo-500/10 to-violet-500/5',
              accentColor: 'text-indigo-400',
            },
            {
              label: 'Ítems en Menú',
              value: '2',
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
                </svg>
              ),
              gradient: 'from-amber-500/10 to-orange-500/5',
              accentColor: 'text-amber-400',
            },
            {
              label: 'Plan Activo',
              value: '280.00 Bs.',
              icon: (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              ),
              gradient: 'from-violet-500/10 to-fuchsia-500/5',
              accentColor: 'text-violet-400',
            },
          ].map((kpi, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-white/[0.04] bg-gradient-to-br ${kpi.gradient} p-5 animate-slide-up`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">{kpi.label}</span>
                <div className={`${kpi.accentColor} opacity-60`}>{kpi.icon}</div>
              </div>
              <p className={`mt-2 text-[1.7rem] font-extrabold text-white tracking-tight leading-none`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ───── Trigger Explanation ───── */}
        <div className="rounded-2xl border border-indigo-500/10 bg-gradient-to-r from-indigo-500/[0.03] to-violet-500/[0.02] p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="max-w-xl">
            <h3 className="text-[13px] font-bold text-white flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
              Trigger PostgreSQL — Inventario Automático
            </h3>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
              Al confirmar un pago en el POS, el trigger <code className="rounded bg-white/[0.05] px-1 py-0.5 text-indigo-400 text-[10px] font-mono">trg_descontar_inventario</code> descuenta las recetas del stock físico con precisión NUMERIC(12,4). Las barras de abajo se actualizan en tiempo real.
            </p>
          </div>
          <div className="shrink-0 rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 font-mono text-[10px] text-zinc-500">
            AFTER UPDATE ON pedidos
          </div>
        </div>

        {/* ───── Inventory Table with Progress Bars ───── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-[3px] border-zinc-800 border-t-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.04] overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 bg-white/[0.015] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 border-b border-white/[0.04]">
              <div className="col-span-1">ID</div>
              <div className="col-span-3">Materia Prima</div>
              <div className="col-span-4">Nivel de Stock</div>
              <div className="col-span-2 text-right">Cantidad</div>
              <div className="col-span-2 text-right">Estado</div>
            </div>

            {/* Table Body */}
            {insumos.map((ins, i) => {
              const pct = getStockPercent(ins);
              const barColor = getBarColor(pct);
              const status = getStatusLabel(pct);
              return (
                <div
                  key={ins.id}
                  className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b border-white/[0.02] hover:bg-white/[0.01] transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div className="col-span-1 text-[12px] font-mono text-zinc-600">#{ins.id}</div>
                  <div className="col-span-3">
                    <p className="text-[13px] font-semibold text-white">{ins.nombre}</p>
                    <p className="text-[10px] text-zinc-600">{UNIT_LABELS[ins.unidad_medida] || ins.unidad_medida}</p>
                  </div>
                  <div className="col-span-4">
                    <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`absolute left-0 top-0 h-full rounded-full ${barColor} transition-all duration-700 ease-out`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-600 font-mono">{pct.toFixed(1)}%</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-[14px] font-bold text-white font-mono">{ins.stock_actual}</span>
                    <span className="text-[10px] text-zinc-600 ml-1">{ins.unidad_medida}</span>
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${status.color}`}>
                      {status.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
