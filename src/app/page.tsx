'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RolUsuario } from '@/types/database';

export default function HomePage() {
  const { rol, giro, login, loading: authLoading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedGiro, setSelectedGiro] = useState<'CAFETERIA' | 'RESTAURANTE'>('CAFETERIA');
  const [selectedRol, setSelectedRol] = useState<RolUsuario>('Cajero');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Redirigir si ya hay sesión activa
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
      const data = await login(email, password, selectedRol, selectedGiro);
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

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Selector Obligatorio de Giro */}
          <div>
            <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] block mb-2">
              Giro Comercial
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedGiro('CAFETERIA')}
                className={`flex flex-col items-center justify-center p-3 rounded-[var(--radius-sm)] border-[0.5px] transition-all text-[12px] font-medium ${
                  selectedGiro === 'CAFETERIA'
                    ? 'border-[var(--accent)] bg-[var(--accent-dark)] text-white'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                }`}
              >
                <span className="text-base mb-1">☕</span>
                <span>Cafetería</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedGiro('RESTAURANTE')}
                className={`flex flex-col items-center justify-center p-3 rounded-[var(--radius-sm)] border-[0.5px] transition-all text-[12px] font-medium ${
                  selectedGiro === 'RESTAURANTE'
                    ? 'border-[var(--accent)] bg-[var(--accent-dark)] text-white'
                    : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                }`}
              >
                <span className="text-base mb-1">🍽️</span>
                <span>Restaurante</span>
              </button>
            </div>
          </div>

          {/* Selector de Rol */}
          <div>
            <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] block mb-2">
              Rol de Acceso
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['Cajero', 'Cocina', 'Administrador'] as RolUsuario[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRol(r)}
                  className={`py-2 px-1 text-[11px] rounded-[var(--radius-sm)] border-[0.5px] transition-all font-normal ${
                    selectedRol === r
                      ? 'border-[var(--accent)] bg-[var(--accent-dark)] text-white font-medium'
                      : 'border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Credenciales */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] block mb-1.5">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@gastroledger.com"
                className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--text-muted)] block mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-[var(--radius-sm)] border-[0.5px] border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder-[var(--text-dim)] outline-none focus:border-[var(--accent)]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[var(--radius-sm)] bg-[var(--accent)] py-3.5 text-[13px] font-medium text-white transition-all hover:bg-[var(--accent-dark)] active:scale-[0.98] disabled:opacity-40"
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
