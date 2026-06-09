'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePlanGuard } from '@/hooks/usePlanGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import { supabase } from '@/lib/supabase';
import { addDecimals, subtractDecimals, formatCurrency, safeParseFloat } from '@/lib/math';

export default function ClosurePage() {
  const { rol, empresaId, giro, logout } = useAuth();
  const router = useRouter();
  const { hasAccess: planPermiteTurnos } = usePlanGuard('medio');

  const [activeShift, setActiveShift] = useState<any | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [ventasCalculadas, setVentasCalculadas] = useState('0.00');
  
  // Arqueo de caja
  const [montoReal, setMontoReal] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [submittingClosure, setSubmittingClosure] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const fetchActiveShiftAndVentas = async () => {
    if (!rol || !giro || !planPermiteTurnos) return;
    try {
      setLoadingShift(true);
      setErrorMsg(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingShift(false);
        return;
      }

      // 1. Consultar el turno abierto del usuario actual
      const { data: shift, error: shiftError } = await supabase
        .from('turnos_personal')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('estado', 'Abierto')
        .maybeSingle();

      if (shiftError) throw shiftError;

      if (!shift) {
        setActiveShift(null);
        setLoadingShift(false);
        return;
      }

      setActiveShift(shift);

      // 2. Consultar pedidos pagados desde la apertura del turno
      const { data: orders, error: ordersError } = await supabase
        .from('pedidos')
        .select('total')
        .eq('empresa_id', empresaId)
        .eq('estado', 'Pagado')
        .gte('creado_at', shift.fecha_apertura);

      if (ordersError) throw ordersError;

      // Suma aritmética exacta usando math.ts
      let totalVentas = '0.00';
      if (orders) {
        orders.forEach((o) => {
          totalVentas = addDecimals(totalVentas, o.total || '0.00', 2);
        });
      }

      setVentasCalculadas(totalVentas);

    } catch (err: any) {
      console.error('Error al cargar datos del turno:', err);
      setErrorMsg('Error al conectar con la base de datos para cargar el turno.');
    } finally {
      setLoadingShift(false);
    }
  };

  useEffect(() => {
    fetchActiveShiftAndVentas();
  }, [rol, empresaId, giro, planPermiteTurnos]);

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const realVal = parseFloat(montoReal);
    if (isNaN(realVal) || realVal < 0) {
      setErrorMsg('Por favor ingrese un monto real en caja válido (mayor o igual a 0).');
      return;
    }

    try {
      setSubmittingClosure(true);
      setErrorMsg(null);

      // Guardar el cierre del turno actualizando la tabla turnos_personal
      const { error } = await supabase
        .from('turnos_personal')
        .update({
          fecha_cierre: new Date().toISOString(),
          monto_cierre: realVal,
          ventas_calculadas: parseFloat(ventasCalculadas),
          notas_caja: notasCierre ? `${activeShift.notas_caja || ''} | Cierre: ${notasCierre}` : activeShift.notas_caja,
          estado: 'Cerrado'
        })
        .eq('id', activeShift.id);

      if (error) throw error;

      // Cerrar sesión y redirigir
      await logout();
      router.push('/');

    } catch (err: any) {
      console.error('Error al cerrar turno:', err);
      setErrorMsg('Hubo un error al guardar el cierre de caja. Intente de nuevo.');
    } finally {
      setSubmittingClosure(false);
    }
  };

  // Guard de Plan para restringir acceso
  if (!planPermiteTurnos) {
    return (
      <div className="flex flex-1 flex-col bg-[var(--bg-base)] p-6 lg:p-8 justify-center items-center">
        <UpgradePrompt
          title="Módulo de Control de Turnos Restringido"
          message="El registro de apertura de caja, control de arqueos y diferencias financieras está disponible a partir del Plan Medio."
          requiredPlan="Medio"
        />
      </div>
    );
  }

  if (loadingShift) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--text-dim)] bg-[var(--bg-base)] text-[12px] font-normal">
        Cargando estado del turno activo…
      </div>
    );
  }

  if (!activeShift) {
    return (
      <div className="flex flex-1 flex-col bg-[var(--bg-base)] p-6 lg:p-8 items-center justify-center gap-4">
        <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-8 text-center max-w-md space-y-4">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 border-[0.5px] border-zinc-800 text-[var(--text-dim)]">
            🔒
          </div>
          <h3 className="text-[14px] font-medium text-white">No hay Turno Abierto</h3>
          <p className="text-[11px] text-[var(--text-dim)] font-normal leading-relaxed">
            No tienes un turno activo registrado. Para poder realizar transacciones y registrar arqueos, primero abre caja ingresando al Punto de Venta.
          </p>
          <button
            onClick={() => router.push('/pos')}
            className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-2 text-[12px] font-medium text-white hover:bg-[var(--accent-dark)] transition-all"
          >
            Ir al Punto de Venta
          </button>
        </div>
      </div>
    );
  }

  // Aritmética segura
  const montoApertura = activeShift.monto_apertura;
  const montoEsperado = addDecimals(montoApertura, ventasCalculadas, 2);
  const realValParsed = montoReal === '' ? '0.00' : parseFloat(montoReal).toFixed(2);
  const diferencia = subtractDecimals(realValParsed, montoEsperado, 2);
  const diffFloat = parseFloat(diferencia);

  let badgeColor = 'text-zinc-400 bg-zinc-500/10 border-zinc-800';
  let badgeLabel = 'Cuadrado';

  if (diffFloat < 0) {
    badgeColor = 'text-rose-400 bg-rose-500/10 border-rose-950';
    badgeLabel = 'Faltante';
  } else if (diffFloat > 0) {
    badgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-950';
    badgeLabel = 'Sobrante';
  }

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg-base)] overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="border-b-[0.5px] border-zinc-800 pb-5">
          <h1 className="text-[20px] font-medium text-[var(--text-primary)] tracking-tight">Cierre de Turno y Arqueo de Caja</h1>
          <p className="text-[12px] text-[var(--text-dim)] font-normal mt-1">
            Fecha de Apertura: {new Date(activeShift.fecha_apertura).toLocaleString('es-BO')}
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--danger)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--danger)] font-normal">
            {errorMsg}
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-12">
          
          {/* LEFT: Financial Summary */}
          <div className="md:col-span-7 rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6 space-y-5">
            <h3 className="text-[13px] font-medium text-white uppercase tracking-wider">Caja Calculada (Sistema)</h3>
            
            <div className="divide-y divide-zinc-800/60">
              
              <div className="flex justify-between py-3">
                <span className="text-[12px] text-[var(--text-muted)] font-normal">Efectivo Inicial (Apertura)</span>
                <span className="text-[13px] text-white font-mono">{formatCurrency(montoApertura)}</span>
              </div>
              
              <div className="flex justify-between py-3">
                <span className="text-[12px] text-[var(--text-muted)] font-normal">Ventas Totales del Turno (Pedidos Pagados)</span>
                <span className="text-[13px] text-[var(--accent-light)] font-mono">+{formatCurrency(ventasCalculadas)}</span>
              </div>

              <div className="flex justify-between py-4 pt-4 border-t-[0.5px] border-zinc-800">
                <span className="text-[13px] text-white font-medium">Monto Esperado en Caja</span>
                <span className="text-[15px] text-white font-mono font-medium">{formatCurrency(montoEsperado)}</span>
              </div>

            </div>

            <div className="rounded-[var(--radius-sm)] bg-[var(--bg-surface)] p-3 border-[0.5px] border-zinc-800">
              <p className="text-[11px] text-[var(--text-dim)] font-normal leading-relaxed">
                * Las ventas totales solo acumulan transacciones con estado &apos;Pagado&apos; realizadas desde la hora de apertura.
              </p>
            </div>
          </div>

          {/* RIGHT: Input Cash & Audit */}
          <div className="md:col-span-5 rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6 flex flex-col justify-between">
            <form onSubmit={handleCloseShift} className="space-y-5">
              <h3 className="text-[13px] font-medium text-white uppercase tracking-wider">Arqueo de Caja Físico</h3>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Monto Real en Caja (Efectivo Físico)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={montoReal}
                  onChange={(e) => setMontoReal(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-3.5 py-2.5 text-[14px] text-white focus:outline-none focus:border-[var(--accent)] font-normal font-mono text-right"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                  Notas de Cierre (Opcional)
                </label>
                <textarea
                  value={notasCierre}
                  onChange={(e) => setNotasCierre(e.target.value)}
                  placeholder="Detalles sobre el arqueo..."
                  rows={2}
                  className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-3.5 py-2 text-[12px] text-white focus:outline-none focus:border-[var(--accent)] font-normal resize-none"
                />
              </div>

              {/* Real-time audit result */}
              <div className="pt-3 border-t-[0.5px] border-zinc-800/80 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-[var(--text-dim)] font-normal uppercase">Diferencia</span>
                  <p className={`text-[16px] font-mono font-medium ${diffFloat < 0 ? 'text-rose-400' : diffFloat > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {diffFloat > 0 ? '+' : ''}{diferencia} BOB
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full border-[0.5px] px-3 py-1 text-[10px] font-medium uppercase tracking-wider ${badgeColor}`}>
                  {badgeLabel}
                </span>
              </div>

              <button
                type="submit"
                disabled={submittingClosure}
                className="w-full rounded-[var(--radius-sm)] bg-[var(--danger)] py-3.5 font-medium text-white text-[13px] transition-all hover:bg-red-700 active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-1.5"
              >
                {submittingClosure ? 'Cerrando Turno…' : '🔒 Finalizar y Cerrar Turno'}
              </button>
            </form>
          </div>

        </div>

      </div>
    </div>
  );
}
