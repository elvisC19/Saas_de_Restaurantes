'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RolUsuario } from '@/types/database';

const roles: { id: RolUsuario; title: string; subtitle: string; redirect: string; gradient: string; icon: React.ReactNode }[] = [
  {
    id: 'Cajero',
    title: 'Cajero / Mesero',
    subtitle: 'Punto de Venta, carrito y cobros QR',
    redirect: '/pos',
    gradient: 'from-amber-500/20 to-orange-500/5',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  {
    id: 'Cocina',
    title: 'Cocina / Barista',
    subtitle: 'Pantalla KDS en tiempo real',
    redirect: '/cocina',
    gradient: 'from-emerald-500/20 to-teal-500/5',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
  {
    id: 'Administrador',
    title: 'Administrador',
    subtitle: 'KPIs, inventario y control financiero',
    redirect: '/admin',
    gradient: 'from-indigo-500/20 to-violet-500/5',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
];

const metrics = [
  { label: 'Costo Infraestructura', value: '0.00 Bs.', sublabel: 'Supabase Free Tier' },
  { label: 'Consistencia Decimal', value: 'NUMERIC(10,2)', sublabel: 'Sin pérdida de centavos' },
  { label: 'Arquitectura', value: 'Multi-tenant', sublabel: 'Aislamiento por empresa_id' },
  { label: 'Trigger SQL', value: 'Automático', sublabel: 'Descuento por receta' },
];

export default function HomePage() {
  const { rol, setRol, giro, setGiro, empresaNombre } = useAuth();
  const router = useRouter();

  const seleccionarRol = (r: RolUsuario, redirect: string) => {
    if (!giro) {
      setGiro('CAFETERIA'); // default fallback
    }
    setRol(r);
    router.push(redirect);
  };

  return (
    <div className="flex flex-1 flex-col lg:flex-row min-h-screen bg-zinc-950">
      {/* ───── Columna Izquierda: Hero / Branding ───── */}
      <div className="relative flex flex-col justify-between overflow-hidden lg:w-[45%] p-8 lg:p-12">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-zinc-950 to-emerald-950/20" />
        <div className="absolute top-0 right-0 h-[500px] w-[500px] rounded-full bg-indigo-500/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.05] blur-[100px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col gap-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-black text-lg shadow-xl shadow-indigo-500/20">
              G
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-tight">GastroSaaS</span>
              <span className="ml-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                MVP v1.0
              </span>
            </div>
          </div>

          <div className="max-w-md">
            <h1 className="text-[2.5rem] leading-[1.1] font-extrabold text-white tracking-tight lg:text-5xl">
              Control total
              <br />
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent animate-gradient-x">
                de tu negocio
              </span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
              Plataforma de gestión integral para <strong className="text-zinc-200">{empresaNombre}</strong>. 
              Punto de venta, cocina en tiempo real e inventario con precisión financiera de 4 decimales.
            </p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="relative z-10 mt-8 grid grid-cols-2 gap-3 lg:mt-auto">
          {metrics.map((m, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-3.5 backdrop-blur-sm animate-slide-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">{m.label}</p>
              <p className="mt-1 text-lg font-extrabold text-white tracking-tight">{m.value}</p>
              <p className="text-[10px] text-zinc-600">{m.sublabel}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ───── Columna Derecha: Selector de Rol ───── */}
      <div className="flex flex-1 flex-col items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="mb-6 text-center lg:text-left">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600">Simulador de Defensa</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Selecciona tu perfil</h2>
            <p className="mt-1 text-sm text-zinc-500">Configura tu giro y accede al módulo correspondiente</p>
          </div>

          {/* Giro Selector (Cafetería vs. Restaurante) */}
          <div className="mb-6">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block mb-3">
              Giro del Negocio
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setGiro('CAFETERIA')}
                className={`flex items-center justify-center gap-2.5 rounded-xl border p-3.5 text-xs font-bold transition-all duration-300 ${
                  giro === 'CAFETERIA'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-lg shadow-amber-500/5'
                    : 'border-white/[0.04] bg-white/[0.01] text-zinc-400 hover:border-white/[0.08] hover:bg-white/[0.02]'
                }`}
              >
                <span className="text-base">☕</span>
                Cafetería
              </button>
              <button
                onClick={() => setGiro('RESTAURANTE')}
                className={`flex items-center justify-center gap-2.5 rounded-xl border p-3.5 text-xs font-bold transition-all duration-300 ${
                  giro === 'RESTAURANTE'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/5'
                    : 'border-white/[0.04] bg-white/[0.01] text-zinc-400 hover:border-white/[0.08] hover:bg-white/[0.02]'
                }`}
              >
                <span className="text-base">🍽️</span>
                Restaurante
              </button>
            </div>
          </div>

          {/* Role Cards */}
          <div className="flex flex-col gap-3">
            {roles.map((r) => (
              <button
                key={r.id}
                onClick={() => seleccionarRol(r.id, r.redirect)}
                className={`group relative flex items-center gap-4 rounded-2xl border border-white/[0.04] bg-gradient-to-r ${r.gradient} p-5 text-left transition-all duration-300 hover:border-white/[0.08] hover:scale-[1.01] hover:shadow-xl active:scale-[0.99]`}
              >
                {/* Icon */}
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.04] text-zinc-300 transition-colors group-hover:text-white group-hover:bg-white/[0.08]">
                  {r.icon}
                </div>

                {/* Text */}
                <div className="flex-1">
                  <h3 className="text-[15px] font-bold text-white">{r.title}</h3>
                  <p className="text-[12px] text-zinc-500 group-hover:text-zinc-400 transition-colors">{r.subtitle}</p>
                </div>

                {/* Arrow */}
                <svg className="h-4 w-4 text-zinc-600 transition-all group-hover:text-white group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            ))}
          </div>

          {/* Currently selected */}
          {rol && (
            <div className="mt-6 flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 animate-slide-up">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-zinc-400">Sesión activa como <strong className="text-white">{rol}</strong> ({giro === 'RESTAURANTE' ? 'Restaurante' : 'Cafetería'})</span>
              </div>
              <button
                onClick={() => {
                  const target = rol === 'Administrador' ? '/admin' : rol === 'Cajero' ? '/pos' : '/cocina';
                  router.push(target);
                }}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* Footer branding */}
          <div className="mt-10 flex items-center justify-center gap-2 text-[10px] text-zinc-700">
            <span>Ingeniería Económica</span>
            <span>·</span>
            <span>Universidad Mayor de San Francisco Xavier</span>
          </div>
        </div>
      </div>
    </div>
  );
}
