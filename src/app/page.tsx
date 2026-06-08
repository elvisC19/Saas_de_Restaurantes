'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RolUsuario } from '@/types/database';

export default function HomePage() {
  const { rol, setRol, empresaNombre } = useAuth();
  const router = useRouter();

  const seleccionarRol = (nuevoRol: RolUsuario) => {
    setRol(nuevoRol);
    if (nuevoRol === 'Administrador') {
      router.push('/admin');
    } else if (nuevoRol === 'Cajero') {
      router.push('/pos');
    } else if (nuevoRol === 'Cocina') {
      router.push('/cocina');
    }
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-radial from-zinc-900 to-black px-6 py-12">
      {/* Elemento decorativo de fondo */}
      <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-500/10 blur-[100px]" />
      <div className="absolute bottom-1/4 left-1/3 -z-10 h-64 w-64 rounded-full bg-rose-500/5 blur-[120px]" />

      <div className="w-full max-w-4xl text-center">
        {/* Cabecera Comercial */}
        <div className="mb-12 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-600 text-3xl shadow-lg shadow-amber-950/30 animate-pulse">
            ☕
          </div>
          <h1 className="bg-gradient-to-r from-amber-200 via-zinc-100 to-rose-200 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            SaaS Gastronómico Multi-tenant
          </h1>
          <p className="mt-3 text-lg text-zinc-400">
            Simulador de Defensa Académica para <span className="font-semibold text-amber-400">{empresaNombre}</span>
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            Infraestructura Costo $0 BOB (Next.js + Supabase)
          </div>
        </div>

        {/* Tarjetas de Selección de Rol */}
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Selecciona tu Rol de Demostración
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Tarjeta Cajero */}
          <button
            onClick={() => seleccionarRol('Cajero')}
            className="group relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-amber-950/10"
          >
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-amber-500/5 opacity-0 transition-opacity group-hover:opacity-100 blur-xl" />
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-2xl text-amber-400 transition-colors group-hover:bg-amber-500 group-hover:text-black">
              🛒
            </div>
            <h3 className="text-lg font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
              Cajero / Mesero
            </h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Accede al Punto de Venta (POS) comercial, gestiona el carrito de compras y simula cobros QR Bolivia de ASFI.
            </p>
            <div className="mt-4 flex items-center text-xs font-semibold text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Ingresar al POS &rarr;
            </div>
          </button>

          {/* Tarjeta Cocina */}
          <button
            onClick={() => seleccionarRol('Cocina')}
            className="group relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-emerald-950/10"
          >
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-emerald-500/5 opacity-0 transition-opacity group-hover:opacity-100 blur-xl" />
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-2xl text-emerald-400 transition-colors group-hover:bg-emerald-500 group-hover:text-black">
              🍳
            </div>
            <h3 className="text-lg font-bold text-zinc-100 group-hover:text-emerald-400 transition-colors">
              Cocina / Barista
            </h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Pantalla KDS en tiempo real. Recibe pedidos de forma automática sin recargar el navegador usando Supabase Realtime.
            </p>
            <div className="mt-4 flex items-center text-xs font-semibold text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Ingresar al KDS &rarr;
            </div>
          </button>

          {/* Tarjeta Administrador */}
          <button
            onClick={() => seleccionarRol('Administrador')}
            className="group relative flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-rose-500/40 hover:bg-zinc-900/80 hover:shadow-lg hover:shadow-rose-950/10"
          >
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-rose-500/5 opacity-0 transition-opacity group-hover:opacity-100 blur-xl" />
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-2xl text-rose-400 transition-colors group-hover:bg-rose-500 group-hover:text-black">
              📦
            </div>
            <h3 className="text-lg font-bold text-zinc-100 group-hover:text-rose-400 transition-colors">
              Administrador
            </h3>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Monitorea el inventario base en tiempo real y verifica el funcionamiento matemático del Trigger de PostgreSQL.
            </p>
            <div className="mt-4 flex items-center text-xs font-semibold text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
              Ingresar al Inventario &rarr;
            </div>
          </button>
        </div>

        {/* Estado actual */}
        {rol && (
          <div className="mt-10 rounded-xl border border-zinc-800/80 bg-zinc-900/20 px-6 py-3 inline-flex items-center gap-4 text-sm text-zinc-400">
            <span>Rol seleccionado actualmente: <strong className="text-zinc-200 uppercase">{rol}</strong></span>
            <button
              onClick={() => {
                if (rol === 'Administrador') router.push('/admin');
                else if (rol === 'Cajero') router.push('/pos');
                else router.push('/cocina');
              }}
              className="text-amber-400 hover:text-amber-300 font-semibold underline"
            >
              Ir a mi panel &rarr;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
