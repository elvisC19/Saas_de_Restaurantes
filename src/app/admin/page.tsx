'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { InventarioInsumo } from '@/types/database';

export default function AdminPage() {
  const { rol, empresaId } = useAuth();
  const router = useRouter();

  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Proteger la ruta para administradores
  useEffect(() => {
    if (!rol) {
      router.push('/');
    }
  }, [rol, router]);

  // Cargar inventario desde Supabase
  const loadInventory = async () => {
    if (!rol) return;
    try {
      const { data, error } = await supabase
        .from('inventario_insumos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setInsumos(data || []);
    } catch (err: any) {
      console.error('Error al cargar inventario:', err);
      setErrorMsg('No se pudo cargar el stock actual de insumos.');
    } finally {
      setLoading(false);
    }
  };

  // Cargar inventario e inicializar Realtime
  useEffect(() => {
    if (!rol) return;

    loadInventory();

    // Suscripción en tiempo real a los cambios de inventario (actualizados por el Trigger SQL)
    const channel = supabase
      .channel('inventory-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventario_insumos', filter: `empresa_id=eq.${empresaId}` },
        (payload) => {
          console.log('Cambio de inventario detectado en Realtime:', payload);
          loadInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rol, empresaId]);

  // Función para reestablecer el stock a los valores semilla de Café Central Sucre
  const handleResetStock = async () => {
    setResetting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const defaultStocks = [
        { id: 1, stock: 5000.0000 },  // Café (5kg)
        { id: 2, stock: 10000.0000 }, // Leche (10L)
        { id: 3, stock: 3000.0000 },  // Azúcar (3kg)
        { id: 4, stock: 20000.0000 }, // Agua (20L)
        { id: 5, stock: 200.0000 }    // Tazas (200 un)
      ];

      for (const item of defaultStocks) {
        const { error } = await supabase
          .from('inventario_insumos')
          .update({ stock_actual: item.stock.toFixed(4) })
          .eq('id', item.id)
          .eq('empresa_id', empresaId);

        if (error) throw error;
      }

      setSuccessMsg('¡Stock restablecido a los valores semilla originales con éxito!');
      setTimeout(() => setSuccessMsg(null), 4000);
      loadInventory();
    } catch (err: any) {
      console.error('Error al reestablecer stock:', err);
      setErrorMsg('Error al reestablecer los valores de stock en la base de datos.');
    } finally {
      setResetting(false);
    }
  };

  // Determinar si el stock está bajo (menos de 500 para gramos/ml, o menos de 20 para unidades)
  const isStockBajo = (insumo: InventarioInsumo) => {
    const stock = parseFloat(insumo.stock_actual);
    if (insumo.unidad_medida === 'unidades') {
      return stock < 20;
    }
    return stock < 500;
  };

  if (!rol) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-zinc-400">
        Cargando privilegios de Administración...
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 p-6 overflow-hidden">
      {/* Cabecera */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            📦 Monitor de Inventario
            <span className="rounded-full bg-rose-500/10 border border-rose-500/25 px-2 py-0.5 text-xs font-semibold text-rose-400">
              Panel Administrativo
            </span>
          </h2>
          <p className="text-xs text-zinc-400">Control de materias primas con precisión de 4 decimales</p>
        </div>

        {/* Botones de acción rápida */}
        <button
          onClick={handleResetStock}
          disabled={resetting}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 transition-all hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          {resetting ? 'Reestableciendo...' : '🔄 Reestablecer Stock Semilla'}
        </button>
      </div>

      {/* Alertas */}
      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          ⚠️ {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-400">
          ✓ {successMsg}
        </div>
      )}

      {/* Leyenda Académica */}
      <div className="mb-6 rounded-2xl bg-zinc-900/40 border border-zinc-800 p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="max-w-2xl">
          <h4 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            🔬 Demostración del Trigger de PostgreSQL (Defensa Académica)
          </h4>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Esta pantalla se suscribe en tiempo real a la tabla <code>inventario_insumos</code>. Cuando el cajero activa el Webhook de Pago desde el POS, Supabase procesa el trigger en el servidor y actualiza los valores aquí de manera <strong>inmediata</strong>, mostrando la deducción por porción (ej. 18gr de café por taza) con precisión de punto fijo.
          </p>
        </div>
        <div className="rounded-lg bg-zinc-950 border border-zinc-850 px-3 py-2 text-center text-xs font-mono text-zinc-500">
          Trigger: trg_descontar_inventario
        </div>
      </div>

      {/* Tabla de Inventario */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-rose-500 border-t-transparent" />
        </div>
      ) : insumos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-zinc-850 bg-zinc-900/10">
          <span className="text-4xl mb-3">📦</span>
          <p className="text-sm text-zinc-400">No se encontraron insumos de inventario.</p>
          <p className="text-xs text-zinc-600 mt-1">Verifica que corriste el script de base de datos semilla.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto rounded-2xl border border-zinc-850 bg-zinc-900/10">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-850 bg-zinc-900/50 text-zinc-400 font-semibold text-xs uppercase tracking-wider">
                <th className="p-4">ID Insumo</th>
                <th className="p-4">Nombre de Materia Prima</th>
                <th className="p-4">Stock Físico Actual</th>
                <th className="p-4">Unidad de Medida</th>
                <th className="p-4">Estado de Abastecimiento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60">
              {insumos.map((ins) => {
                const bajo = isStockBajo(ins);
                return (
                  <tr
                    key={ins.id}
                    className="hover:bg-zinc-900/30 transition-colors duration-150"
                  >
                    <td className="p-4 font-mono text-zinc-500">#{ins.id}</td>
                    <td className="p-4 font-bold text-zinc-200">{ins.nombre}</td>
                    <td className="p-4 font-mono text-base font-semibold text-zinc-100">
                      {ins.stock_actual}
                    </td>
                    <td className="p-4">
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 border border-zinc-750">
                        {ins.unidad_medida}
                      </span>
                    </td>
                    <td className="p-4">
                      {bajo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/25 px-2.5 py-0.5 text-xs font-medium text-rose-400 animate-pulse">
                          ⚠️ Stock Crítico
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
                          ✓ Abastecido
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
