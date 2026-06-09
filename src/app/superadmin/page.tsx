'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Empresa } from '@/types/database';
import { formatCurrency } from '@/lib/math';

export default function SuperAdminPage() {
  const { rol, loading: authLoading } = useAuth();
  const router = useRouter();

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form State
  const [nombre, setNombre] = useState('');
  const [giro, setGiro] = useState<'CAFETERIA' | 'RESTAURANTE'>('CAFETERIA');
  const [plan, setPlan] = useState<'Basico' | 'Medio' | 'Premium'>('Basico');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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
    setLoadingList(true);
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

  useEffect(() => {
    if (rol === 'SuperAdmin') {
      loadEmpresas();
    }
  }, [rol]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !email || !password) {
      setErrorMsg('Por favor completa todos los campos requeridos.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/superadmin/create-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre,
          giro,
          plan,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fallo al crear la empresa.');
      }

      setSuccessMsg(`Empresa "${nombre}" registrada con éxito.`);
      setNombre('');
      setEmail('');
      setPassword('');
      setPlan('Basico');
      setGiro('CAFETERIA');
      
      // Recargar lista
      loadEmpresas();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de red.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || rol !== 'SuperAdmin') {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-zinc-950 text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-[3px] border-zinc-800 border-t-purple-500 animate-spin" />
          <span className="text-xs">Verificando credenciales de SuperAdmin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-950 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/[0.04] pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Panel de Control SuperAdmin
              <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                SaaS Owner
              </span>
            </h1>
            <p className="text-[12px] text-zinc-500 mt-0.5">Gestión global de inquilinos (Tenants), planes de facturación y giros comerciales</p>
          </div>
        </div>

        {/* Dos columnas principales */}
        <div className="grid gap-6 lg:grid-cols-12">
          
          {/* Columna Izquierda: Formulario */}
          <div className="lg:col-span-5 rounded-2xl border border-white/[0.04] bg-white/[0.01] p-6 backdrop-blur-xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Registrar Inquilino Nuevo
            </h2>

            {errorMsg && (
              <div className="mb-4 rounded-xl border border-rose-500/15 bg-rose-500/5 px-4 py-3 text-xs text-rose-400">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-400">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">
                  Nombre del Negocio
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Café Imperial"
                  className="w-full rounded-xl border border-white/[0.06] bg-zinc-950 px-4 py-2.5 text-[13px] text-white outline-none transition-all focus:border-purple-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">
                    Giro Comercial
                  </label>
                  <select
                    value={giro}
                    onChange={(e) => setGiro(e.target.value as any)}
                    className="w-full rounded-xl border border-white/[0.06] bg-zinc-950 px-3 py-2.5 text-[13px] text-white outline-none transition-all focus:border-purple-500/40"
                  >
                    <option value="CAFETERIA">☕ Cafetería</option>
                    <option value="RESTAURANTE">🍽️ Restaurante</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">
                    Plan Mensual
                  </label>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value as any)}
                    className="w-full rounded-xl border border-white/[0.06] bg-zinc-950 px-3 py-2.5 text-[13px] text-white outline-none transition-all focus:border-purple-500/40"
                  >
                    <option value="Basico">Básico (140 BOB)</option>
                    <option value="Medio">Medio (280 BOB)</option>
                    <option value="Premium">Premium (450 BOB)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">
                  Correo Electrónico Administrador
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@negocio.com"
                  className="w-full rounded-xl border border-white/[0.06] bg-zinc-950 px-4 py-2.5 text-[13px] text-white outline-none transition-all focus:border-purple-500/40"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500 block mb-1.5">
                  Contraseña Temporal
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/[0.06] bg-zinc-950 px-4 py-2.5 text-[13px] text-white outline-none transition-all focus:border-purple-500/40"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 py-3 text-xs font-bold text-white shadow-xl shadow-purple-500/10 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Creando infraestructura...
                  </span>
                ) : (
                  'Registrar Empresa y Admin'
                )}
              </button>
            </form>
          </div>

          {/* Columna Derecha: Tabla de empresas */}
          <div className="lg:col-span-7 flex flex-col rounded-2xl border border-white/[0.04] bg-white/[0.01] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.04] bg-white/[0.005] flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                Empresas Registradas ({empresas.length})
              </h2>
              <button 
                onClick={loadEmpresas}
                className="text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Actualizar ↻
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[400px]">
              {loadingList ? (
                <div className="flex items-center justify-center h-full py-20">
                  <div className="h-6 w-6 rounded-full border-2 border-zinc-850 border-t-purple-500 animate-spin" />
                </div>
              ) : empresas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-600">
                  <span className="text-3xl mb-2">🏢</span>
                  <p className="text-xs">No hay empresas registradas.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.02]">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-3 px-5 py-2.5 text-[9px] font-bold uppercase tracking-wider text-zinc-500 bg-white/[0.002]">
                    <div className="col-span-2">ID</div>
                    <div className="col-span-4">Negocio</div>
                    <div className="col-span-3">Giro</div>
                    <div className="col-span-3 text-right">Plan Mensual</div>
                  </div>

                  {/* Table Body */}
                  {empresas.map((emp) => (
                    <div key={emp.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-white/[0.005] transition-colors">
                      <div className="col-span-2 font-mono text-[11px] text-zinc-500">#{emp.id}</div>
                      <div className="col-span-4">
                        <p className="text-[13px] font-bold text-white leading-none">{emp.nombre}</p>
                        <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                          {emp.creado_at ? new Date(emp.creado_at).toLocaleDateString([], { day: '2-digit', month: 'short' }) : 'S/F'}
                        </p>
                      </div>
                      <div className="col-span-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                          emp.giro === 'RESTAURANTE'
                            ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
                            : 'text-amber-400 border-amber-500/20 bg-amber-500/5'
                        }`}>
                          {emp.giro === 'RESTAURANTE' ? '🍽️ Restaurante' : '☕ Cafetería'}
                        </span>
                      </div>
                      <div className="col-span-3 text-right font-mono text-[12px] font-extrabold text-white">
                        {formatCurrency(emp.plan_mensual || '0')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>

      </div>
    </div>
  );
}
