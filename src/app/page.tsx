'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const { rol, giro, login, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirigir automáticamente si ya hay sesión activa
  useEffect(() => {
    if (!authLoading && rol && giro) {
      const target = rol === 'Administrador' ? '/admin' : rol === 'Cajero' ? '/pos' : '/cocina';
      router.push(target);
    }
  }, [rol, giro, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Por favor introduce tu correo y contraseña.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await login(email, password);
      const target = data.rol === 'Administrador' ? '/admin' : data.rol === 'Cajero' ? '/pos' : '/cocina';
      router.push(target);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de credenciales. Por favor comprueba tus datos.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-[var(--bg-base)] text-[var(--text-muted)]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-[var(--border-default)] border-t-[var(--accent)] rounded-full animate-spin" />
          <span className="text-[12px] font-normal">Cargando sesión segura...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center min-h-screen bg-[var(--bg-base)] px-4">
      {/* Contenedor central de Login */}
      <div className="w-full max-w-[400px] rounded-[var(--radius-lg)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-card)] p-8">
        
        {/* Header con Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <h1 className="text-[24px] font-medium tracking-tight text-[var(--accent)]">
            GastroLedger
          </h1>
          <p className="mt-1 text-[12px] text-[var(--text-dim)] font-normal">
            Plataforma SaaS gastronómica
          </p>
        </div>

        {/* Píldoras de Giro (Decorativas no interactivas) */}
        <div className="flex gap-2 justify-center mb-6">
          <div className="rounded-full px-3.5 py-1 text-[12px] font-medium bg-[var(--accent-dark)] text-[var(--accent-light)] border-[0.5px] border-[var(--border-default)]">
            ☕ Cafetería
          </div>
          <div className="rounded-full px-3.5 py-1 text-[12px] font-medium bg-[var(--bg-surface)] text-[var(--text-muted)] border-[0.5px] border-[var(--border-default)] opacity-60">
            🍽️ Restaurante
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] block mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ejemplo@gastroledger.com"
              className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--accent)]"
            />
          </div>

          <div>
            <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] block mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none transition-all focus:border-[var(--accent)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-3 text-[13px] font-medium text-white transition-all hover:bg-[var(--accent-dark)] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Validando...' : 'Ingresar'}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-4 text-[12px] text-[var(--danger)] text-center font-normal">
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}
