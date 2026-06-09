'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { InventarioInsumo } from '@/types/database';
import { formatCurrency } from '@/lib/math';
import { usePlanGuard } from '@/hooks/usePlanGuard';
import UpgradePrompt from '@/components/UpgradePrompt';

// Umbrales de stock para barras de progreso
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

  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pedidosHoy, setPedidosHoy] = useState(0);
  const [ingresoHoy, setIngresoHoy] = useState('0.00');
  const [itemsMenuCount, setItemsMenuCount] = useState(0);

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const loadInventory = async () => {
    if (!rol || !giro) return;
    try {
      const { data, error } = await supabase
        .from('inventario_insumos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('id', { ascending: true });
      if (error) throw error;
      
      const allInsumos = data || [];
      const filtered = allInsumos.filter((ins) => {
        if (giro === 'RESTAURANTE') {
          return ins.nombre === 'Lomo de res' || ins.nombre === 'Papas' || ins.nombre === 'Arroz' || ins.nombre === 'Aceite' || ins.nombre === 'Huevo';
        } else {
          // CAFETERIA
          return ins.nombre === 'Café en grano' || ins.nombre === 'Leche entera' || ins.nombre === 'Azúcar' || ins.nombre === 'Agua purificada' || ins.nombre === 'Taza descartable 8oz';
        }
      });
      setInsumos(filtered);
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

      // Obtener cantidad de productos filtrados del giro activo
      const { data: itemsData } = await supabase
        .from('items_menu')
        .select('nombre')
        .eq('empresa_id', empresaId);
      
      if (itemsData) {
        const filteredCount = itemsData.filter((item) => {
          if (giro === 'RESTAURANTE') {
            return item.nombre === 'Lomo Saltado' || item.nombre === 'Sopa de Maní';
          } else {
            return item.nombre === 'Café Americano' || item.nombre === 'Café con Leche' || item.nombre === 'Café Espresso' || item.nombre === 'Capuccino';
          }
        }).length;
        setItemsMenuCount(filteredCount);
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
        .eq('empresa_id', empresaId);

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
    if (pct > 50) return 'bg-[var(--accent)]';
    if (pct > 20) return 'bg-[var(--warn)]';
    return 'bg-[var(--danger)]';
  };

  const getStatusLabel = (pct: number) => {
    if (pct > 50) return { text: 'Óptimo', color: 'text-[var(--accent-light)] bg-[var(--accent-dark)] border-[var(--border-default)]' };
    if (pct > 20) return { text: 'Bajo', color: 'text-[var(--warn)] bg-[var(--bg-surface)] border-[var(--border-default)]' };
    return { text: 'Crítico', color: 'text-[var(--danger)] bg-[var(--bg-surface)] border-[var(--border-default)]' };
  };

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg-base)] overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8 space-y-6">
        
        {/* ───── Header con Nombre de Negocio y Plan Badge ───── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-[0.5px] border-[var(--border-default)] pb-5">
          <div className="flex flex-col gap-1">
            <h1 className="text-[20px] font-medium text-[var(--text-primary)] tracking-tight">{empresaNombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] text-[var(--text-dim)] font-normal">Plan contratado:</span>
              <span className="rounded-full border-[0.5px] border-[var(--border-default)] bg-[var(--accent-dark)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent-light)] uppercase tracking-wider">
                {plan === 'premium' ? 'Premium' : plan === 'medio' ? 'Medio' : 'Básico'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-3 py-1 text-[11px] font-normal text-[var(--accent-light)]">
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
              className="rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] p-5"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-dim)]">{kpi.label}</span>
              <p className="mt-2 text-[24px] font-medium text-[var(--accent)] tracking-tight leading-none">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ───── PostgreSQL explanation ───── */}
        <div className="rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="max-w-xl">
            <h3 className="text-[13px] font-medium text-white flex items-center gap-2">
              Trigger PostgreSQL — Inventario Automático
            </h3>
            <p className="text-[11px] text-[var(--text-dim)] mt-1 leading-relaxed font-normal">
              Al confirmar un pago en el POS, el trigger calcula las reducciones agrupadas de insumos base usando tipos NUMERIC precisos para evitar mermas financieras.
            </p>
          </div>
          <div className="shrink-0 rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] px-3 py-2 font-mono text-[10px] text-[var(--text-dim)] font-normal">
            AFTER UPDATE ON pedidos
          </div>
        </div>

        {/* ───── Inventory Table with Progress Bars ───── */}
        {!hasAccess ? (
          <UpgradePrompt />
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 bg-[var(--bg-surface)] px-5 py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] border-b-[0.5px] border-[var(--border-default)]">
              <div className="col-span-1">ID</div>
              <div className="col-span-3">Materia Prima</div>
              <div className="col-span-4">Nivel de Stock</div>
              <div className="col-span-2 text-right">Cantidad</div>
              <div className="col-span-2 text-right">Estado</div>
            </div>

            {/* Table Body */}
            {insumos.map((ins) => {
              const pct = getStockPercent(ins);
              const barColor = getBarColor(pct);
              const status = getStatusLabel(pct);
              return (
                <div
                  key={ins.id}
                  className="grid grid-cols-12 gap-4 items-center px-5 py-4 border-b-[0.5px] border-[var(--border-default)] last:border-b-0 hover:bg-[var(--bg-surface)] transition-colors"
                >
                  <div className="col-span-1 text-[12px] font-mono text-[var(--text-dim)] font-normal">#{ins.id}</div>
                  <div className="col-span-3">
                    <p className="text-[13px] font-medium text-white">{ins.nombre}</p>
                    <p className="text-[10px] text-[var(--text-dim)] font-normal">{UNIT_LABELS[ins.unidad_medida] || ins.unidad_medida}</p>
                  </div>
                  <div className="col-span-4">
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)] border-[0.5px] border-[var(--border-default)]">
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
                    <span className={`inline-flex items-center rounded-full border-[0.5px] px-2.5 py-0.5 text-[10px] font-medium ${status.color}`}>
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
