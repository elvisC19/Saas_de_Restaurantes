'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { rol, login, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirigir de manera automática si ya existe una sesión activa y válida
  useEffect(() => {
    if (!authLoading && rol) {
      let target = '/';
      if (rol === 'SuperAdmin') target = '/superadmin';
      else if (rol === 'Administrador') target = '/admin';
      else if (rol === 'Cajero') target = '/pos';
      else if (rol === 'Cocina') target = '/cocina';

      if (target !== '/') {
        router.push(target);
      }
    }
  }, [rol, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor, introduzca su correo y contraseña.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await login(email, password);
      let target = '/';
      if (data.rol === 'SuperAdmin') target = '/superadmin';
      else if (data.rol === 'Administrador') target = '/admin';
      else if (data.rol === 'Cajero') target = '/pos';
      else if (data.rol === 'Cocina') target = '/cocina';

      if (target !== '/') {
        router.push(target);
      } else {
        throw new Error('Rol de usuario no reconocido en la plataforma.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de credenciales. Por favor compruebe sus datos.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-500">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-zinc-800 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-xs font-mono tracking-wider">Cargando sesión segura...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-white font-sans antialiased overflow-x-hidden">
      {/* COLUMNA IZQUIERDA (45% de ancho en pantallas grandes) */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-8 sm:p-12 md:p-16 bg-zinc-950 border-r border-zinc-900/40 z-10">
        {/* Cabecera / Isotipo de Marca */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md">
            <span className="font-mono text-white text-base font-bold tracking-tight">GL</span>
          </div>
          <span className="text-md font-semibold tracking-tight text-white">
            GastroLedger <span className="text-zinc-500 font-normal">SaaS</span>
          </span>
        </div>

        {/* Contenedor del Formulario de Validación */}
        <div className="w-full max-w-[380px] mx-auto my-12">
          <div className="mb-8">
            <h2 className="text-2xl font-medium tracking-tight text-white mb-2">Verificación de Identidad</h2>
            <p className="text-zinc-400 text-sm">Ingrese sus credenciales de acceso institucional.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                Correo Electrónico
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-xs font-mono uppercase tracking-wider text-zinc-400 block">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 font-normal leading-relaxed">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-white hover:bg-zinc-200 active:scale-[0.99] py-3.5 text-xs font-mono font-medium tracking-widest text-zinc-950 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>PROCESANDO...</span>
                </>
              ) : (
                <span>INGRESAR AL SISTEMA</span>
              )}
            </button>
          </form>
        </div>

        {/* Footer Institucional Académico */}
        <div className="text-zinc-500 text-[10px] tracking-wider font-mono text-center lg:text-left">
          USFX — Ingeniería Económica / Proyecto de Grado Consolidado
        </div>
      </div>

      {/* COLUMNA DERECHA (55% de ancho, oculta en móviles) */}
      <div 
        className="hidden lg:flex lg:w-[55%] relative items-center justify-center bg-zinc-900/20 overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(39, 39, 42, 0.4) 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }}
      >
        {/* Luces de acento (Ambient Glow) */}
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/[0.03] blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[450px] h-[450px] rounded-full bg-blue-600/[0.03] blur-[120px] pointer-events-none" />

        {/* Bloque de Respaldo de Marca Minimalista */}
        <div className="max-w-[440px] px-8 text-center lg:text-left">
          <div className="mb-6 inline-block">
            <span className="px-3.5 py-1.5 text-[10px] font-mono tracking-widest uppercase text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full shadow-sm">
              Arquitectura Unificada Multi-Tenant
            </span>
          </div>

          <h3 className="text-3xl font-medium tracking-tight text-white mb-4 leading-tight">
            Infraestructura global para operaciones comerciales de alta precisión.
          </h3>
          
          <p className="text-zinc-400 text-sm leading-relaxed font-normal">
            Monitoreo integrado en tiempo real, gestión inteligente de recursos y control multi-sucursal consolidado en una sola plataforma de confianza empresarial.
          </p>
        </div>
      </div>
    </div>
  );
}
