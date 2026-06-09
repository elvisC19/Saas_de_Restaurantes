'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePlanGuard } from '@/hooks/usePlanGuard';
import UpgradePrompt from '@/components/UpgradePrompt';
import { formatCurrency } from '@/lib/math';

interface Financials {
  gmv: string;
  ticketPromedio: string;
  growthPercent: string;
  impuestosSimulados: string;
  comisionesQR: string;
}

interface WeeklySale {
  name: string;
  value: number;
}

interface TopProduct {
  nombre: string;
  cantidad: number;
  totalCaja: number;
}

interface AuditLog {
  id: number;
  fecha: string;
  canal: string;
  monto: number;
  estado: string;
}

interface ReportData {
  financials: Financials;
  hourlySales: number[];
  weeklySales: WeeklySale[];
  topProducts: TopProduct[];
  auditLogs: AuditLog[];
}

export default function ReportsPage() {
  const { rol, empresaId, giro, empresaNombre } = useAuth();
  const router = useRouter();
  const { hasAccess: planPermiteReportes, userPlan } = usePlanGuard('premium');

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtro para la auditoría de pedidos
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');

  useEffect(() => {
    if (!rol || !giro) {
      router.push('/');
    }
  }, [rol, giro, router]);

  const fetchReports = async () => {
    if (!rol || !giro || !planPermiteReportes) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/reports?empresa_id=${empresaId}`);
      if (!res.ok) {
        throw new Error('Error al consultar el endpoint de reportes.');
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        throw new Error(json.error || 'Respuesta no exitosa del servidor.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'No se pudo cargar la información de reportes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [rol, empresaId, giro, planPermiteReportes]);

  const handleExportJSON = () => {
    if (!data) return;
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `reporte_operativo_empresa_${empresaId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  // Redirección o aviso si el plan no es Premium
  if (!planPermiteReportes) {
    return (
      <div className="flex flex-1 flex-col bg-[var(--bg-base)] p-6 lg:p-8 justify-center items-center">
        <UpgradePrompt
          title="Módulo de Reportes Gerenciales Restringido"
          message="La analítica avanzada de tendencias de consumo, ticket promedio y reportes de auditoría están disponibles de manera exclusiva en el Plan Premium (450 BOB)."
          requiredPlan="Premium"
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-[var(--text-dim)] bg-[var(--bg-base)] text-[12px] font-normal">
        Cargando analítica avanzada…
      </div>
    );
  }

  if (errorMsg || !data) {
    return (
      <div className="flex flex-1 flex-col bg-[var(--bg-base)] p-6 lg:p-8 items-center justify-center gap-4">
        <div className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--danger)] bg-[var(--bg-surface)] p-4 text-[12px] text-[var(--danger)] font-normal max-w-md text-center">
          {errorMsg || 'No se pudo estructurar el reporte gerencial.'}
        </div>
        <button
          onClick={fetchReports}
          className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-4 py-2 text-[11px] font-medium text-white hover:bg-[var(--bg-card)] transition-all"
        >
          Intentar de Nuevo
        </button>
      </div>
    );
  }

  // Filtrar los logs de auditoría
  const filteredLogs = data.auditLogs.filter((log) => {
    const matchesSearch =
      log.id.toString().includes(searchQuery) ||
      log.canal.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || log.estado === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Encontrar el valor máximo de tendencias para escalar las gráficas
  const maxHourlyVal = Math.max(...data.hourlySales, 1);
  const maxWeeklyVal = Math.max(...data.weeklySales.map((w) => w.value), 1);
  const maxProductQty = Math.max(...data.topProducts.map((p) => p.cantidad), 1);

  // Formato de fechas
  const formatHour = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
    } catch {
      return isoStr;
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const isGrowthPositive = parseFloat(data.financials.growthPercent) >= 0;

  return (
    <div className="flex flex-1 flex-col bg-[var(--bg-base)] overflow-y-auto">
      {/* Estilos para impresión */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          nav, .no-print, button, input, select {
            display: none !important;
          }
          .print-card {
            background: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
          .print-text {
            color: #000000 !important;
          }
          .print-border {
            border-color: #cbd5e1 !important;
          }
        }
      `}} />

      <div className="mx-auto w-full max-w-6xl p-6 lg:p-8 space-y-6">
        
        {/* ───── Header Principal ───── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-[0.5px] border-zinc-800 pb-5 no-print">
          <div className="flex flex-col gap-1">
            <h1 className="text-[20px] font-medium text-[var(--text-primary)] tracking-tight">Consola de Reportes Premium</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[12px] text-[var(--text-dim)] font-normal">Negocio: {empresaNombre} · Giro: {giro === 'CAFETERIA' ? '☕ Cafetería' : '🍽️ Restaurante'}</span>
              <span className="rounded-full border-[0.5px] border-zinc-800 bg-[var(--accent-dark)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--accent-light)] uppercase tracking-wider">
                Elite Premium
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-4 py-2 text-[11px] font-medium text-white hover:bg-[var(--bg-card)] transition-all flex items-center gap-1.5"
            >
              <span>🖨️</span> Imprimir Reporte
            </button>
            <button
              onClick={handleExportJSON}
              className="rounded-[var(--radius-sm)] border-[0.5px] border-[var(--accent)] bg-transparent px-4 py-2 text-[11px] font-medium text-[var(--accent-light)] hover:bg-[var(--accent)] hover:text-white transition-all flex items-center gap-1.5"
            >
              <span>📥</span> Exportar Reporte Operativo
            </button>
          </div>
        </div>

        {/* ───── Sección para Impresión (Sólo visible al imprimir) ───── */}
        <div className="hidden print:block border-b-2 border-slate-300 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-slate-800">REPORTE FINANCIERO GERENCIAL</h1>
          <p className="text-xs text-slate-500 mt-1">Empresa: {empresaNombre} | Giro: {giro} | Fecha: {new Date().toLocaleDateString('es-BO')}</p>
        </div>

        {/* ───── SECCIÓN 1: Rendimiento Financiero (KPI Grid) ───── */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* GMV */}
          <div className="rounded-[var(--radius-md)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700 transition-all print-card">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)] print-text">Volumen de Transacciones (GMV)</span>
            <div className="flex items-baseline justify-between mt-3">
              <span className="text-[20px] font-medium text-white tracking-tight print-text">
                {formatCurrency(data.financials.gmv)}
              </span>
              <span className={`rounded-full border-[0.5px] px-2 py-0.5 text-[10px] font-medium ${
                isGrowthPositive 
                  ? 'text-emerald-400 border-emerald-950 bg-emerald-500/10' 
                  : 'text-rose-400 border-rose-950 bg-rose-500/10'
              }`}>
                {isGrowthPositive ? '+' : ''}{data.financials.growthPercent}%
              </span>
            </div>
            <span className="text-[9px] text-[var(--text-dim)] mt-2 font-normal print-text">Crecimiento versus jornada previa</span>
          </div>

          {/* Ticket Promedio */}
          <div className="rounded-[var(--radius-md)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700 transition-all print-card">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)] print-text">Ticket Promedio</span>
            <div className="flex items-baseline mt-3">
              <span className="text-[20px] font-medium text-white tracking-tight print-text">
                {formatCurrency(data.financials.ticketPromedio)}
              </span>
            </div>
            <span className="text-[9px] text-[var(--text-dim)] mt-2 font-normal print-text">Monto promedio por comanda/mesa</span>
          </div>

          {/* Impuestos IVA */}
          <div className="rounded-[var(--radius-md)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700 transition-all print-card">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)] print-text">Impuestos Devengados (13% IVA)</span>
            <div className="flex items-baseline mt-3">
              <span className="text-[20px] font-medium text-white tracking-tight print-text">
                {formatCurrency(data.financials.impuestosSimulados)}
              </span>
            </div>
            <span className="text-[9px] text-[var(--text-dim)] mt-2 font-normal print-text">Simulación tributaria estándar</span>
          </div>

          {/* Comisiones QR */}
          <div className="rounded-[var(--radius-md)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-5 flex flex-col justify-between min-h-[110px] hover:border-zinc-700 transition-all print-card">
            <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)] print-text">Comisiones Pasarela (1% QR)</span>
            <div className="flex items-baseline mt-3">
              <span className="text-[20px] font-medium text-white tracking-tight print-text">
                {formatCurrency(data.financials.comisionesQR)}
              </span>
            </div>
            <span className="text-[9px] text-[var(--text-dim)] mt-2 font-normal print-text">Costo financiero estimado por QR interoperable</span>
          </div>

        </div>

        {/* ───── SECCIÓN 2: Tendencias de Ventas (Hourly & Weekly Charts) ───── */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Horas Pico (Hourly) */}
          <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6 print-card">
            <div className="mb-4">
              <h3 className="text-[14px] font-medium text-white print-text">Distribución de Ventas por Hora</h3>
              <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-normal print-text">Horas pico de afluencia y facturación en el local</p>
            </div>
            
            <div className="h-[200px] flex items-end justify-between gap-1 pt-6 px-2 border-b-[0.5px] border-zinc-800 print-border">
              {data.hourlySales.map((sales, hour) => {
                const heightPercent = (sales / maxHourlyVal) * 100;
                return (
                  <div key={hour} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-[var(--bg-surface)] border-[0.5px] border-zinc-800 text-[10px] text-white px-2 py-0.5 rounded-[var(--radius-sm)] whitespace-nowrap pointer-events-none">
                      {hour}:00 - {sales.toFixed(1)} Bs.
                    </div>
                    {/* Bar */}
                    <div 
                      style={{ height: `${Math.max(heightPercent, 2)}%` }} 
                      className={`w-full rounded-t-[2px] transition-all duration-300 ${
                        sales > 0 
                          ? 'bg-gradient-to-t from-[var(--accent-dark)] to-[var(--accent)] group-hover:opacity-90' 
                          : 'bg-zinc-800/20'
                      }`}
                    />
                    {/* Label */}
                    <span className="text-[8px] text-[var(--text-dim)] mt-2 print-text">
                      {hour % 4 === 0 ? `${hour}h` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Días de la Semana (Weekly) */}
          <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6 print-card">
            <div className="mb-4">
              <h3 className="text-[14px] font-medium text-white print-text">Facturación por Día de la Semana</h3>
              <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-normal print-text">Histórico transaccionado ordenado por día laboral</p>
            </div>

            <div className="h-[200px] flex items-end justify-between gap-4 pt-6 px-4 border-b-[0.5px] border-zinc-800 print-border">
              {data.weeklySales.map((dayObj) => {
                const heightPercent = (dayObj.value / maxWeeklyVal) * 100;
                return (
                  <div key={dayObj.name} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-[var(--bg-surface)] border-[0.5px] border-zinc-800 text-[10px] text-white px-2 py-0.5 rounded-[var(--radius-sm)] whitespace-nowrap pointer-events-none">
                      {dayObj.name}: {dayObj.value.toFixed(1)} Bs.
                    </div>
                    {/* Bar */}
                    <div
                      style={{ height: `${Math.max(heightPercent, 2)}%` }}
                      className={`w-full max-w-[32px] rounded-t-[3px] transition-all duration-300 ${
                        dayObj.value > 0
                          ? 'bg-gradient-to-t from-indigo-600 to-purple-500 group-hover:opacity-90'
                          : 'bg-zinc-800/20'
                      }`}
                    />
                    {/* Label */}
                    <span className="text-[9px] text-[var(--text-dim)] mt-2 print-text">{dayObj.name}</span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ───── SECCIÓN 3: Análisis de Productos & Auditoría ───── */}
        <div className="grid gap-6 lg:grid-cols-5">
          
          {/* Productos más vendidos (Top Ventas) */}
          <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6 lg:col-span-2 flex flex-col justify-between print-card">
            <div>
              <div className="mb-4">
                <h3 className="text-[14px] font-medium text-white print-text">Platos y Productos Más Vendidos</h3>
                <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-normal print-text">Ranking por volumen de salida y aportación en caja</p>
              </div>

              <div className="space-y-4">
                {data.topProducts.length === 0 ? (
                  <div className="text-center py-8 text-[11px] text-[var(--text-dim)] print-text">No hay registros de platos vendidos.</div>
                ) : (
                  data.topProducts.map((p, index) => {
                    const widthPercent = (p.cantidad / maxProductQty) * 100;
                    return (
                      <div key={p.nombre} className="space-y-1">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-white font-medium print-text">{index + 1}. {p.nombre}</span>
                          <span className="text-[var(--text-dim)] print-text">
                            {p.cantidad} u. · <strong className="text-[var(--accent-light)] font-normal print-text">{p.totalCaja.toFixed(2)} BOB</strong>
                          </span>
                        </div>
                        {/* Progress Bar Container */}
                        <div className="h-1.5 w-full rounded-full bg-zinc-800/40 overflow-hidden">
                          <div 
                            style={{ width: `${widthPercent}%` }} 
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="pt-4 border-t-[0.5px] border-zinc-800 mt-6 text-center no-print">
              <span className="text-[10px] text-[var(--text-dim)] font-normal">Datos consolidados del total histórico</span>
            </div>
          </div>

          {/* Historial de Auditoría (Last 100 Orders) */}
          <div className="rounded-[var(--radius-lg)] border-[0.5px] border-zinc-800 bg-[var(--bg-card)] p-6 lg:col-span-3 flex flex-col justify-between print-card">
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 no-print">
                <div>
                  <h3 className="text-[14px] font-medium text-white print-text">Auditoría de Transacciones</h3>
                  <p className="text-[10px] text-[var(--text-dim)] mt-0.5 font-normal print-text">Revisión de los últimos 100 pedidos procesados</p>
                </div>
                
                {/* Filtros de la auditoría */}
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Buscar ID o Mesa…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[var(--accent)] font-normal"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-[var(--radius-sm)] border-[0.5px] border-zinc-800 bg-[var(--bg-surface)] px-2 py-1 text-[10px] text-white focus:outline-none focus:border-[var(--accent)] font-normal"
                  >
                    <option value="Todos">Todos</option>
                    <option value="Pagado">Pagados</option>
                    <option value="Pendiente">Pendientes</option>
                    <option value="En Preparación">En Preparación</option>
                    <option value="Listo">Listos</option>
                  </select>
                </div>
              </div>

              <div className="hidden print:block mb-3">
                <h3 className="text-sm font-semibold text-slate-800">Historial de Auditoría de Transacciones</h3>
              </div>

              {/* Table wrapper with scroll */}
              <div className="overflow-y-auto max-h-[300px] border-[0.5px] border-zinc-800 rounded-[var(--radius-md)] print-border">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[var(--bg-surface)] border-b-[0.5px] border-zinc-800 text-[var(--text-dim)] print-border">
                      <th className="px-3.5 py-2.5 font-medium print-text">ID Pedido</th>
                      <th className="px-3.5 py-2.5 font-medium print-text">Fecha/Hora</th>
                      <th className="px-3.5 py-2.5 font-medium print-text">Canal</th>
                      <th className="px-3.5 py-2.5 font-medium text-right print-text">Monto</th>
                      <th className="px-3.5 py-2.5 font-medium text-center print-text">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 print:divide-slate-200">
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3.5 py-8 text-center text-[var(--text-dim)] print-text">
                          No se encontraron pedidos con los criterios definidos.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                          <td className="px-3.5 py-2 text-white font-mono print-text">#{log.id}</td>
                          <td className="px-3.5 py-2 text-[var(--text-muted)] print-text">
                            {formatDate(log.fecha)} {formatHour(log.fecha)}
                          </td>
                          <td className="px-3.5 py-2 text-white print-text">{log.canal}</td>
                          <td className="px-3.5 py-2 text-right text-[var(--accent-light)] font-medium print-text">
                            {log.monto.toFixed(2)} BOB
                          </td>
                          <td className="px-3.5 py-2 text-center">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-medium border-[0.5px] ${
                              log.estado === 'Pagado'
                                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-950'
                                : log.estado === 'Pendiente'
                                ? 'text-amber-400 bg-amber-500/10 border-amber-950'
                                : 'text-indigo-400 bg-indigo-500/10 border-indigo-950'
                            }`}>
                              {log.estado}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="pt-4 border-t-[0.5px] border-zinc-800 mt-6 flex items-center justify-between text-[10px] text-[var(--text-dim)] font-normal no-print">
              <span>Registros cargados: {filteredLogs.length} de {data.auditLogs.length}</span>
              <span>Filtrado en tiempo real</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
