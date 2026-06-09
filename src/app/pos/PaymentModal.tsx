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

export default function PaymentModal({ isOpen, onClose, pedidoId, total, onPaymentSuccess }: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !pedidoId) return null;

  const qrPayload = {
    globallyUniqueIdentifier: 'bo.gob.asfi.qr.simple',
    merchantName: 'Café Central Sucre',
    merchantCity: 'Sucre',
    transactionAmount: total,
    transactionCurrency: 'BOB',
    orderId: pedidoId,
    expirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    singleUse: true,
  };

  const handlePay = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('pedidos').update({ estado: 'Pagado' }).eq('id', pedidoId);
      if (err) throw err;
      setSuccess(true);
    } catch (e: any) {
      setError(e.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = () => {
    onPaymentSuccess();
    onClose();
    setSuccess(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.06] bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
          <div>
            <h3 className="text-[15px] font-bold text-white">Cobro Digital — QR Simple</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">Interoperabilidad ASFI - Bolivia</p>
          </div>
          {!success && (
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all" disabled={loading}>
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="p-6">
          {!success ? (
            <div className="space-y-5">
              {/* Order summary */}
              <div className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pedido</p>
                  <p className="text-xl font-extrabold text-indigo-400">#{pedidoId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total</p>
                  <p className="text-2xl font-extrabold text-white tracking-tight">{formatCurrency(total)}</p>
                </div>
              </div>

              {/* QR + JSON side by side */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* QR Visual */}
                <div className="flex flex-col items-center justify-center rounded-xl bg-white p-5">
                  <div className="relative flex h-32 w-32 items-center justify-center rounded-lg border-2 border-indigo-500 p-1">
                    <svg className="h-full w-full text-zinc-900" viewBox="0 0 100 100">
                      <rect x="0" y="0" width="28" height="28" fill="currentColor" />
                      <rect x="4" y="4" width="20" height="20" fill="white" />
                      <rect x="8" y="8" width="12" height="12" fill="currentColor" />
                      <rect x="72" y="0" width="28" height="28" fill="currentColor" />
                      <rect x="76" y="4" width="20" height="20" fill="white" />
                      <rect x="80" y="8" width="12" height="12" fill="currentColor" />
                      <rect x="0" y="72" width="28" height="28" fill="currentColor" />
                      <rect x="4" y="76" width="20" height="20" fill="white" />
                      <rect x="8" y="80" width="12" height="12" fill="currentColor" />
                      <rect x="36" y="8" width="8" height="12" fill="currentColor" />
                      <rect x="50" y="8" width="14" height="8" fill="currentColor" />
                      <rect x="36" y="26" width="14" height="8" fill="currentColor" />
                      <rect x="56" y="26" width="8" height="14" fill="currentColor" />
                      <rect x="12" y="36" width="16" height="8" fill="currentColor" />
                      <rect x="36" y="40" width="28" height="8" fill="currentColor" />
                      <rect x="72" y="36" width="18" height="10" fill="currentColor" />
                      <rect x="8" y="52" width="20" height="8" fill="currentColor" />
                      <rect x="36" y="56" width="12" height="28" fill="currentColor" />
                      <rect x="72" y="60" width="20" height="12" fill="currentColor" />
                      <rect x="56" y="80" width="34" height="8" fill="currentColor" />
                      <rect x="42" y="42" width="16" height="16" fill="white" />
                      <text x="50" y="54" fontSize="12" textAnchor="middle" fill="#4f46e5">G</text>
                    </svg>
                    <div className="absolute -bottom-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[8px] font-bold text-white shadow-lg">
                      QR Simple
                    </div>
                  </div>
                  <p className="mt-3 text-[9px] text-zinc-500 text-center uppercase tracking-wide leading-relaxed">
                    Escanea con cualquier app bancaria (Simulado)
                  </p>
                </div>

                {/* JSON payload */}
                <div className="flex flex-col">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Payload ASFI</label>
                  <pre className="flex-1 rounded-xl border border-white/[0.04] bg-zinc-950 p-3 text-[9px] font-mono text-zinc-500 overflow-x-auto leading-relaxed">
                    {JSON.stringify(qrPayload, null, 2)}
                  </pre>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-rose-500/10 bg-rose-500/5 p-3 text-[12px] text-rose-400">{error}</div>
              )}

              {/* CTA */}
              <button
                onClick={handlePay}
                disabled={loading}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3.5 font-bold text-white shadow-xl shadow-indigo-500/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Procesando Webhook…
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    Simular Notificación de Pago (Webhook)
                  </span>
                )}
              </button>
            </div>
          ) : (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald-400/20 animate-pulse-ring" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10">
                  <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-bold text-white">Pago Confirmado</h4>
                <p className="text-[12px] text-zinc-500 mt-1 max-w-xs mx-auto">
                  El estado del pedido cambió a <strong className="text-emerald-400">Pagado</strong>. El trigger de PostgreSQL recalculó el inventario.
                </p>
              </div>

              <div className="w-full rounded-xl border border-emerald-500/10 bg-emerald-500/[0.03] p-4 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Base de Datos</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  <code className="rounded bg-white/[0.04] px-1 py-0.5 text-emerald-400 text-[10px] font-mono">trg_descontar_inventario</code> se ejecutó exitosamente. El stock físico fue decrementado con precisión NUMERIC(12,4).
                </p>
              </div>

              <button
                onClick={handleFinalize}
                className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 font-semibold text-white transition-all hover:bg-white/[0.06]"
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
