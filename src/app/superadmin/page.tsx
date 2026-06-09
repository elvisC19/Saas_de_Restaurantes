'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/math';

interface SuperAdminEmpresa {
  id: number;
  nombre: string;
  plan_mensual: string;
  plan_suscripcion?: 'Basico' | 'Medio' | 'Premium';
  estado_cuenta?: 'Activo' | 'Suspendido' | 'Demo';
  subdominio?: string;
  total_licencias?: number;
  nit?: string;
  creado_at?: string;
}

interface SaaSMetrics {
  totalTenants: number;
  activeTenants: number;
  mrr: number;
  gmv: number;
}

export default function SuperAdminPage() {
  const { rol, loading: authLoading } = useAuth();
  const router = useRouter();

  const [empresas, setEmpresas] = useState<SuperAdminEmpresa[]>([]);
  const [metrics, setMetrics] = useState<SaaSMetrics>({
    totalTenants: 0,
    activeTenants: 0,
    mrr: 0,
    gmv: 0,
  });
  const [loadingList, setLoadingList] = useState(true);

  // Form State
  const [nombre, setNombre] = useState('');
  const [nit, setNit] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [plan, setPlan] = useState<'Basico' | 'Medio' | 'Premium'>('Basico');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Redirección si no es SuperAdmin
  useEffect(() => {
    if (!authLoading && rol !== 'SuperAdmin') {
      router.push('/');
    }
  }, [rol, authLoading, router]);

  const loadEmpresas = async () => {
    try {
      const { data, error } = await supabase
        .from('empresas')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setEmpresas(data || []);
    } catch (err) {
      console.error('Error al cargar empresas:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const res = await fetch('/api/superadmin/metrics');
      const data = await res.json();
      if (res.ok && data.success) {
        setMetrics({
          totalTenants: data.totalTenants,
          activeTenants: data.activeTenants,
          mrr: data.mrr,
          gmv: data.gmv,
        });
      }
    } catch (err) {
      console.error('Error al cargar métricas de SaaS:', err);
    }
  };

  useEffect(() => {
    if (rol === 'SuperAdmin') {
      loadEmpresas();
      loadMetrics();
    }
  }, [rol]);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !nit) {
      setErrorMsg('Por favor completa los campos obligatorios.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const computedSubdomain = subdomain.trim() || nombre.toLowerCase().replace(/[^a-z0-9]/g, '');
      const planVal = plan === 'Premium' ? 450.00 : plan === 'Medio' ? 280.00 : 140.00;

      const { error } = await supabase
        .from('empresas')
        .insert({
          nombre: nombre.trim(),
          nit: nit.trim(),
          subdominio: computedSubdomain,
          plan_suscripcion: plan,
          estado_cuenta: 'Activo',
          plan_mensual: planVal
        });

      if (error) throw error;

      setSuccessMsg(`Empresa "${nombre}" registrada con éxito.`);
      setNombre('');
      setNit('');
      setSubdomain('');
      setPlan('Basico');
      
      await loadEmpresas();
      await loadMetrics();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la empresa.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdatePlan = async (id: number, newPlan: 'Basico' | 'Medio' | 'Premium') => {
    try {
      const planVal = newPlan === 'Premium' ? 450.00 : newPlan === 'Medio' ? 280.00 : 140.00;
      const { error } = await supabase
        .from('empresas')
        .update({
          plan_suscripcion: newPlan,
          plan_mensual: planVal
        })
        .eq('id', id);

      if (error) throw error;
      await loadEmpresas();
      await loadMetrics();
    } catch (err: any) {
      console.error('Error al mutar plan en caliente:', err);
    }
  };

  const handleUpdateEstado = async (id: number, newEstado: 'Activo' | 'Suspendido' | 'Demo') => {
    try {
      const { error } = await supabase
        .from('empresas')
        .update({
          estado_cuenta: newEstado
        })
        .eq('id', id);

      if (error) throw error;
      await loadEmpresas();
      await loadMetrics();
    } catch (err: any) {
      console.error('Error al mutar estado de cuenta en caliente:', err);
    }
  };

  if (authLoading || rol !== 'SuperAdmin') {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-zinc-950 text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-[12px] font-normal">Verificando credenciales de SuperAdmin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8 space-y-6">
        
        {/* Header con Indicador de Red Activo */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-[0.5px] border-zinc-800 pb-5">
          <div>
            <h1 className="text-[20px] font-medium text-white tracking-tight flex items-center gap-2">
              Consola Maestra Global
              <span className="rounded-full border-[0.5px] border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-medium text-emerald-400 uppercase tracking-wider">
                SuperAdmin
              </span>
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Indicador de Red Activo con ping animado doble */}
            <div className="flex items-center gap-2 rounded-full border-[0.5px] border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-normal text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Red Activa</span>
            </div>
            
            <button 
              onClick={() => { loadEmpresas(); loadMetrics(); }}
              className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white transition-all"
            >
              Actualizar Consola
            </button>
          </div>
        </div>

        {/* Grid de KPIs SuperAdmin */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Inquilinos Totales', value: `${metrics.totalTenants}` },
            { label: 'Suscripciones Activas', value: `${metrics.activeTenants}` },
            { label: 'MRR Consolidado', value: formatCurrency(metrics.mrr) },
            { label: 'GMV Ventas Gastro', value: formatCurrency(metrics.gmv) },
          ].map((kpi, i) => (
            <div
              key={i}
              className="rounded-[var(--radius-md)] border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5"
            >
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">{kpi.label}</span>
              <p className="mt-2 text-[22px] font-medium text-[var(--accent)] tracking-tight leading-none">{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Dos columnas de Gestión */}
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Tabla de Gestión de Tenants */}
          <div className="lg:col-span-8 flex flex-col rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-5 py-4 border-b-[0.5px] border-zinc-800 bg-zinc-900/10">
              <h2 className="text-[13px] font-medium text-white uppercase tracking-wider">
                Gestión de Tenants
              </h2>
            </div>

            <div className="flex-1 overflow-x-auto">
              {loadingList ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-6 w-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
                </div>
              ) : empresas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-600">
                  <p className="text-[12px] font-normal">No hay empresas registradas.</p>
                </div>
              ) : (
                <table className="w-full text-[12px] border-collapse text-left">
                  <thead>
                    <tr className="border-b-[0.5px] border-zinc-800 bg-zinc-900/20 text-zinc-500 font-medium uppercase tracking-wider text-[9px]">
                      <th className="px-5 py-3 font-medium">ID</th>
                      <th className="px-5 py-3 font-medium">Razón Social</th>
                      <th className="px-5 py-3 font-medium">NIT</th>
                      <th className="px-5 py-3 font-medium">Subdominio</th>
                      <th className="px-5 py-3 font-medium">Plan</th>
                      <th className="px-5 py-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-[0.5px] divide-zinc-800">
                    {empresas.map((emp) => (
                      <tr key={emp.id} className="hover:bg-zinc-900/35 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-zinc-500">#{emp.id}</td>
                        <td className="px-5 py-3.5 text-white font-medium">{emp.nombre}</td>
                        <td className="px-5 py-3.5 text-zinc-400 font-normal">{emp.nit || '—'}</td>
                        <td className="px-5 py-3.5 text-zinc-400 font-normal font-mono">{emp.subdominio || '—'}</td>
                        <td className="px-5 py-3.5">
                          <select
                            value={emp.plan_suscripcion || 'Basico'}
                            onChange={(e) => handleUpdatePlan(emp.id, e.target.value as any)}
                            className="bg-zinc-950 border-[0.5px] border-zinc-800 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] text-[var(--accent-light)] font-normal outline-none focus:border-[var(--accent)]"
                          >
                            <option value="Basico">Básico (140 BOB)</option>
                            <option value="Medio">Medio (280 BOB)</option>
                            <option value="Premium">Premium (450 BOB)</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5">
                          <select
                            value={emp.estado_cuenta || 'Activo'}
                            onChange={(e) => handleUpdateEstado(emp.id, e.target.value as any)}
                            className={`bg-zinc-950 border-[0.5px] border-zinc-800 rounded-[var(--radius-sm)] px-2 py-1 text-[11px] font-normal outline-none focus:border-[var(--accent)] ${
                              emp.estado_cuenta === 'Activo'
                                ? 'text-emerald-400'
                                : emp.estado_cuenta === 'Suspendido'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                            }`}
                          >
                            <option value="Activo">🟢 Activo</option>
                            <option value="Suspendido">🔴 Suspendido</option>
                            <option value="Demo">🟡 Demo</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Formulario Lateral de Aprovisionamiento */}
          <div className="lg:col-span-4 rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-zinc-900/40 p-6 flex flex-col justify-between">
            <div>
              <h2 className="text-[13px] font-medium text-white uppercase tracking-wider mb-5">
                Aprovisionar Tenant
              </h2>

              {errorMsg && (
                <div className="mb-4 rounded-[var(--radius-sm)] border-[0.5px] border-rose-500/10 bg-rose-500/5 px-4 py-3 text-[12px] text-rose-400 font-normal">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="mb-4 rounded-[var(--radius-sm)] border-[0.5px] border-emerald-500/10 bg-emerald-500/5 px-4 py-3 text-[12px] text-emerald-400 font-normal">
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleCreateTenant} className="space-y-4">
                <div>
                  <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Restaurante Central"
                    className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[12px] text-white outline-none focus:border-[var(--accent)] placeholder-zinc-700"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">
                    NIT
                  </label>
                  <input
                    type="text"
                    required
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    placeholder="1020304050"
                    className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[12px] text-white outline-none focus:border-[var(--accent)] placeholder-zinc-700"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">
                    Subdominio (Opcional)
                  </label>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="central"
                    className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[12px] text-white outline-none focus:border-[var(--accent)] placeholder-zinc-700 font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">
                    Plan Inicial
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[12px] text-white outline-none focus:border-[var(--accent)] font-normal"
                  >
                    <option value="Basico">Básico (140 BOB)</option>
                    <option value="Medio">Medio (280 BOB)</option>
                    <option value="Premium">Premium (450 BOB)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-3 text-[12px] font-medium text-white transition-all hover:bg-[var(--accent-dark)] active:scale-[0.98] disabled:opacity-40"
                >
                  {submitting ? 'Aprovisionando...' : 'Crear Inquilino'}
                </button>
              </form>
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}
