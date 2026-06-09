'use client';

import React, { useState } from 'react';
import { formatCurrency } from '@/lib/math';

interface UpgradePromptProps {
  title?: string;
  message?: string;
  requiredPlan?: 'Medio' | 'Premium';
}

export default function UpgradePrompt({
  title = 'Función Restringida',
  message = 'El control físico de materias primas y monitor de inventario está disponible a partir del Plan Medio.',
  requiredPlan = 'Medio'
}: UpgradePromptProps = {}) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const plans = [
    {
      name: 'Plan Básico',
      price: '140.00',
      description: 'Ideal para iniciar operaciones básicas de venta rápida.',
      features: [
        'Acceso al Punto de Venta (POS) comercial',
        'Generación de comandas digitales',
        'Cobro mediante QR Simple interoperable'
      ],
      border: 'border-[var(--border-default)] bg-[var(--bg-surface)]',
      badge: 'Básico'
    },
    {
      name: 'Plan Medio',
      price: '280.00',
      description: 'Perfecto para negocios que buscan integrar su cocina e inventarios.',
      features: [
        'Todo lo del Plan Básico',
        'Pantalla de Cocina KDS en tiempo real',
        'Monitor de inventarios físico de materias primas'
      ],
      border: requiredPlan === 'Medio' ? 'border-[var(--accent-dark)] bg-[var(--bg-surface)]' : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
      badge: 'Popular',
      badgeClass: 'text-[var(--accent-light)] border-[var(--border-default)] bg-[var(--accent-dark)]'
    },
    {
      name: 'Plan Premium',
      price: '450.00',
      description: 'Solución empresarial absoluta para franquicias y alto rendimiento.',
      features: [
        'Todo lo del Plan Medio',
        'Métricas avanzadas de costo de recetas',
        'Control de tenants ilimitado',
        'Auditoría y soporte prioritario 24/7'
      ],
      border: requiredPlan === 'Premium' ? 'border-[var(--accent-dark)] bg-[var(--bg-surface)]' : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
      badge: 'Elite',
      badgeClass: 'text-[var(--accent-light)] border-[var(--border-default)] bg-[var(--accent-dark)]'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] rounded-[var(--radius-lg)] py-14 max-w-2xl mx-auto w-full">
      {/* Icon lock */}
      <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border-[0.5px] border-[var(--danger)] bg-[var(--bg-surface)] text-[var(--danger)] text-lg mb-4">
        🔒
      </div>
      <h3 className="text-[16px] font-medium text-white tracking-wide">{title}</h3>
      <p className="text-[var(--text-dim)] text-[12px] mt-1.5 max-w-sm leading-relaxed font-normal">
        {message}
      </p>
      
      <button
        onClick={() => setIsModalOpen(true)}
        className="mt-5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 py-2.5 text-[12px] font-medium text-white transition-all hover:bg-[var(--accent-dark)] active:scale-[0.98]"
      >
        Ver Planes Disponibles
      </button>

      {/* Modal Comparativo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-[0.5px] border-[var(--border-default)] px-6 py-4 bg-[var(--bg-surface)]">
              <div>
                <h3 className="text-[15px] font-medium text-white">Planes de Suscripción</h3>
                <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-normal">Compara las características y escala tu negocio cuando lo necesites</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Plan Cards) */}
            <div className="p-6 grid gap-4 md:grid-cols-3 bg-[var(--bg-base)]">
              {plans.map((p, i) => (
                <div key={i} className={`flex flex-col justify-between p-5 rounded-[var(--radius-md)] border-[0.5px] ${p.border} transition-all`}>
                  <div>
                    {/* Badge */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-dim)]">{p.badge}</span>
                      {p.badgeClass && (
                        <span className={`rounded-full border-[0.5px] px-2 py-0.5 text-[8px] font-medium uppercase ${p.badgeClass}`}>
                          {p.badge}
                        </span>
                      )}
                    </div>
                    
                    <h4 className="text-[14px] font-medium text-white">{p.name}</h4>
                    <p className="mt-2 text-[var(--text-muted)] text-[11px] leading-relaxed min-h-[40px] font-normal">{p.description}</p>
                    
                    {/* Features */}
                    <ul className="mt-4 space-y-2">
                      {p.features.map((f, fi) => (
                        <li key={fi} className="flex items-start gap-1.5 text-[11px] text-[var(--text-dim)] leading-normal font-normal">
                          <span className="text-[var(--accent)] text-[12px] shrink-0">✓</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Price */}
                  <div className="mt-6 pt-4 border-t-[0.5px] border-[var(--border-default)]">
                    <p className="text-[8px] font-medium uppercase tracking-wider text-[var(--text-dim)]">Precio Mensual</p>
                    <p className="text-[16px] font-medium text-[var(--accent)] tracking-tight mt-0.5">
                      {formatCurrency(p.price)} <span className="text-[10px] font-normal text-[var(--text-dim)]">/mes</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2 text-[12px] font-medium text-white transition-all hover:bg-[var(--bg-card)]"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
