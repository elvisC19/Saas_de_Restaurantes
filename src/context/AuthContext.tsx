'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RolUsuario } from '@/types/database';

interface AuthContextType {
  rol: RolUsuario | null;
  empresaId: number;
  empresaNombre: string;
  setRol: (rol: RolUsuario | null) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [rol, setRolState] = useState<RolUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar rol persistido al iniciar en el cliente
  useEffect(() => {
    try {
      const savedRol = localStorage.getItem('saas_gastronomico_rol');
      if (savedRol) {
        setRolState(savedRol as RolUsuario);
      }
    } catch (error) {
      console.error('Error al acceder a localStorage:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const setRol = (nuevoRol: RolUsuario | null) => {
    setRolState(nuevoRol);
    try {
      if (nuevoRol) {
        localStorage.setItem('saas_gastronomico_rol', nuevoRol);
      } else {
        localStorage.removeItem('saas_gastronomico_rol');
      }
    } catch (error) {
      console.error('Error al guardar en localStorage:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        rol,
        empresaId: 1, // Fijo Café Central Sucre (Tenant 1)
        empresaNombre: 'Café Central Sucre',
        setRol,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
}
