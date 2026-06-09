'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RolUsuario } from '@/types/database';
import { initDatabaseSeed } from '@/lib/db-init';

interface AuthContextType {
  rol: RolUsuario | null;
  empresaId: number;
  giro: 'CAFETERIA' | 'RESTAURANTE' | null;
  empresaNombre: string;
  setRol: (rol: RolUsuario | null) => void;
  setGiro: (giro: 'CAFETERIA' | 'RESTAURANTE' | null) => void;
  setEmpresaId: (id: number) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [rol, setRolState] = useState<RolUsuario | null>(null);
  const [giro, setGiroState] = useState<'CAFETERIA' | 'RESTAURANTE' | null>(null);
  const [empresaId, setEmpresaIdState] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  // Cargar estados persistidos al iniciar en el cliente
  useEffect(() => {
    try {
      const savedRol = localStorage.getItem('saas_gastronomico_rol');
      if (savedRol) {
        setRolState(savedRol as RolUsuario);
      }

      const savedGiro = localStorage.getItem('saas_gastronomico_giro');
      const loadedGiro = (savedGiro as 'CAFETERIA' | 'RESTAURANTE') || 'CAFETERIA';
      setGiroState(loadedGiro);

      const savedEmpresaId = localStorage.getItem('saas_gastronomico_empresa_id');
      const loadedEmpresaId = savedEmpresaId ? Number(savedEmpresaId) : 1;
      setEmpresaIdState(loadedEmpresaId);

      // Semillar base de datos en base al giro cargado
      initDatabaseSeed(loadedEmpresaId);
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

  const setGiro = (nuevoGiro: 'CAFETERIA' | 'RESTAURANTE' | null) => {
    setGiroState(nuevoGiro);
    try {
      if (nuevoGiro) {
        localStorage.setItem('saas_gastronomico_giro', nuevoGiro);
        // Semillar la base de datos para el nuevo giro seleccionado
        initDatabaseSeed(empresaId);
      } else {
        localStorage.removeItem('saas_gastronomico_giro');
      }
    } catch (error) {
      console.error('Error al guardar giro en localStorage:', error);
    }
  };

  const setEmpresaId = (nuevaEmpresaId: number) => {
    setEmpresaIdState(nuevaEmpresaId);
    try {
      localStorage.setItem('saas_gastronomico_empresa_id', String(nuevaEmpresaId));
    } catch (error) {
      console.error('Error al guardar empresa_id en localStorage:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        rol,
        empresaId,
        giro,
        empresaNombre: 'Café Central Sucre',
        setRol,
        setGiro,
        setEmpresaId,
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

