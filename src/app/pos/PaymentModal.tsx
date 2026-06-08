'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/math';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pedidoId: number | null;
  total: string;
  onPaymentSuccess: () => void;
}

export default function PaymentModal({
  isOpen,
  onClose,
  pedidoId,
  total,
  onPaymentSuccess,
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !pedidoId) return null;

  // Formatear el JSON estándar de la ASFI para QR "Simple" de Bolivia
  const qrSimpleData = {
    globallyUniqueIdentifier: "bo.gob.asfi.qr.simple",
    merchantName: "Café Central Sucre",
    merchantCity: "Sucre",
    transactionAmount: total,
    transactionCurrency: "BOB",
    orderId: pedidoId,
    expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutos de expiración
    singleUse: true
  };

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Simular la llamada del Webhook actualizando el estado a 'Pagado' en Supabase.
      // Esto disparará automáticamente el Trigger 'trg_descontar_inventario' en PostgreSQL
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ estado: 'Pagado' })
        .eq('id', pedidoId);

      if (updateError) throw updateError;

      setSuccess(true);
    } catch (err: any) {
      console.error('Error al simular pago:', err);
      setError(err.message || 'Error al conectar con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = () => {
    onPaymentSuccess();
    onClose();
    // Restablecer el estado interno del modal
    setSuccess(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-5">
          <h3 className="text-lg font-bold text-zinc-100">
            💵 Simulación de Pago - Código QR "Simple"
          </h3>
          {!success && (
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200"
              disabled={loading}
            >
              ✕
            </button>
          )}
        </div>

        {/* Contenido Principal */}
        <div className="p-6">
          {!success ? (
            <div className="space-y-6">
              {/* Resumen del pedido */}
              <div className="rounded-xl bg-zinc-950 p-4 border border-zinc-800 flex justify-between items-center">
                <div>
                  <p className="text-xs text-zinc-500 uppercase font-semibold">Orden #</p>
                  <p className="text-xl font-bold text-amber-400">{pedidoId}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500 uppercase font-semibold">Total a Pagar</p>
                  <p className="text-2xl font-extrabold text-zinc-100">{formatCurrency(total)}</p>
                </div>
              </div>

              {/* QR Simulado & JSON */}
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Lado QR Visual */}
                <div className="flex flex-col items-center justify-center rounded-xl bg-white p-4">
                  <div className="relative flex h-40 w-40 items-center justify-center border-4 border-amber-500 rounded-lg p-1">
                    {/* Generamos un SVG que simula ser un QR estilizado comercialmente */}
                    <svg className="h-full w-full text-zinc-900" viewBox="0 0 100 100">
                      <rect width="100" height="100" fill="none" />
                      {/* Esquinas de posicionamiento (QR anchors) */}
                      <rect x="0" y="0" width="30" height="30" fill="currentColor" />
                      <rect x="5" y="5" width="20" height="20" fill="white" />
                      <rect x="10" y="10" width="10" height="10" fill="currentColor" />

                      <rect x="70" y="0" width="30" height="30" fill="currentColor" />
                      <rect x="75" y="5" width="20" height="20" fill="white" />
                      <rect x="80" y="10" width="10" height="10" fill="currentColor" />

                      <rect x="0" y="70" width="30" height="30" fill="currentColor" />
                      <rect x="5" y="75" width="20" height="20" fill="white" />
                      <rect x="10" y="80" width="10" height="10" fill="currentColor" />
                      
                      {/* Patrones de bits falsificados */}
                      <rect x="40" y="10" width="20" height="10" fill="currentColor" />
                      <rect x="40" y="25" width="10" height="15" fill="currentColor" />
                      <rect x="15" y="40" width="15" height="10" fill="currentColor" />
                      <rect x="35" y="45" width="25" height="10" fill="currentColor" />
                      <rect x="70" y="40" width="20" height="15" fill="currentColor" />
                      <rect x="10" y="55" width="20" height="10" fill="currentColor" />
                      <rect x="40" y="60" width="15" height="25" fill="currentColor" />
                      <rect x="70" y="65" width="25" height="15" fill="currentColor" />
                      <rect x="60" y="85" width="30" height="10" fill="currentColor" />
                      
                      {/* Mini logo de café en el centro */}
                      <rect x="42" y="42" width="16" height="16" fill="white" />
                      <text x="50" y="53" fontSize="12" textAnchor="middle" fill="currentColor">☕</text>
                    </svg>
                    
                    {/* Escribir un tag de Bolivia */}
                    <div className="absolute -bottom-2.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white shadow">
                      QR Simple - ASFI
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-zinc-500 text-center uppercase tracking-wide">
                    Escanea para pagar desde cualquier app bancaria de Bolivia (Simulado)
                  </p>
                </div>

                {/* Lado JSON Estándar ASFI */}
                <div className="flex flex-col justify-between">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 block mb-1">
                      Metadata de Interoperabilidad (ASFI JSON):
                    </label>
                    <pre className="text-[10px] font-mono bg-zinc-950 p-3 rounded-lg border border-zinc-800 text-zinc-400 overflow-x-auto max-h-44">
                      {JSON.stringify(qrSimpleData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  ⚠️ {error}
                </div>
              )}

              {/* Botón Simular Webhook */}
              <button
                onClick={handleSimulatePayment}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 px-4 py-3 font-semibold text-white transition-all hover:brightness-110 shadow-lg shadow-amber-950/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Procesando Webhook de Pago...
                  </>
                ) : (
                  <>
                    ⚡ Simular Notificación de Pago (Webhook)
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Pantalla de éxito */
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-3xl text-emerald-400 animate-bounce">
                ✓
              </div>
              <h4 className="text-xl font-bold text-zinc-100">
                ¡Pago Confirmado Exitosamente!
              </h4>
              <p className="text-sm text-zinc-400 max-w-sm">
                La notificación de pago (Webhook simulado) fue enviada. El estado del pedido se actualizó a <strong className="text-emerald-400">'Pagado'</strong>.
              </p>
              
              {/* Alerta explicativa de base de datos para la defensa */}
              <div className="w-full rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-4 text-left">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wide block mb-1">
                  ⚡ Consistencia Académica en Supabase:
                </span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  PostgreSQL detectó el estado <strong>'Pagado'</strong> y disparó el Trigger <code>trg_descontar_inventario</code>. El stock físico de materias primas ha sido recalculado y disminuido en base a las recetas enlazadas de manera exacta.
                </p>
              </div>

              <button
                onClick={handleFinalize}
                className="w-full rounded-xl bg-zinc-800 px-4 py-2.5 font-semibold text-zinc-100 hover:bg-zinc-700 transition-colors"
              >
                Cerrar y Limpiar Carrito
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
