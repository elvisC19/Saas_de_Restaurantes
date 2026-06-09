'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const navLinks = [
  { href: '/pos', label: 'Punto de Venta', icon: '◉', roles: ['Administrador', 'Cajero'] },
  { href: '/cocina', label: 'Cocina KDS', icon: '◎', roles: ['Administrador', 'Cocina'] },
  { href: '/admin', label: 'Dashboard', icon: '◈', roles: ['Administrador'] },
];

export default function Navbar() {
  const { rol, setRol, empresaNombre } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (!rol) return null;

  const handleLogout = () => {
    setRol(null);
    router.push('/');
  };

  const rolColor: Record<string, string> = {
    Administrador: 'from-indigo-500 to-violet-600',
    Cajero: 'from-amber-500 to-orange-600',
    Cocina: 'from-emerald-500 to-teal-600',
  };

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/[0.04]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${rolColor[rol] || 'from-zinc-600 to-zinc-700'} text-sm font-black text-white shadow-lg transition-transform group-hover:scale-105`}>
            G
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-[13px] font-bold text-white tracking-tight">{empresaNombre}</span>
            <span className="text-[10px] font-medium text-zinc-500 tracking-wide">SAAS GASTRONÓMICO</span>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.04] bg-white/[0.02] p-1">
          {navLinks
            .filter((link) => link.roles.includes(rol))
            .map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold tracking-wide transition-all duration-200 ${
                    isActive
                      ? 'bg-white/[0.08] text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className={`text-[11px] ${isActive ? 'text-emerald-400' : ''}`}>{link.icon}</span>
                  <span className="hidden md:inline">{link.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-[5px] left-1/2 h-[2px] w-4 -translate-x-1/2 rounded-full bg-emerald-400" />
                  )}
                </Link>
              );
            })}
        </div>

        {/* Right side: role badge + actions */}
        <div className="flex items-center gap-2.5">
          <div className={`flex items-center gap-1.5 rounded-full bg-gradient-to-r ${rolColor[rol] || 'from-zinc-600 to-zinc-700'} px-3 py-1 shadow-lg`}>
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[11px] font-bold text-white uppercase tracking-wider">{rol}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition-all hover:bg-white/[0.06] hover:text-white hover:border-white/[0.1]"
            title="Cambiar Rol"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
