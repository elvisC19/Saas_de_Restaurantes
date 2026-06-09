'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { InventarioInsumo } from '@/types/database';
import { formatCurrency, addDecimals, subtractDecimals } from '@/lib/math';
import { usePlanGuard } from '@/hooks/usePlanGuard';

// ─── TYPES ──────────────────────────────────────────────────────────
interface ItemMenuRow {
  id: number;
  empresa_id: number;
  nombre: string;
  precio: string;
  giro?: string;
}

interface MovimientoCaja {
  id: number;
  empresa_id: number;
  tipo: 'Ingreso' | 'Egreso';
  monto: string;
  concepto: string;
  registrado_por: string;
  creado_at: string;
}

interface AsistenciaRow {
  id: number;
  nombre_empleado: string;
  rol_empleado: string;
  hora_entrada: string;
  hora_salida: string | null;
  costo_hora: string;
}

interface AlertaSistema {
  id: number;
  titulo: string;
  mensaje: string;
  tipo_alcance: string;
  prioridad: string;
  creado_at: string;
}

type AdminTab = 'inventario' | 'caja' | 'personal' | 'soporte';

// ─── CONSTANTS ──────────────────────────────────────────────────────
const STOCK_CAPS: Record<string, number> = {
  'Café en grano': 5000, 'Leche entera': 10000, 'Azúcar': 3000,
  'Agua purificada': 20000, 'Taza descartable 8oz': 200,
  'Lomo de res': 10000, 'Papas': 100, 'Arroz': 5000,
  'Aceite': 2000, 'Huevo': 50,
};

const UNIT_LABELS: Record<string, string> = {
  gr: 'gramos', ml: 'mililitros', unidades: 'unidades',
};

const COSTO_HORA_BOB = 15;

// ─── COMPONENT ──────────────────────────────────────────────────────
export default function AdminPage() {
  const { rol, empresaId, giro, empresaNombre, plan, loading: authLoading } = useAuth();
  const router = useRouter();
  const { hasAccess: planMedioAccess } = usePlanGuard('medio');

  // ── Navigation ──
  const [activeTab, setActiveTab] = useState<AdminTab>('inventario');

  // ── Data: Inventario ──
  const [insumos, setInsumos] = useState<InventarioInsumo[]>([]);
  const [loadingInsumos, setLoadingInsumos] = useState(true);

  // ── Data: Menú CRUD ──
  const [menuItems, setMenuItems] = useState<ItemMenuRow[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [newItemNombre, setNewItemNombre] = useState('');
  const [newItemPrecio, setNewItemPrecio] = useState('');
  const [submittingItem, setSubmittingItem] = useState(false);

  // ── Data: Caja ──
  const [ventasHoy, setVentasHoy] = useState('0.00');
  const [pedidosHoy, setPedidosHoy] = useState(0);
  const [egresosHoy, setEgresosHoy] = useState<MovimientoCaja[]>([]);
  const [totalEgresos, setTotalEgresos] = useState('0.00');
  const [egresoMonto, setEgresoMonto] = useState('');
  const [egresoConcepto, setEgresoConcepto] = useState('');
  const [submittingEgreso, setSubmittingEgreso] = useState(false);

  // ── Data: Personal ──
  const [asistencia, setAsistencia] = useState<AsistenciaRow[]>([]);
  const [loadingAsistencia, setLoadingAsistencia] = useState(true);

  // ── Data: Alertas ──
  const [alertas, setAlertas] = useState<AlertaSistema[]>([]);

  // ── Data: Soporte ──
  const [ticketDescripcion, setTicketDescripcion] = useState('');
  const [ticketGravedad, setTicketGravedad] = useState<'Critica' | 'Media' | 'Baja'>('Media');
  const [ticketPantalla, setTicketPantalla] = useState('Admin - General');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // ── KPIs ──
  const [itemsMenuCount, setItemsMenuCount] = useState(0);

  // ── Toast ──
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // ─── AUTH GUARD ────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && rol !== 'Administrador') {
      router.push('/');
    }
  }, [rol, authLoading, router]);

  // ─── TOAST ─────────────────────────────────────────────────────────
  const showToast = useCallback((type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── HELPERS ───────────────────────────────────────────────────────
  const getTodayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  };

  const getStockPercent = (insumo: InventarioInsumo) => {
    const cap = STOCK_CAPS[insumo.nombre] || 1000;
    const current = parseFloat(insumo.stock_actual);
    return Math.min(Math.max((current / cap) * 100, 0), 100);
  };

  const getBarColor = (pct: number) => {
    if (pct > 50) return 'bg-emerald-500';
    if (pct > 20) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const getStatusLabel = (pct: number) => {
    if (pct > 50) return { text: 'Óptimo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    if (pct > 20) return { text: 'Bajo', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    return { text: 'Crítico', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateTimeFull = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' }) + ' ' +
      d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
  };

  const calcHorasTrabajadas = (entrada: string, salida: string | null): number => {
    const start = new Date(entrada).getTime();
    const end = salida ? new Date(salida).getTime() : Date.now();
    const diffMs = end - start;
    return Math.max(parseFloat((diffMs / 3600000).toFixed(2)), 0);
  };

  // ─── DATA LOADERS ──────────────────────────────────────────────────
  const loadInventario = useCallback(async () => {
    if (!rol || !giro) return;
    try {
      const { data, error } = await supabase
        .from('inventario_insumos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('giro', giro)
        .order('id', { ascending: true });
      if (error) throw error;
      setInsumos(data || []);
    } catch {
      console.error('Error al cargar inventario.');
    } finally {
      setLoadingInsumos(false);
    }
  }, [rol, giro, empresaId]);

  const loadMenuItems = useCallback(async () => {
    if (!rol || !giro) return;
    try {
      const { data, error } = await supabase
        .from('items_menu')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('giro', giro)
        .order('nombre', { ascending: true });
      if (error) throw error;
      setMenuItems(data || []);
      setItemsMenuCount(data?.length || 0);
    } catch {
      console.error('Error al cargar menú.');
    } finally {
      setLoadingMenu(false);
    }
  }, [rol, giro, empresaId]);

  const loadCaja = useCallback(async () => {
    if (!rol || !giro) return;
    const todayStart = getTodayStart();
    try {
      // Ventas del día (pedidos pagados)
      const { data: pedidosData } = await supabase
        .from('pedidos')
        .select('id, total')
        .eq('empresa_id', empresaId)
        .eq('estado', 'Pagado')
        .gte('creado_at', todayStart);

      if (pedidosData) {
        setPedidosHoy(pedidosData.length);
        let total = 0;
        pedidosData.forEach((p: any) => { total += parseFloat(p.total || '0'); });
        setVentasHoy(total.toFixed(2));
      }

      // Egresos del día
      const { data: egresosData } = await supabase
        .from('movimientos_caja')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('tipo', 'Egreso')
        .gte('creado_at', todayStart)
        .order('creado_at', { ascending: false });

      if (egresosData) {
        setEgresosHoy(egresosData as MovimientoCaja[]);
        let sumEgresos = 0;
        egresosData.forEach((e: any) => { sumEgresos += parseFloat(e.monto || '0'); });
        setTotalEgresos(sumEgresos.toFixed(2));
      }
    } catch {
      console.error('Error al cargar flujo de caja.');
    }
  }, [rol, giro, empresaId]);

  const loadAsistencia = useCallback(async () => {
    if (!rol || !giro) return;
    const todayStart = getTodayStart();
    try {
      const { data, error } = await supabase
        .from('asistencia_personal')
        .select('*')
        .eq('empresa_id', empresaId)
        .gte('hora_entrada', todayStart)
        .order('hora_entrada', { ascending: false });
      if (error) throw error;
      setAsistencia(data || []);
    } catch {
      console.error('Error al cargar asistencia.');
    } finally {
      setLoadingAsistencia(false);
    }
  }, [rol, giro, empresaId]);

  const loadAlertas = useCallback(async () => {
    if (!rol || !giro) return;
    try {
      // Load alerts: Global OR for this empresa OR for role 'Administrador'
      const { data, error } = await supabase
        .from('alertas_sistema')
        .select('*')
        .or(`tipo_alcance.eq.Global,empresa_destino_id.eq.${empresaId},and(tipo_alcance.eq.Rol,rol_destino.eq.Administrador)`)
        .order('creado_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setAlertas(data || []);
    } catch {
      console.error('Error al cargar alertas del sistema.');
    }
  }, [rol, giro, empresaId]);

  // ─── INITIAL LOAD & REALTIME ───────────────────────────────────────
  useEffect(() => {
    if (!rol || !giro || rol !== 'Administrador') return;

    loadInventario();
    loadMenuItems();
    loadCaja();
    loadAlertas();
    if (planMedioAccess) {
      loadAsistencia();
    }

    const channel = supabase
      .channel('admin-realtime-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_insumos', filter: `empresa_id=eq.${empresaId}` }, () => {
        loadInventario();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos', filter: `empresa_id=eq.${empresaId}` }, () => {
        loadCaja();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'movimientos_caja', filter: `empresa_id=eq.${empresaId}` }, () => {
        loadCaja();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertas_sistema' }, () => {
        loadAlertas();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [rol, empresaId, giro, planMedioAccess, loadInventario, loadMenuItems, loadCaja, loadAsistencia, loadAlertas]);

  // ─── HANDLERS: CRUD MENÚ ──────────────────────────────────────────
  const handleAddMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemNombre.trim() || !newItemPrecio.trim()) {
      showToast('error', 'Nombre y precio son obligatorios.');
      return;
    }
    const precio = parseFloat(newItemPrecio);
    if (isNaN(precio) || precio <= 0) {
      showToast('error', 'Precio inválido.');
      return;
    }
    setSubmittingItem(true);
    try {
      const { error } = await supabase.from('items_menu').insert({
        empresa_id: empresaId,
        nombre: newItemNombre.trim(),
        precio: precio,
        giro: giro,
      });
      if (error) throw error;
      showToast('success', `"${newItemNombre}" agregado al catálogo.`);
      setNewItemNombre('');
      setNewItemPrecio('');
      await loadMenuItems();
    } catch (err: any) {
      showToast('error', err.message || 'Error al agregar producto.');
    } finally {
      setSubmittingItem(false);
    }
  };

  const handleDeleteMenuItem = async (itemId: number, itemName: string) => {
    try {
      const { error } = await supabase.from('items_menu').delete().eq('id', itemId);
      if (error) throw error;
      showToast('success', `"${itemName}" eliminado del catálogo.`);
      await loadMenuItems();
    } catch (err: any) {
      showToast('error', err.message || 'Error al eliminar producto.');
    }
  };

  // ─── HANDLERS: EGRESOS ─────────────────────────────────────────────
  const handleRegistrarEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(egresoMonto);
    if (isNaN(monto) || monto <= 0) {
      showToast('error', 'Monto de egreso inválido.');
      return;
    }
    if (!egresoConcepto.trim()) {
      showToast('error', 'Concepto del egreso es obligatorio.');
      return;
    }
    setSubmittingEgreso(true);
    try {
      const { error } = await supabase.from('movimientos_caja').insert({
        empresa_id: empresaId,
        tipo: 'Egreso',
        monto: monto,
        concepto: egresoConcepto.trim(),
        registrado_por: empresaNombre + ' - Admin',
      });
      if (error) throw error;
      showToast('success', `Egreso de ${formatCurrency(monto)} registrado.`);
      setEgresoMonto('');
      setEgresoConcepto('');
      await loadCaja();
    } catch (err: any) {
      showToast('error', err.message || 'Error al registrar egreso.');
    } finally {
      setSubmittingEgreso(false);
    }
  };

  // ─── HANDLERS: TICKET SOPORTE ──────────────────────────────────────
  const handleEnviarTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketDescripcion.trim()) {
      showToast('error', 'Descripción del error es obligatoria.');
      return;
    }
    setSubmittingTicket(true);
    try {
      const { error } = await supabase.from('tickets_soporte').insert({
        empresa_id: empresaId,
        emisor_nombre: empresaNombre + ' - Administrador',
        emisor_rol: 'Administrador',
        pantalla_origen: ticketPantalla,
        gravedad: ticketGravedad,
        descripcion: ticketDescripcion.trim(),
        estado: 'Abierto',
      });
      if (error) throw error;
      showToast('success', 'Ticket enviado al SuperAdmin.');
      setTicketDescripcion('');
    } catch (err: any) {
      showToast('error', err.message || 'Error al enviar ticket.');
    } finally {
      setSubmittingTicket(false);
    }
  };

  // ─── COMPUTED ──────────────────────────────────────────────────────
  const flujoCajaNeto = subtractDecimals(ventasHoy, totalEgresos, 2);
  const flujoNetoFloat = parseFloat(flujoCajaNeto);

  const totalHorasDia = asistencia.reduce((sum, a) => sum + calcHorasTrabajadas(a.hora_entrada, a.hora_salida), 0);
  const costoManoObraDia = (totalHorasDia * COSTO_HORA_BOB).toFixed(2);

  // ─── LOADING GUARD ─────────────────────────────────────────────────
  if (authLoading || rol !== 'Administrador') {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-zinc-950 text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
          <span className="text-[12px] font-normal">Verificando credenciales de administrador...</span>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PLAN LOCK OVERLAY (reusable)
  // ═══════════════════════════════════════════════════════════════════
  const PlanLockOverlay = () => (
    <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl backdrop-blur-md bg-zinc-950/70">
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 border-[0.5px] border-amber-500/20">
          <span className="text-2xl">🔒</span>
        </div>
        <h3 className="text-[14px] font-semibold text-white">Módulo Bloqueado</h3>
        <p className="text-[11px] text-zinc-400 max-w-xs leading-relaxed">
          Disponible en <span className="font-semibold text-amber-400">Plan Medio (280 BOB)</span> o superior.
          Contacte al SuperAdmin para actualizar su suscripción.
        </p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-1 flex-col bg-zinc-950 overflow-y-auto min-h-screen">

      {/* ─── TOAST ─── */}
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

      {/* ─── ALERTAS BANNER (Comunicados del SuperAdmin) ─── */}
      {alertas.length > 0 && (
        <div className="border-b-[0.5px] border-zinc-800 bg-violet-950/30">
          {alertas.slice(0, 2).map((alerta) => (
            <div key={alerta.id} className="flex items-center gap-3 px-6 py-2.5 text-[11px]">
              <span className={`h-2 w-2 rounded-full shrink-0 ${
                alerta.prioridad === 'Urgente' ? 'bg-red-500 animate-pulse' :
                alerta.prioridad === 'Normal' ? 'bg-amber-500' : 'bg-sky-500'
              }`} />
              <span className="font-semibold text-violet-300">📡 {alerta.titulo}</span>
              <span className="text-zinc-400 truncate flex-1">{alerta.mensaje}</span>
              <span className="text-zinc-600 font-mono text-[9px] shrink-0">
                {new Date(alerta.creado_at).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto w-full max-w-[1440px] p-6 lg:p-8 space-y-6">

        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-[0.5px] border-zinc-800 pb-5">
          <div>
            <h1 className="text-[20px] font-semibold text-white tracking-tight">{empresaNombre}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] text-zinc-500 font-normal">
                {giro === 'CAFETERIA' ? '☕ Cafetería' : '🍽️ Restaurante'} ·
              </span>
              <span className={`rounded-full border-[0.5px] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                plan === 'premium' ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' :
                plan === 'medio' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' :
                'border-zinc-700 bg-zinc-800/50 text-zinc-400'
              }`}>
                {plan === 'premium' ? '⭐ Premium' : plan === 'medio' ? '📊 Medio' : '📋 Básico'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border-[0.5px] border-zinc-800 bg-zinc-900/40 px-3 py-1.5 text-[11px] font-normal text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>Realtime</span>
            </div>
            <button
              onClick={() => { loadInventario(); loadMenuItems(); loadCaja(); loadAlertas(); if (planMedioAccess) loadAsistencia(); }}
              className="rounded-lg border-[0.5px] border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-all"
            >
              ↻ Actualizar
            </button>
          </div>
        </div>

        {/* ═══ KPI STRIP ═══ */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: 'Ventas del Día', value: formatCurrency(ventasHoy), accent: 'text-emerald-400' },
            { label: 'Pedidos Pagados', value: `${pedidosHoy}`, accent: 'text-white' },
            { label: 'Egresos del Día', value: formatCurrency(totalEgresos), accent: 'text-rose-400' },
            { label: 'Flujo Neto', value: formatCurrency(flujoCajaNeto), accent: flujoNetoFloat >= 0 ? 'text-emerald-400' : 'text-rose-400' },
            { label: 'Ítems en Menú', value: `${itemsMenuCount}`, accent: 'text-white' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5 hover:bg-zinc-900/60 transition-colors">
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-zinc-500">{kpi.label}</span>
              <p className={`mt-2 text-[22px] font-semibold tracking-tight leading-none ${kpi.accent}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* ═══ TAB NAVIGATION ═══ */}
        <div className="flex items-center gap-1 rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/30 p-1">
          {([
            { key: 'inventario' as AdminTab, label: '📦 Inventario & Catálogo' },
            { key: 'caja' as AdminTab, label: '💰 Flujo de Caja' },
            { key: 'personal' as AdminTab, label: '👥 Control de Personal', locked: !planMedioAccess },
            { key: 'soporte' as AdminTab, label: '🎫 Soporte al SuperAdmin' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[12px] font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-zinc-800 text-white shadow-lg'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
              }`}
            >
              {tab.label}
              {tab.locked && <span className="text-[10px]">🔒</span>}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
             TAB 1: INVENTARIO & CATÁLOGO DE MENÚ
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'inventario' && (
          <div className="grid gap-6 lg:grid-cols-12">

            {/* ─── LEFT: Stock Monitor ─── */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-4 border-b-[0.5px] border-zinc-800 bg-zinc-900/20">
                  <h2 className="text-[13px] font-semibold text-white uppercase tracking-wider">
                    📦 Monitor de Inventario — {giro === 'CAFETERIA' ? 'Insumos de Barra' : 'Insumos de Cocina'}
                  </h2>
                  <p className="mt-0.5 text-[10px] text-zinc-500">Stock filtrado por giro activo · empresa #{empresaId}</p>
                </div>

                {loadingInsumos ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="h-6 w-6 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
                  </div>
                ) : insumos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-600">
                    <span className="text-3xl mb-3">📦</span>
                    <p className="text-[12px]">No hay insumos registrados para este giro.</p>
                  </div>
                ) : (
                  <div className="divide-y-[0.5px] divide-zinc-800/60">
                    {insumos.map((ins) => {
                      const pct = getStockPercent(ins);
                      const barColor = getBarColor(pct);
                      const status = getStatusLabel(pct);
                      return (
                        <div key={ins.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-zinc-800/20 transition-colors">
                          {/* Name */}
                          <div className="w-36 shrink-0">
                            <p className="text-[12px] font-medium text-white truncate">{ins.nombre}</p>
                            <p className="text-[9px] text-zinc-600">{UNIT_LABELS[ins.unidad_medida] || ins.unidad_medida}</p>
                          </div>

                          {/* Bar */}
                          <div className="flex-1">
                            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-zinc-800/80">
                              <div
                                className={`absolute left-0 top-0 h-full rounded-full ${barColor} transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          {/* Qty */}
                          <div className="w-28 text-right">
                            <span className="text-[13px] font-semibold text-white font-mono">{parseFloat(ins.stock_actual).toLocaleString('es-BO')}</span>
                            <span className="text-[9px] text-zinc-600 ml-1">{ins.unidad_medida}</span>
                          </div>

                          {/* Status Badge */}
                          <span className={`shrink-0 inline-flex items-center rounded-md border-[0.5px] px-2 py-0.5 text-[9px] font-semibold uppercase ${status.color}`}>
                            {status.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ─── RIGHT: CRUD de Productos ─── */}
            <div className="lg:col-span-5 flex flex-col gap-4">

              {/* Add Product Form */}
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500/15 text-[10px]">+</span>
                  Agregar {giro === 'CAFETERIA' ? 'Bebida / Café' : 'Plato / Producto'}
                </h3>

                <form onSubmit={handleAddMenuItem} className="space-y-3">
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Nombre del Producto *</label>
                    <input
                      type="text"
                      required
                      value={newItemNombre}
                      onChange={(e) => setNewItemNombre(e.target.value)}
                      placeholder={giro === 'CAFETERIA' ? 'Ej. Latte Vainilla' : 'Ej. Milanesa de Pollo'}
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-emerald-500/50 placeholder-zinc-700 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Precio (BOB) *</label>
                    <input
                      type="number"
                      step="0.50"
                      min="0.50"
                      required
                      value={newItemPrecio}
                      onChange={(e) => setNewItemPrecio(e.target.value)}
                      placeholder="25.00"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-emerald-500/50 placeholder-zinc-700 font-mono transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingItem}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-2.5 text-[12px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {submittingItem ? 'Agregando...' : 'Agregar al Catálogo'}
                  </button>
                </form>
              </div>

              {/* Menu Items List */}
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-3 border-b-[0.5px] border-zinc-800 bg-zinc-900/20">
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Catálogo Activo — {menuItems.length} ítems
                  </h3>
                </div>
                {loadingMenu ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-5 w-5 border-2 border-zinc-800 border-t-emerald-500 rounded-full animate-spin" />
                  </div>
                ) : menuItems.length === 0 ? (
                  <div className="px-5 py-8 text-center text-[11px] text-zinc-600">No hay productos en el catálogo.</div>
                ) : (
                  <div className="divide-y-[0.5px] divide-zinc-800/60 max-h-[320px] overflow-y-auto">
                    {menuItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                        <div>
                          <p className="text-[12px] font-medium text-white">{item.nombre}</p>
                          <p className="text-[10px] text-zinc-500 font-mono">{formatCurrency(item.precio)}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteMenuItem(item.id, item.nombre)}
                          className="rounded-md border-[0.5px] border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-[10px] font-medium text-rose-400 hover:bg-rose-500/20 transition-all"
                        >
                          ✕ Quitar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
             TAB 2: FLUJO DE CAJA GERENCIAL
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'caja' && (
          <div className="grid gap-6 lg:grid-cols-12">

            {/* ─── LEFT: Panel Financiero ─── */}
            <div className="lg:col-span-7 flex flex-col gap-4">

              {/* Financial Summary */}
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-6">
                <h2 className="text-[13px] font-semibold text-white uppercase tracking-wider mb-5">
                  💰 Flujo de Caja Gerencial — Hoy
                </h2>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {/* Ingresos */}
                  <div className="rounded-lg border-[0.5px] border-emerald-500/20 bg-emerald-500/5 p-4">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-emerald-500/70">Ventas Brutas (POS)</p>
                    <p className="mt-2 text-[20px] font-semibold text-emerald-400 tracking-tight">{formatCurrency(ventasHoy)}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{pedidosHoy} pedidos pagados</p>
                  </div>

                  {/* Egresos */}
                  <div className="rounded-lg border-[0.5px] border-rose-500/20 bg-rose-500/5 p-4">
                    <p className="text-[9px] font-medium uppercase tracking-wider text-rose-500/70">Egresos de Emergencia</p>
                    <p className="mt-2 text-[20px] font-semibold text-rose-400 tracking-tight">{formatCurrency(totalEgresos)}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{egresosHoy.length} movimientos</p>
                  </div>

                  {/* Neto */}
                  <div className={`rounded-lg border-[0.5px] p-4 ${
                    flujoNetoFloat >= 0
                      ? 'border-emerald-500/20 bg-emerald-500/5'
                      : 'border-rose-500/20 bg-rose-500/5'
                  }`}>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-zinc-500">Flujo Neto del Día</p>
                    <p className={`mt-2 text-[20px] font-semibold tracking-tight ${flujoNetoFloat >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {flujoNetoFloat >= 0 ? '+' : ''}{formatCurrency(flujoCajaNeto)}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-500">Ventas - Egresos</p>
                  </div>
                </div>

                {/* Trigger Explanation */}
                <div className="rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950/60 p-3.5 flex items-start gap-3">
                  <span className="text-sm mt-0.5">⚡</span>
                  <div>
                    <p className="text-[11px] font-medium text-zinc-300">Trigger PostgreSQL Activo</p>
                    <p className="text-[10px] text-zinc-600 leading-relaxed">
                      Al confirmar un pago en el POS, el trigger descuenta automáticamente los insumos base usando tipos NUMERIC precisos.
                    </p>
                  </div>
                </div>
              </div>

              {/* Egresos History */}
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 overflow-hidden">
                <div className="px-5 py-3.5 border-b-[0.5px] border-zinc-800 bg-zinc-900/20">
                  <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Historial de Egresos — Hoy
                  </h3>
                </div>
                {egresosHoy.length === 0 ? (
                  <div className="px-5 py-10 text-center text-[11px] text-zinc-600">Sin egresos registrados hoy.</div>
                ) : (
                  <div className="divide-y-[0.5px] divide-zinc-800/60 max-h-[250px] overflow-y-auto">
                    {egresosHoy.map((eg) => (
                      <div key={eg.id} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                        <div>
                          <p className="text-[12px] font-medium text-white">{eg.concepto}</p>
                          <p className="text-[9px] text-zinc-600">{formatDateTimeFull(eg.creado_at)} · {eg.registrado_por}</p>
                        </div>
                        <span className="text-[13px] font-semibold text-rose-400 font-mono">-{formatCurrency(eg.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ─── RIGHT: Formulario de Egreso ─── */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="text-[12px] font-semibold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/15 text-[10px]">📤</span>
                  Registrar Egreso de Emergencia
                </h3>

                <form onSubmit={handleRegistrarEgreso} className="space-y-3">
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Monto (BOB) *</label>
                    <input
                      type="number"
                      step="0.50"
                      min="0.50"
                      required
                      value={egresoMonto}
                      onChange={(e) => setEgresoMonto(e.target.value)}
                      placeholder="50.00"
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[14px] text-white outline-none focus:border-rose-500/50 placeholder-zinc-700 font-mono transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1">Concepto *</label>
                    <input
                      type="text"
                      required
                      value={egresoConcepto}
                      onChange={(e) => setEgresoConcepto(e.target.value)}
                      placeholder="Compra de gas, taxi, reparación..."
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2 text-[12px] text-white outline-none focus:border-rose-500/50 placeholder-zinc-700 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingEgreso}
                    className="w-full rounded-lg bg-rose-600 hover:bg-rose-500 py-2.5 text-[12px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {submittingEgreso ? 'Registrando...' : 'Registrar Egreso'}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t-[0.5px] border-zinc-800">
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2">Fórmula del Flujo Neto</p>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-emerald-400">{formatCurrency(ventasHoy)}</span>
                    <span className="text-zinc-600">−</span>
                    <span className="text-rose-400">{formatCurrency(totalEgresos)}</span>
                    <span className="text-zinc-600">=</span>
                    <span className={`font-semibold ${flujoNetoFloat >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatCurrency(flujoCajaNeto)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
             TAB 3: CONTROL DE PERSONAL (Plan Medio+)
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'personal' && (
          <div className="relative">
            {!planMedioAccess && <PlanLockOverlay />}
            <div className={!planMedioAccess ? 'pointer-events-none select-none' : ''}>
              <div className="flex flex-col gap-4">

                {/* Summary Strip */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Empleados Registrados Hoy</p>
                    <p className="mt-2 text-[22px] font-semibold text-white tracking-tight">{asistencia.length}</p>
                  </div>
                  <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Horas Totales Acumuladas</p>
                    <p className="mt-2 text-[22px] font-semibold text-sky-400 tracking-tight">{totalHorasDia.toFixed(1)} hrs</p>
                  </div>
                  <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Costo M.O. del Día</p>
                    <p className="mt-2 text-[22px] font-semibold text-amber-400 tracking-tight">{formatCurrency(costoManoObraDia)}</p>
                    <p className="mt-1 text-[9px] text-zinc-600">{COSTO_HORA_BOB} BOB/hora</p>
                  </div>
                </div>

                {/* Attendance Table */}
                <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 overflow-hidden">
                  <div className="px-5 py-4 border-b-[0.5px] border-zinc-800 bg-zinc-900/20">
                    <h2 className="text-[13px] font-semibold text-white uppercase tracking-wider">
                      👥 Registro de Asistencia del Día
                    </h2>
                    <p className="mt-0.5 text-[10px] text-zinc-500">Datos extraídos de <code className="text-zinc-400">asistencia_personal</code></p>
                  </div>

                  {loadingAsistencia ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="h-6 w-6 border-2 border-zinc-800 border-t-sky-500 rounded-full animate-spin" />
                    </div>
                  ) : asistencia.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-600">
                      <span className="text-3xl mb-3">👥</span>
                      <p className="text-[12px]">No hay registros de asistencia para hoy.</p>
                      <p className="text-[10px] text-zinc-700 mt-1">Los datos se llenan manualmente en la tabla asistencia_personal.</p>
                    </div>
                  ) : (
                    <table className="w-full text-[12px] border-collapse text-left">
                      <thead>
                        <tr className="border-b-[0.5px] border-zinc-800 bg-zinc-900/30 text-zinc-500 font-medium uppercase tracking-wider text-[9px]">
                          <th className="px-5 py-3 font-medium">Empleado</th>
                          <th className="px-5 py-3 font-medium">Rol</th>
                          <th className="px-5 py-3 font-medium">Entrada</th>
                          <th className="px-5 py-3 font-medium">Salida</th>
                          <th className="px-5 py-3 font-medium text-right">Horas</th>
                          <th className="px-5 py-3 font-medium text-right">Costo M.O.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y-[0.5px] divide-zinc-800/60">
                        {asistencia.map((a) => {
                          const horas = calcHorasTrabajadas(a.hora_entrada, a.hora_salida);
                          const costo = (horas * parseFloat(a.costo_hora || String(COSTO_HORA_BOB))).toFixed(2);
                          return (
                            <tr key={a.id} className="hover:bg-zinc-800/20 transition-colors">
                              <td className="px-5 py-3.5 text-white font-medium">{a.nombre_empleado}</td>
                              <td className="px-5 py-3.5">
                                <span className={`rounded-md border-[0.5px] px-2 py-0.5 text-[10px] font-medium ${
                                  a.rol_empleado === 'Cajero' ? 'border-sky-500/20 bg-sky-500/10 text-sky-400' :
                                  a.rol_empleado === 'Cocina' ? 'border-orange-500/20 bg-orange-500/10 text-orange-400' :
                                  'border-violet-500/20 bg-violet-500/10 text-violet-400'
                                }`}>
                                  {a.rol_empleado}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-zinc-400 font-mono text-[11px]">
                                {formatTimestamp(a.hora_entrada)}
                              </td>
                              <td className="px-5 py-3.5 text-zinc-400 font-mono text-[11px]">
                                {a.hora_salida ? formatTimestamp(a.hora_salida) : (
                                  <span className="inline-flex items-center gap-1 text-emerald-400">
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    </span>
                                    En turno
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-right font-mono text-[12px] text-white font-semibold">
                                {horas.toFixed(1)} h
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <span className="rounded-md bg-amber-500/10 border-[0.5px] border-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400 font-mono">
                                  {formatCurrency(costo)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════
             TAB 4: BUZÓN DE SOPORTE AL SUPERADMIN
        ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'soporte' && (
          <div className="grid gap-6 lg:grid-cols-12">

            {/* ─── LEFT: Ticket Form ─── */}
            <div className="lg:col-span-7">
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-6">
                <h2 className="text-[14px] font-semibold text-white flex items-center gap-2 mb-1">
                  🎫 Reportar Incidencia al SuperAdmin
                </h2>
                <p className="text-[11px] text-zinc-500 font-normal mb-5">
                  Este formulario inserta un ticket en <code className="text-zinc-400">tickets_soporte</code> para que el equipo central lo gestione.
                </p>

                <form onSubmit={handleEnviarTicket} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Pantalla / Módulo</label>
                      <select
                        value={ticketPantalla}
                        onChange={(e) => setTicketPantalla(e.target.value)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 cursor-pointer"
                      >
                        <option value="Admin - General">Admin - General</option>
                        <option value="Admin - Inventario">Admin - Error de Inventario</option>
                        <option value="Admin - Flujo de Caja">Admin - Flujo de Caja</option>
                        <option value="Admin - Personal">Admin - Control de Personal</option>
                        <option value="POS - Caja">POS - No genera ticket</option>
                        <option value="Cocina - Comandas">Cocina - No entran comandas</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Gravedad</label>
                      <select
                        value={ticketGravedad}
                        onChange={(e) => setTicketGravedad(e.target.value as any)}
                        className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-3 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 cursor-pointer"
                      >
                        <option value="Critica">🔴 Crítica — Sistema caído</option>
                        <option value="Media">🟡 Media — Funcionalidad afectada</option>
                        <option value="Baja">🔵 Baja — Mejora / sugerencia</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] font-medium uppercase tracking-wider text-zinc-500 block mb-1.5">Descripción del Problema *</label>
                    <textarea
                      required
                      rows={4}
                      value={ticketDescripcion}
                      onChange={(e) => setTicketDescripcion(e.target.value)}
                      placeholder="Describa en detalle el error encontrado, incluyendo los pasos para reproducirlo..."
                      className="w-full rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950 px-4 py-2.5 text-[12px] text-white outline-none focus:border-violet-500/50 placeholder-zinc-700 resize-none leading-relaxed transition-colors"
                    />
                  </div>

                  {/* Preview */}
                  <div className="rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950/60 p-3.5">
                    <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2">Vista previa del ticket</p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className={`rounded-md border-[0.5px] px-2 py-0.5 text-[10px] font-semibold ${
                        ticketGravedad === 'Critica' ? 'bg-red-500/15 text-red-400 border-red-500/20' :
                        ticketGravedad === 'Media' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' :
                        'bg-sky-500/15 text-sky-400 border-sky-500/20'
                      }`}>
                        {ticketGravedad}
                      </span>
                      <span className="text-zinc-500">{ticketPantalla}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-zinc-500">{empresaNombre}</span>
                    </div>
                    {ticketDescripcion && (
                      <p className="mt-2 text-[11px] text-zinc-400 leading-relaxed">{ticketDescripcion}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingTicket}
                    className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 py-3 text-[13px] font-medium text-white transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    {submittingTicket ? 'Enviando...' : '🎫 Enviar Ticket al SuperAdmin'}
                  </button>
                </form>
              </div>
            </div>

            {/* ─── RIGHT: Alertas Recibidas ─── */}
            <div className="lg:col-span-5 flex flex-col gap-4">

              {/* Alertas del SuperAdmin */}
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  📡 Comunicados del SuperAdmin
                  {alertas.length > 0 && (
                    <span className="rounded-full bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
                      {alertas.length}
                    </span>
                  )}
                </h3>
                {alertas.length === 0 ? (
                  <div className="text-center py-8 text-[11px] text-zinc-600">
                    <span className="text-2xl block mb-2">📭</span>
                    Sin comunicados recientes.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {alertas.map((alerta) => (
                      <div key={alerta.id} className="rounded-lg border-[0.5px] border-zinc-800 bg-zinc-950/60 p-3.5">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`h-2 w-2 rounded-full ${
                            alerta.prioridad === 'Urgente' ? 'bg-red-500' :
                            alerta.prioridad === 'Normal' ? 'bg-amber-500' : 'bg-sky-500'
                          }`} />
                          <p className="text-[12px] font-semibold text-white">{alerta.titulo}</p>
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{alerta.mensaje}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${
                            alerta.tipo_alcance === 'Global' ? 'bg-violet-500/10 text-violet-400' :
                            alerta.tipo_alcance === 'Empresa' ? 'bg-sky-500/10 text-sky-400' :
                            'bg-amber-500/10 text-amber-400'
                          }`}>
                            {alerta.tipo_alcance}
                          </span>
                          <span className="text-[9px] text-zinc-600 font-mono">
                            {formatDateTimeFull(alerta.creado_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Guide */}
              <div className="rounded-xl border-[0.5px] border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
                <h3 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Guía de Gravedad</h3>
                <div className="space-y-2">
                  {[
                    { icon: '🔴', label: 'Crítica', desc: 'El sistema está caído o no procesa pedidos. Respuesta inmediata.' },
                    { icon: '🟡', label: 'Media', desc: 'Una funcionalidad no opera correctamente pero el local sigue activo.' },
                    { icon: '🔵', label: 'Baja', desc: 'Sugerencia de mejora o error visual sin impacto operativo.' },
                  ].map(g => (
                    <div key={g.label} className="flex items-start gap-2.5">
                      <span className="text-sm mt-0.5">{g.icon}</span>
                      <div>
                        <p className="text-[11px] font-medium text-zinc-300">{g.label}</p>
                        <p className="text-[10px] text-zinc-600 leading-relaxed">{g.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ─── INLINE ANIMATION KEYFRAMES ─── */}
      <style jsx>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
