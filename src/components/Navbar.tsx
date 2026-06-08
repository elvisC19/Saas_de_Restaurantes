'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { rol, setRol, empresaNombre } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!rol) return null;

  const handleLogout = () => {
    setRol(null);
    router.push('/');
  };

  // Determinar color de badge según rol
  const getBadgeClass = () => {
    switch (rol) {
      case 'Administrador':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/25';
      case 'Cajero':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'Cocina':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/25';
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Logo / Nombre */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 text-white font-bold shadow-md shadow-amber-900/20">
            ☕
          </div>
          <div>
            <span className="bg-gradient-to-r from-amber-400 to-rose-400 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              {empresaNombre}
            </span>
            <span className="ml-2 hidden text-xs font-medium text-zinc-500 sm:inline">
              SaaS Multi-tenant
            </span>
          </div>
        </div>

        {/* Links de Navegación según Rol */}
        <div className="flex items-center gap-1 sm:gap-2">
          {(rol === 'Administrador' || rol === 'Cajero') && (
            <Link
              href="/pos"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === '/pos'
                  ? 'bg-zinc-800 text-amber-400'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              🛒 Punto de Venta
            </Link>
          )}

          {(rol === 'Administrador' || rol === 'Cocina') && (
            <Link
              href="/cocina"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === '/cocina'
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              🍳 Cocina (KDS)
            </Link>
          )}

          {rol === 'Administrador' && (
            <Link
              href="/admin"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                pathname === '/admin'
                  ? 'bg-zinc-800 text-rose-400'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              📦 Inventario
            </Link>
          )}
        </div>

        {/* Badge de Rol y botón de logout */}
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${getBadgeClass()}`}>
            {rol}
          </span>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white"
          >
            🚪 Cambiar Rol
          </button>
        </div>
      </div>
    </nav>
  );
}
