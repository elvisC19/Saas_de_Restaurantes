'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/math';

interface SuperAdminEmpresa {
  id: number;
  nombre: string;
  nit?: string;
  giro: 'CAFETERIA' | 'RESTAURANTE';
  giro_negocio?: 'CAFETERIA' | 'RESTAURANTE';
  plan_mensual: string;
  plan_suscripcion?: 'Basico' | 'Medio' | 'Premium';
  estado_cuenta?: 'Activo' | 'Suspendido' | 'Demo';
  subdominio?: string;
  total_licencias?: number;
  limite_usuarios?: number;
  creado_at?: string;
}

interface TicketSoporte {
  id: number;
  empresa_id: number;
  emisor_nombre: string;
  emisor_rol: 'Administrador' | 'Cajero' | 'Cocina';
  pantalla_origen: string;
  gravedad: 'Critica' | 'Media' | 'Baja';
  descripcion: string;
  estado: 'Abierto' | 'En Progreso' | 'Resuelto';
  fecha_creacion: string;
  resuelto_at: string | null;
  empresas?: { nombre: string };
}

interface SaaSMetrics {
  totalTenants: number;
  activeTenants: number;
  mrr: number;
  gmv: number;
}

type TabDirectorio = 'RESTAURANTE' | 'CAFETERIA';
type TabPrincipal = 'directorio' | 'tickets' | 'alertas';
type AlcanceAlerta = 'Global' | 'Empresa' | 'Rol';

export default function SuperAdminPage() {
  const { rol, loading: authLoading } = useAuth();
  const router = useRouter();

  const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>('directorio');
  const [tabDirectorio, setTabDirectorio] = useState<TabDirectorio>('RESTAURANTE');

  const [empresas, setEmpresas] = useState<SuperAdminEmpresa[]>([]);
  const [tickets, setTickets] = useState<TicketSoporte[]>([]);
  const [metrics, setMetrics] = useState<SaaSMetrics>({ totalTenants: 0, activeTenants: 0, mrr: 0, gmv: 0 });
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [loadingTickets, setLoadingTickets] = useState(true);

  const [formNombre, setFormNombre] = useState('');
  const [formNit, setFormNit] = useState('');
  const [formRubro, setFormRubro] = useState<'RESTAURANTE' | 'CAFETERIA'>('RESTAURANTE');
  const [formPlan, setFormPlan] = useState<'Basico' | 'Medio' | 'Premium'>('Basico');
  const [formLimiteUsuarios, setFormLimiteUsuarios] = useState('3');
  const [submittingEmpresa, setSubmittingEmpresa] = useState(false);

  const [userEmail, setUserEmail] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userNombre, setUserNombre] = useState('');
  const [userEmpresaId, setUserEmpresaId] = useState('');
  const [userRol, setUserRol] = useState<'Cajero' | 'Cocina'>('Cajero');
  const [submittingUser, setSubmittingUser] = useState(false);

  const [alertaTitulo, setAlertaTitulo] = useState('');
  const [alertaMensaje, setAlertaMensaje] = useState('');
  const [alertaAlcance, setAlertaAlcance] = useState<AlcanceAlerta>('Global');
  const [alertaEmpresaId, setAlertaEmpresaId] = useState('');
  const [alertaRol, setAlertaRol] = useState<'Cajero' | 'Cocina' | 'Administrador'>('Cajero');
  const [alertaPrioridad, setAlertaPrioridad] = useState<'Urgente' | 'Normal' | 'Informativa'>('Normal');
  const [submittingAlerta, setSubmittingAlerta] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (!authLoading && rol !== 'SuperAdmin') {
      router.push('/');
    }
  }, [rol, authLoading, router]);

  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchEmpresas = useCallback(async () => {
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
      setLoadingEmpresas(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tickets_soporte')
        .select('*, empresas(nombre)')
        .order('fecha_creacion', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Error al cargar tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  const loadMetrics = useCallback(async () => {
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
      console.error('Error al cargar métricas:', err);
    }
  }, []);

  useEffect(() => {
    if (rol !== 'SuperAdmin') return;
    fetchEmpresas();
  }, [rol, fetchEmpresas]);

  useEffect(() => {
    if (rol !== 'SuperAdmin') return;
    loadTickets();
    const channel = supabase
      .channel('superadmin-tickets-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets_soporte' },
        () => {
          loadTickets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rol, loadTickets]);

  useEffect(() => {
    if (rol !== 'SuperAdmin') return;
    loadMetrics();
  }, [rol, loadMetrics]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim() || !formNit.trim()) {
      showToast('error', 'Nombre Comercial del Establecimiento y NIT son obligatorios.');
      return;
    }
    setSubmittingEmpresa(true);
    try {
      const planVal = formPlan === 'Premium' ? 450.00 : formPlan === 'Medio' ? 280.00 : 140.00;
      const computedSubdomain = formNombre.toLowerCase().replace(/[^a-z0-9]/g, '');

      const { error } = await supabase.from('empresas').insert({
        nombre: formNombre.trim(),
        nit: formNit.trim(),
        giro: formRubro,
        giro_negocio: formRubro,
        plan_suscripcion: formPlan,
        plan_mensual: planVal,
        estado_cuenta: 'Activo',
        subdominio: computedSubdomain,
        limite_usuarios: parseInt(formLimiteUsuarios) || 3,
      });
      if (error) throw error;

      showToast('success', `Negocio "${formNombre}" registrado exitosamente.`);
      setFormNombre('');
      setFormNit('');
      setFormLimiteUsuarios('3');
      
      await fetchEmpresas();
      await loadMetrics();
    } catch (err: any) {
      showToast('error', err.message || 'Error al registrar el negocio.');
    } finally {
      setSubmittingEmpresa(false);
    }
  };

  const handleUpdatePlan = async (id: number, newPlan: 'Basico' | 'Medio' | 'Premium') => {
    try {
      const planVal = newPlan === 'Premium' ? 450.00 : newPlan === 'Medio' ? 280.00 : 140.00;
      const { error } = await supabase.from('empresas').update({ plan_suscripcion: newPlan, plan_mensual: planVal }).eq('id', id);
      if (error) throw error;
      await fetchEmpresas();
      await loadMetrics();
    } catch (err: any) {
      console.error('Error al actualizar plan:', err);
    }
  };

  const handleUpdateEstado = async (id: number, newEstado: 'Activo' | 'Suspendido' | 'Demo') => {
    try {
      const { error } = await supabase.from('empresas').update({ estado_cuenta: newEstado }).eq('id', id);
      if (error) throw error;
      await fetchEmpresas();
      await loadMetrics();
    } catch (err: any) {
      console.error('Error al actualizar estado:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userEmail.trim() || !userPassword.trim() || !userNombre.trim() || !userEmpresaId) {
      showToast('error', 'Todos los campos del usuario son obligatorios.');
      return;
    }

    const targetEmpresa = empresas.find(emp => emp.id === parseInt(userEmpresaId));
    if (!targetEmpresa) {
      showToast('error', 'La empresa seleccionada no existe.');
      return;
    }

    const limite = targetEmpresa.limite_usuarios || 3;
    const { data: currentUsers, error: countErr } = await supabase
      .from('usuarios')
      .select('id')
      .eq('empresa_id', parseInt(userEmpresaId));

    if (countErr) {
      showToast('error', 'Error al verificar licencias.');
      return;
    }
    if ((currentUsers?.length || 0) >= limite) {
      showToast('error', `Cupo de licencias agotado (${limite}/${limite}). Aumente el límite de la empresa.`);
      return;
    }

    setSubmittingUser(true);
    try {
      const res = await fetch('/api/superadmin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail.trim(),
          password: userPassword.trim(),
          nombre: userNombre.trim(),
          rol: userRol,
          empresaId: userEmpresaId,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Error al registrar el usuario.');
      }

      showToast('success', `Usuario "${userNombre}" (${userRol}) creado y vinculado a empresa #${userEmpresaId}.`);
      setUserEmail('');
      setUserPassword('');
      setUserNombre('');
      setUserEmpresaId('');
    } catch (err: any) {
      showToast('error', err.message || 'Error al crear usuario operativo.');
    } finally {
      setSubmittingUser(false);
    }
  };

  const handleTicketStatusChange = async (ticketId: number, nuevoEstado: 'En Progreso' | 'Resuelto') => {
    try {
      const updatePayload: any = { estado: nuevoEstado };
      if (nuevoEstado === 'Resuelto') {
        updatePayload.resuelto_at = new Date().toISOString();
      }
      const { error } = await supabase.from('tickets_soporte').update(updatePayload).eq('id', ticketId);
      if (error) throw error;
      showToast('success', `Ticket #${ticketId} → ${nuevoEstado}`);
      await loadTickets();
    } catch (err: any) {
      showToast('error', err.message || 'Error al actualizar ticket.');
    }
  };

  const handleEmitirAlerta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertaTitulo.trim() || !alertaMensaje.trim()) {
      showToast('error', 'Título y mensaje son obligatorios.');
      return;
    }
    if (alertaAlcance === 'Empresa' && !alertaEmpresaId) {
      showToast('error', 'Seleccione una empresa destino.');
      return;
    }

    setSubmittingAlerta(true);
    try {
      const payload: any = {
        titulo: alertaTitulo.trim(),
        mensaje: alertaMensaje.trim(),
        tipo_alcance: alertaAlcance,
        prioridad: alertaPrioridad,
        emitido_por: 'SuperAdmin',
      };

      if (alertaAlcance === 'Empresa') {
        payload.empresa_destino_id = parseInt(alertaEmpresaId);
      }
      if (alertaAlcance === 'Rol') {
        payload.rol_destino = alertaRol;
      }

      const { error } = await supabase.from('alertas_sistema').insert(payload);
      if (error) throw error;

      const destino = alertaAlcance === 'Global' ? 'todo el SaaS' :
        alertaAlcance === 'Empresa' ? `empresa #${alertaEmpresaId}` :
        `rol ${alertaRol}`;
      showToast('success', `Alerta emitida hacia ${destino}.`);
      setAlertaTitulo('');
      setAlertaMensaje('');
      setAlertaAlcance('Global');
      setAlertaEmpresaId('');
    } catch (err: any) {
      showToast('error', err.message || 'Error al emitir alerta.');
    } finally {
      setSubmittingAlerta(false);
    }
  };

  const empresasFiltradas = empresas.filter(
    e => (e.giro || '').trim().toUpperCase() === tabDirectorio.toUpperCase()
  );
  const ticketsAbiertos = tickets.filter(t => t.estado !== 'Resuelto').length;

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  };

  const gravedadColor = (g: string) => {
    switch (g) {
      case 'Critica': return 'bg-red-500/15 text-red-400 border-red-500/20';
      case 'Media': return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
      case 'Baja': return 'bg-sky-500/15 text-sky-400 border-sky-500/20';
      default: return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
    }
  };

  const estadoTicketColor = (e: string) => {
    switch (e) {
      case 'Abierto': return 'text-red-400';
      case 'En Progreso': return 'text-amber-400';
      case 'Resuelto': return 'text-emerald-400';
      default: return 'text-zinc-400';
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
    <div className="flex flex-1 flex-col bg-zinc-950 overflow-y-auto min-h-screen">

      {toast && (
        <div className={`fixed top-5 right-5 z-[100] max-w-sm rounded-lg border-[0.5px] px-5 py-3.5 text-[12px] font-medium shadow-2xl transition-all animate-[slideIn_0.3s_ease-out] ${
          toast.type === 'success'
            ? 'border-emerald-500/20 bg-emerald-950/90 text-emerald-300 backdrop-blur-lg'
            : 'border-rose-500/20 bg-rose-950/90 text-rose-300 backdrop-blur-lg'
        }`}>
          <div className="flex items-center gap-2">
            <span>{toast.type === 'success' ? '✓' : '✕'}</span>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1440px] p-6 lg:p-8 space-y-6">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-[0.5px] border-zinc-800 pb-5">
          <div>
            <h1 className="text-[20px] font-semibold text-white tracking-tight flex items-center gap-2.5">
              Consola de Infraestructura Global
              <span className="rounded-full border-[0.5px] border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-medium text-emerald-400 uppercase tracking-wider">
                SuperAdmin
              </span>
            </h1>
            <p className="mt-1 text-[11px] text-zinc-500 font-normal">
              Gestión SaaS Multi-Tenant · Soporte Bidireccional · Alertas de Infraestructura
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border-[0.5px] border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-normal text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Red Activa</span>
            </div>

            <button
              onClick={() => { fetchEmpresas(); loadTickets(); loadMetrics(); }}
              className="rounded-lg border-[0.5px] border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all"
            >
              ↻ Actualizar
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Inquilinos Totales', value: `${metrics.totalTenants}`, icon: '🏢' },
            { label: 'Suscripciones Activas', value: `${metrics.activeTenants}`, icon: '✅' },
            { label: 'MRR Consolidado', value: formatCurrency(metrics.mrr), icon: '💰' },
            { label: 'Tickets Abiertos', value: `${ticketsAbiertos}`, icon: '🎫' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5 hover:bg-zinc-900/60 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">{kpi.label}</span>
                <span className="text-sm">{kpi.icon}</span>
              </div>
              <p className="mt-2 text-[22px] font-semibold text-white tracking-tight leading-none">{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/30 p-1">
          {([
            { key: 'directorio' as TabPrincipal, label: '📋 Directorio de Empresas', badge: empresas.length },
            { key: 'tickets' as TabPrincipal, label: '🎫 Buzón de Soporte', badge: ticketsAbiertos },
            { key: 'alertas' as TabPrincipal, label: '📡 Emisión de Alertas', badge: null },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setTabPrincipal(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-medium transition-all ${
                tabPrincipal === tab.key
                  ? 'bg-zinc-800 text-white shadow-lg'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
            >
              {tab.label}
              {tab.badge !== null && tab.badge > 0 && (
                <span className={`ml-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-medium ${
                  tab.key === 'tickets' && ticketsAbiertos > 0
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tabPrincipal === 'directorio' && (
          <div className="grid gap-6 lg:grid-cols-12">

            <div className="lg:col-span-8 flex flex-col gap-4">

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTabDirectorio('RESTAURANTE')}
                  className={`flex items-center gap-1.5 rounded-lg border-[0.5px] px-4 py-2 text-[12px] font-medium transition-all ${
                    tabDirectorio === 'RESTAURANTE'
                      ? 'border-orange-500/30 bg-orange-500/10 text-orange-300'
                      : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  🍽️ Rubro Restaurante
                  <span className="ml-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px]">
                    {empresas.filter(e => (e.giro || '').trim().toUpperCase() === 'RESTAURANTE').length}
                  </span>
                </button>
                <button
                  onClick={() => setTabDirectorio('CAFETERIA')}
                  className={`flex items-center gap-1.5 rounded-lg border-[0.5px] px-4 py-2 text-[12px] font-medium transition-all ${
                    tabDirectorio === 'CAFETERIA'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  ☕ Rubro Cafetería
                  <span className="ml-1 rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px]">
                    {empresas.filter(e => (e.giro || '').trim().toUpperCase() === 'CAFETERIA').length}
                  </span>
                </button>
              </div>

              <div className="flex flex-col rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-4 border-b-[0.5px] border-zinc-800 bg-zinc-900/20">
                  <h2 className="text-[13px] font-medium text-white uppercase tracking-wider">
                    {tabDirectorio === 'RESTAURANTE' ? '🍽️ Directorio de Restaurantes' : '☕ Directorio de Cafeterías'}
                  </h2>
                </div>

                <div className="flex-1 overflow-x-auto">
                  {loadingEmpresas ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="h-6 w-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
                    </div>
                  ) : empresasFiltradas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-600">
                      <span className="text-3xl mb-3">{tabDirectorio === 'RESTAURANTE' ? '🍽️' : '☕'}</span>
                      <p className="text-[12px] font-normal">No hay {tabDirectorio === 'RESTAURANTE' ? 'restaurantes' : 'cafeterías'} registrados.</p>
                      <p className="text-[11px] text-zinc-700 mt-1">Use el formulario lateral para registrar uno nuevo.</p>
                    </div>
                  ) : (
                    <table className="w-full text-[12px] border-collapse text-left">
                      <thead>
                        <tr className="border-b-[0.5px] border-zinc-800 bg-zinc-900/30 text-zinc-500 font-medium uppercase tracking-wider text-[9px]">
                          <th className="px-4 py-3 font-medium">ID</th>
                          <th className="px-4 py-3 font-medium">Nombre Comercial</th>
                          <th className="px-4 py-3 font-medium">NIT</th>
                          <th className="px-4 py-3 font-medium">Licencias</th>
                          <th className="px-4 py-3 font-medium">Plan</th>
                          <th className="px-4 py-3 font-medium">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[0.5px] divide-zinc-800/60">
                        {empresasFiltradas.map((emp) => (
                          <tr key={emp.id} className="hover:bg-zinc-800/20 transition-colors">
                            <td className="px-4 py-3.5 font-mono text-zinc-500 text-[11px]">#{emp.id}</td>
                            <td className="px-4 py-3.5 text-white font-medium">{emp.nombre}</td>
                            <td className="px-4 py-3.5 text-zinc-400 font-normal font-mono text-[11px]">{emp.nit || '—'}</td>
                            <td className="px-4 py-3.5">
                              <span className="rounded-md border-[0.5px] border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-[10px] font-mono text-zinc-300">
                                {emp.limite_usuarios || '—'} cupos
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <select
                                value={emp.plan_suscripcion || 'Basico'}
                                onChange={(e) => handleUpdatePlan(emp.id, e.target.value as any)}
                                className="bg-zinc-950 border-[0.5px] border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-emerald-400 font-normal outline-none focus:border-emerald-500/50 cursor-pointer"
                              >
                                <option value="Basico">Básico (140 BOB)</option>
                                <option value="Medio">Medio (280 BOB)</option>
                                <option value="Premium">Premium (450 BOB)</option>
                              </select>
                            </td>
                            <td className="px-4 py-3.5">
                              <select
                                value={emp.estado_cuenta || 'Activo'}
                                onChange={(e) => handleUpdateEstado(emp.id, e.target.value as any)}
                                className={`bg-zinc-950 border-[0.5px] border-zinc-800 rounded-lg px-2 py-1 text-[11px] font-normal outline-none focus:border-emerald-500/50 cursor-pointer ${
                                  emp.estado_cuenta === 'Activo' ? 'text-emerald-400'
                                    : emp.estado_cuenta === 'Suspendido' ? 'text-rose-400'
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
            </div>

            <div className="lg:col-span-4 flex flex-col gap-4">

              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="text-[12px] font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 text-[10px]">+</span>
                  Registrar Nuevo Negocio
                </h2>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Nombre Comercial del Establecimiento *</label>
                    <input
                      type="text"
                      required
                      value={formNombre}
                      onChange={(e) => setFormNombre(e.target.value)}
                      placeholder="Restaurante El Patio"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-emerald-500/50 placeholder-zinc-700 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">NIT *</label>
                    <input
                      type="text"
                      required
                      value={formNit}
                      onChange={(e) => setFormNit(e.target.value)}
                      placeholder="1020304050"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-emerald-500/50 placeholder-zinc-700 font-mono transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Rubro Comercial *</label>
                      <select
                        value={formRubro}
                        onChange={(e) => setFormRubro(e.target.value as any)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-2 py-2 text-[12px] text-white outline-none focus:border-emerald-500/50 cursor-pointer"
                      >
                        <option value="RESTAURANTE">🍽️ Rubro Restaurante</option>
                        <option value="CAFETERIA">☕ Rubro Cafetería</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Plan</label>
                      <select
                        value={formPlan}
                        onChange={(e) => setFormPlan(e.target.value as any)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-2 py-2 text-[12px] text-white outline-none focus:border-emerald-500/50 cursor-pointer"
                      >
                        <option value="Basico">Básico</option>
                        <option value="Medio">Medio</option>
                        <option value="Premium">Premium</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Cupo de Empleados Permitidos *</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      required
                      value={formLimiteUsuarios}
                      onChange={(e) => setFormLimiteUsuarios(e.target.value)}
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-emerald-500/50 font-mono transition-colors"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingEmpresa}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-[12px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {submittingEmpresa ? 'Aprovisionando...' : 'Activar Negocio y Generar Licencia'}
                  </button>
                </form>
              </div>

              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="text-[12px] font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sky-500/15 text-[10px]">👤</span>
                  Crear Usuario Operativo
                </h2>

                <form onSubmit={handleCreateUser} className="space-y-3">
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      value={userNombre}
                      onChange={(e) => setUserNombre(e.target.value)}
                      placeholder="Juan Pérez"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-sky-500/50 placeholder-zinc-700 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Email de Acceso *</label>
                    <input
                      type="email"
                      required
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      placeholder="cajero@empresa.com"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-sky-500/50 placeholder-zinc-700 font-mono transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Contraseña *</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={userPassword}
                      onChange={(e) => setUserPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-sky-500/50 placeholder-zinc-700 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Empresa Destino *</label>
                      <select
                        value={userEmpresaId}
                        onChange={(e) => setUserEmpresaId(e.target.value)}
                        required
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-2 py-2 text-[12px] text-white outline-none focus:border-sky-500/50 cursor-pointer"
                      >
                        <option value="">-- Empresa --</option>
                        {empresas.map(emp => (
                          <option key={emp.id} value={emp.id}>#{emp.id} {emp.nombre}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Rol *</label>
                      <select
                        value={userRol}
                        onChange={(e) => setUserRol(e.target.value as any)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-2 py-2 text-[12px] text-white outline-none focus:border-sky-500/50 cursor-pointer"
                      >
                        <option value="Cajero">💵 Cajero</option>
                        <option value="Cocina">🍳 Cocina</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingUser}
                    className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 py-2.5 text-[12px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {submittingUser ? 'Creando...' : 'Crear Usuario y Vincular'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {tabPrincipal === 'tickets' && (
          <div className="flex flex-col gap-4">

            <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[14px] font-semibold text-white flex items-center gap-2">
                    🎫 Buzón Global de Soporte Técnico
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                  </h2>
                  <p className="mt-0.5 text-[11px] text-zinc-500 font-normal">
                    Lectura en tiempo real · Suscripción activa a <code className="text-zinc-400">tickets_soporte</code>
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-4 text-[10px] font-medium">
                    <span className="text-red-400">● {tickets.filter(t => t.estado === 'Abierto').length} Abiertos</span>
                    <span className="text-amber-400">● {tickets.filter(t => t.estado === 'En Progreso').length} En Progreso</span>
                    <span className="text-emerald-400">● {tickets.filter(t => t.estado === 'Resuelto').length} Resueltos</span>
                  </div>
                </div>
              </div>
            </div>

            {loadingTickets ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-6 w-6 border-2 border-zinc-800 border-t-red-500 rounded-full animate-spin" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 flex flex-col items-center justify-center py-20 text-center">
                <span className="text-4xl mb-3">📭</span>
                <p className="text-[13px] text-zinc-500 font-normal">No hay tickets de soporte registrados.</p>
                <p className="text-[11px] text-zinc-700 mt-1">Los operadores pueden reportar incidencias desde sus estaciones de trabajo.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5 hover:bg-zinc-900/60 transition-all ${
                      ticket.estado === 'Resuelto' ? 'opacity-50' : ''
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">

                      <div className="flex-1 min-w-0 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-md border-[0.5px] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${gravedadColor(ticket.gravedad)}`}>
                            {ticket.gravedad === 'Critica' && '🔴'}
                            {ticket.gravedad === 'Media' && '🟡'}
                            {ticket.gravedad === 'Baja' && '🔵'}
                            {ticket.gravedad}
                          </span>

                          <span className={`text-[10px] font-medium ${estadoTicketColor(ticket.estado)}`}>
                            {ticket.estado}
                          </span>

                          <span className="text-[10px] text-zinc-600 font-mono">TKT-{String(ticket.id).padStart(4, '0')}</span>
                        </div>

                        <div className="flex items-center gap-3 text-[11px]">
                          <span className="text-zinc-500">
                            <strong className="text-zinc-300">{ticket.empresas?.nombre || `Empresa #${ticket.empresa_id}`}</strong>
                            {' · '}
                            <span className="text-orange-400">{ticket.pantalla_origen}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                          <span>👤 {ticket.emisor_nombre}</span>
                          <span>·</span>
                          <span className="rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-[9px] font-mono">{ticket.emisor_rol}</span>
                          <span>·</span>
                          <span>🕐 {formatTimestamp(ticket.fecha_creacion)}</span>
                        </div>

                        <div className="rounded-lg border-[0.5px] border-zinc-800/50 bg-zinc-950/60 px-3.5 py-2.5 text-[12px] text-zinc-300 leading-relaxed">
                          {ticket.descripcion}
                        </div>
                      </div>

                      {ticket.estado !== 'Resuelto' && (
                        <div className="flex lg:flex-col gap-2 shrink-0">
                          {ticket.estado === 'Abierto' && (
                            <button
                              onClick={() => handleTicketStatusChange(ticket.id, 'En Progreso')}
                              className="rounded-lg border-[0.5px] border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 transition-all"
                            >
                              ⏳ En Progreso
                            </button>
                          )}
                          <button
                            onClick={() => handleTicketStatusChange(ticket.id, 'Resuelto')}
                            className="rounded-lg border-[0.5px] border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 transition-all"
                          >
                            ✅ Resolver
                          </button>
                        </div>
                      )}

                      {ticket.estado === 'Resuelto' && ticket.resuelto_at && (
                        <div className="shrink-0 text-[10px] text-emerald-600 font-mono">
                          Resuelto: {formatTimestamp(ticket.resuelto_at)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tabPrincipal === 'alertas' && (
          <div className="grid gap-6 lg:grid-cols-12">

            <div className="lg:col-span-7">
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-6">
                <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-1">
                  📡 Panel de Emisión de Alertas de Infraestructura
                </h2>
                <p className="text-[11px] text-zinc-500 font-normal mb-5">
                  Redacte un comunicado y emítalo al sistema. Se insertará en <code className="text-zinc-400">alertas_sistema</code>.
                </p>

                <form onSubmit={handleEmitirAlerta} className="space-y-4">

                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Título del Comunicado *</label>
                    <input
                      type="text"
                      required
                      value={alertaTitulo}
                      onChange={(e) => setAlertaTitulo(e.target.value)}
                      placeholder="Mantenimiento Programado de Servidores"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[13px] text-white outline-none focus:border-violet-500/50 placeholder-zinc-700 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Cuerpo del Mensaje *</label>
                    <textarea
                      required
                      rows={4}
                      value={alertaMensaje}
                      onChange={(e) => setAlertaMensaje(e.target.value)}
                      placeholder="Estimados operadores, se realizará un mantenimiento programado el día..."
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 placeholder-zinc-700 resize-none leading-relaxed transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Alcance de Difusión *</label>
                      <select
                        value={alertaAlcance}
                        onChange={(e) => setAlertaAlcance(e.target.value as AlcanceAlerta)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 cursor-pointer"
                      >
                        <option value="Global">🌐 Global (Todo el SaaS)</option>
                        <option value="Empresa">🏢 Empresa Específica</option>
                        <option value="Rol">👤 Por Rol Operativo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Prioridad</label>
                      <select
                        value={alertaPrioridad}
                        onChange={(e) => setAlertaPrioridad(e.target.value as any)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 cursor-pointer"
                      >
                        <option value="Urgente">🔴 Urgente</option>
                        <option value="Normal">🟡 Normal</option>
                        <option value="Informativa">🔵 Informativa</option>
                      </select>
                    </div>
                  </div>

                  {alertaAlcance === 'Empresa' && (
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Empresa Destino *</label>
                      <select
                        value={alertaEmpresaId}
                        onChange={(e) => setAlertaEmpresaId(e.target.value)}
                        required
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 cursor-pointer"
                      >
                        <option value="">-- Seleccionar Empresa --</option>
                        {empresas.map(emp => (
                          <option key={emp.id} value={emp.id}>#{emp.id} · {emp.nombre} ({emp.giro})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {alertaAlcance === 'Rol' && (
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Rol Destino *</label>
                      <select
                        value={alertaRol}
                        onChange={(e) => setAlertaRol(e.target.value as any)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 cursor-pointer"
                      >
                        <option value="Cajero">💵 Todos los Cajeros</option>
                        <option value="Cocina">🍳 Todas las Cocinas</option>
                        <option value="Administrador">📊 Todos los Administradores</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingAlerta}
                    className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 py-3 text-[13px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {submittingAlerta ? 'Emitiendo...' : '📡 Emitir Alerta al Sistema'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-4">

              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Vista Previa del Comunicado</h3>
                <div className="rounded-lg border-[0.5px] border-zinc-700/50 bg-zinc-950/80 p-4 space-y-2">
                  {alertaTitulo ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${
                          alertaPrioridad === 'Urgente' ? 'bg-red-500' :
                          alertaPrioridad === 'Normal' ? 'bg-amber-500' : 'bg-sky-500'
                        }`} />
                        <h4 className="text-[13px] font-semibold text-white">{alertaTitulo}</h4>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed">{alertaMensaje || 'Sin contenido...'}</p>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t-[0.5px] border-zinc-800">
                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${
                          alertaAlcance === 'Global' ? 'bg-violet-500/15 text-violet-400' :
                          alertaAlcance === 'Empresa' ? 'bg-sky-500/15 text-sky-400' :
                          'bg-amber-500/15 text-amber-400'
                        }`}>
                          {alertaAlcance === 'Global' ? '🌐 Global' :
                           alertaAlcance === 'Empresa' ? `🏢 Empresa #${alertaEmpresaId || '?'}` :
                           `👤 Rol: ${alertaRol}`}
                        </span>
                        <span className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${
                          alertaPrioridad === 'Urgente' ? 'bg-red-500/15 text-red-400' :
                          alertaPrioridad === 'Normal' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-sky-500/15 text-sky-400'
                        }`}>
                          {alertaPrioridad}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-zinc-600 italic">Comience a escribir para ver la vista previa...</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Guía de Alcances</h3>
                <div className="space-y-2.5">
                  {[
                    { icon: '🌐', title: 'Global', desc: 'Llega a TODOS los usuarios del SaaS. Ideal para mantenimientos de servidor.' },
                    { icon: '🏢', title: 'Por Empresa', desc: 'Solo el personal de una empresa específica recibirá la notificación.' },
                    { icon: '👤', title: 'Por Rol', desc: 'Filtra por rol operativo. Ej: Alertar solo a todas las Cocinas del sistema.' },
                  ].map((g) => (
                    <div key={g.title} className="flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">{g.icon}</span>
                      <div>
                        <p className="text-[11px] font-medium text-zinc-300">{g.title}</p>
                        <p className="text-[10px] text-zinc-600 leading-relaxed">{g.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Estadísticas de Alcance</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-zinc-950/60 p-3 text-center">
                    <p className="text-[18px] font-semibold text-white">{empresas.length}</p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Empresas</p>
                  </div>
                  <div className="rounded-lg bg-zinc-950/60 p-3 text-center">
                    <p className="text-[18px] font-semibold text-white">
                      {empresas.reduce((sum, e) => sum + (e.limite_usuarios || 3), 0)}
                    </p>
                    <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Licencias Totales</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
