'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RolUsuario } from '@/types/database';

const roles: { id: RolUsuario; title: string; subtitle: string; redirect: string; gradient: string; icon: React.ReactNode }[] = [
  {
    id: 'Cajero',
    title: 'Cajero / Mesero',
    subtitle: 'Módulo de transacciones, comandas y cobros QR',
    redirect: '/pos',
    gradient: 'from-amber-500/10 to-orange-500/5',
    icon: (
      <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  {
    id: 'Cocina',
    title: 'Cocina / Barista',
    subtitle: 'Visualización y despacho de pedidos en tiempo real',
    redirect: '/cocina',
    gradient: 'from-emerald-500/10 to-teal-500/5',
    icon: (
      <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
  {
    id: 'Administrador',
    title: 'Administrador',
    subtitle: 'KPIs analíticos, control de inventario y finanzas',
    redirect: '/admin',
    gradient: 'from-indigo-500/10 to-violet-500/5',
    icon: (
      <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const { rol, setRol, giro, setGiro, empresaNombre } = useAuth();
  const router = useRouter();

  const seleccionarRol = (r: RolUsuario, redirect: string) => {
    if (!giro) {
      setGiro('CAFETERIA');
    }
    setRol(r);
    router.push(redirect);
  };

  return (
    <div className="relative flex flex-1 items-center justify-center min-h-screen bg-zinc-950 px-4 overflow-hidden">
      {/* Fondo estético con glow de alta gama */}
      <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950" />
      <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.04] blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.02] blur-[120px] pointer-events-none" />

      {/* Contenedor central de Login */}
      <div className="relative z-10 w-full max-w-[440px] rounded-3xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl p-8 shadow-2xl animate-fade-in">
        
        {/* Header con Branding */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600 text-white font-black text-xl shadow-xl shadow-indigo-500/25 mb-4">
            G
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            GastroLedger <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">SaaS</span>
          </h1>
          <p className="mt-1.5 text-[13px] text-zinc-400 leading-normal max-w-[280px]">
            Plataforma corporativa de operaciones y control de inventarios para <strong className="text-zinc-200">{empresaNombre}</strong>
          </p>
        </div>

        {/* Selector de Giro de Negocio */}
        <div className="mb-6">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block mb-3 text-center">
            Seleccionar Giro Comercial
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setGiro('CAFETERIA')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3.5 text-xs font-bold transition-all duration-300 ${
                giro === 'CAFETERIA'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-md shadow-amber-500/5'
                  : 'border-white/[0.04] bg-white/[0.01] text-zinc-400 hover:border-white/[0.08] hover:bg-white/[0.02]'
              }`}
            >
              <span className="text-base">☕</span>
              Cafetería
            </button>
            <button
              onClick={() => setGiro('RESTAURANTE')}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3.5 text-xs font-bold transition-all duration-300 ${
                giro === 'RESTAURANTE'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shadow-md shadow-emerald-500/5'
                  : 'border-white/[0.04] bg-white/[0.01] text-zinc-400 hover:border-white/[0.08] hover:bg-white/[0.02]'
              }`}
            >
              <span className="text-base">🍽️</span>
              Restaurante
            </button>
          </div>
        </div>

        {/* Grid de Roles */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 block mb-1 text-center">
            Acceder según Perfil
          </label>
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => seleccionarRol(r.id, r.redirect)}
              className={`group w-full relative flex items-center gap-4 rounded-2xl border border-white/[0.03] bg-zinc-950/40 p-4.5 text-left transition-all duration-300 hover:border-white/[0.08] hover:bg-zinc-950 hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]`}
            >
              {/* Icon Container */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.04] bg-white/[0.02] text-zinc-400 transition-all group-hover:text-white group-hover:bg-white/[0.06] bg-gradient-to-tr ${r.gradient}`}>
                {r.icon}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <h3 className="text-[14px] font-bold text-white tracking-wide">{r.title}</h3>
                <p className="text-[11px] text-zinc-500 group-hover:text-zinc-400 transition-colors truncate">{r.subtitle}</p>
              </div>

              {/* Arrow */}
              <svg className="h-4 w-4 text-zinc-700 transition-all group-hover:text-white group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>

        {/* Sesión Activa / Continuar */}
        {rol && (
          <div className="mt-6 flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3 animate-slide-up">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-zinc-400">
                Activo como <strong className="text-white">{rol}</strong> ({giro === 'RESTAURANTE' ? 'Restaurante' : 'Cafetería'})
              </span>
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

        {/* Footer */}
        <div className="mt-8 text-center text-[10px] text-zinc-600 tracking-wide font-medium">
          GastroLedger Inc. © {new Date().getFullYear()} · Enterprise Session Secured
        </div>
      </div>
    </div>
  );
}
