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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-[0.5px] border-[var(--border-default)] px-6 py-4">
          <div>
            <h3 className="text-[15px] font-medium text-[var(--text-primary)]">Cobro Digital — QR Simple</h3>
            <p className="text-[10px] text-[var(--text-dim)] font-normal mt-0.5">Interoperabilidad ASFI - Bolivia</p>
          </div>
          {!success && (
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-white transition-all text-[11px]"
              disabled={loading}
            >
              ✕
            </button>
          )}
        </div>

        <div className="p-6">
          {!success ? (
            <div className="space-y-5">
              {/* Order summary */}
              <div className="flex items-center justify-between rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-normal">Pedido</p>
                  <p className="text-[16px] font-medium text-[var(--accent)] mt-0.5">#{pedidoId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-normal">Total</p>
                  <p className="text-[18px] font-medium text-[var(--text-primary)] tracking-tight mt-0.5">{formatCurrency(total)}</p>
                </div>
              </div>

              {/* QR + JSON side by side */}
              <div className="grid gap-4 sm:grid-cols-2">
                {/* QR Centrado */}
                <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-white p-5">
                  <div className="relative flex h-28 w-28 items-center justify-center p-1">
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
                      <text x="50" y="54" fontSize="12" textAnchor="middle" fill="#1D9E75">G</text>
                    </svg>
                  </div>
                  <p className="mt-2 text-[9px] text-zinc-500 text-center uppercase tracking-wide leading-relaxed font-normal">
                    QR Simple Bolivia
                  </p>
                </div>

                {/* JSON payload */}
                <div className="flex flex-col">
                  <label className="text-[9px] uppercase tracking-wider text-[var(--text-dim)] font-normal mb-1">Payload ASFI</label>
                  <pre className="flex-1 rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-3 text-[9px] font-mono text-[var(--text-dim)] overflow-x-auto leading-relaxed">
                    {JSON.stringify(qrPayload, null, 2)}
                  </pre>
                </div>
              </div>

              {error && (
                <div className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--danger)] bg-[var(--bg-surface)] p-3 text-[12px] text-[var(--danger)] font-normal">
                  {error}
                </div>
              )}

              {/* Simulación Botón Primario */}
              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-3.5 font-medium text-white text-[13px] transition-all hover:bg-[var(--accent-dark)] active:scale-[0.98] disabled:opacity-40"
              >
                {loading ? 'Procesando Webhook…' : 'Simular Notificación de Pago (Webhook)'}
              </button>
            </div>
          ) : (
            /* Success State */
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-[0.5px] border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--accent)] text-lg">
                ✓
              </div>

              <div>
                <h4 className="text-[16px] font-medium text-white">Pago Confirmado</h4>
                <p className="text-[12px] text-[var(--text-muted)] mt-1.5 max-w-xs mx-auto leading-relaxed">
                  El estado del pedido cambió a <strong className="text-[var(--accent)] font-medium">Pagado</strong>. El trigger de PostgreSQL recalculó el inventario.
                </p>
              </div>

              <div className="w-full rounded-[var(--radius-md)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] p-4 text-left">
                <p className="text-[9px] uppercase tracking-wider text-[var(--accent)] font-medium mb-1">Base de Datos</p>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed font-normal">
                  El descuento de recetas fue aplicado de forma agrupada en insumos base con precisión decimal.
                </p>
              </div>

              <button
                onClick={handleFinalize}
                className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--accent)] bg-transparent px-4 py-3 text-[12px] font-medium text-[var(--accent)] transition-all hover:bg-[var(--accent-dark)] hover:text-white"
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
