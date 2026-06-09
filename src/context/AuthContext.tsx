'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RolUsuario } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { initDatabaseSeed } from '@/lib/db-init';

interface AuthContextType {
  rol: RolUsuario | null;
  empresaId: number;
  giro: 'CAFETERIA' | 'RESTAURANTE' | null;
  empresaNombre: string;
  plan: 'basico' | 'medio' | 'premium' | null;
  setRol: (rol: RolUsuario | null) => void;
  setGiro: (giro: 'CAFETERIA' | 'RESTAURANTE' | null) => void;
  setEmpresaId: (id: number) => void;
  loading: boolean;
  login: (email: string, password: string, selectedRol: RolUsuario, selectedGiro: 'CAFETERIA' | 'RESTAURANTE') => Promise<{ rol: RolUsuario; giro: 'CAFETERIA' | 'RESTAURANTE'; empresaId: number }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [rol, setRolState] = useState<RolUsuario | null>(null);
  const [giro, setGiroState] = useState<'CAFETERIA' | 'RESTAURANTE' | null>(null);
  const [empresaId, setEmpresaIdState] = useState<number>(1);
  const [empresaNombre, setEmpresaNombreState] = useState<string>('GastroLedger');
  const [plan, setPlanState] = useState<'basico' | 'medio' | 'premium' | null>(null);
  const [loading, setLoading] = useState(true);

  const derivePlan = (planMensual: any): 'basico' | 'medio' | 'premium' => {
    if (!planMensual) return 'basico';
    const num = Number(planMensual);
    if (num >= 450) return 'premium';
    if (num >= 280) return 'medio';
    return 'basico';
  };

  const fetchSessionData = async (userId: string) => {
    try {
      // 1. Obtener perfil de usuario
      const { data: userData, error: userErr } = await supabase
        .from('usuarios')
        .select('empresa_id, rol, nombre')
        .eq('id', userId)
        .single();

      if (userErr || !userData) {
        console.error('Error al consultar perfil del usuario o registro inexistente:', userErr);
        return null;
      }

      // 2. Obtener datos de la empresa (giro, nombre, plan_mensual)
      const { data: empData, error: empErr } = await supabase
        .from('empresas')
        .select('giro, nombre, plan_mensual')
        .eq('id', userData.empresa_id)
        .single();

      if (empErr || !empData) {
        console.error('Error al consultar empresa o registro inexistente:', empErr);
        return null;
      }

      // 3. Semillar datos si es necesario
      await initDatabaseSeed(userData.empresa_id);

      return {
        rol: userData.rol as RolUsuario,
        giro: empData.giro as 'CAFETERIA' | 'RESTAURANTE',
        empresaId: userData.empresa_id,
        empresaNombre: empData.nombre,
        plan: derivePlan(empData.plan_mensual)
      };
    } catch (error) {
      console.error('Error imprevisto en fetchSessionData:', error);
      return null;
    }
  };

  // Cargar y observar sesión
  useEffect(() => {
    let active = true;

    async function loadInitialSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user && active) {
          const storedRol = localStorage.getItem('rol') as RolUsuario | null;
          const storedGiro = localStorage.getItem('giro') as 'CAFETERIA' | 'RESTAURANTE' | null;
          const storedEmpresaId = localStorage.getItem('empresaId');

          if (storedRol && storedGiro && storedEmpresaId && active) {
            setRolState(storedRol);
            setGiroState(storedGiro);
            setEmpresaIdState(Number(storedEmpresaId));

            const { data: empData } = await supabase
              .from('empresas')
              .select('plan_mensual, nombre')
              .eq('id', Number(storedEmpresaId))
              .single();

            if (empData && active) {
              setEmpresaNombreState(empData.nombre);
              setPlanState(derivePlan(empData.plan_mensual));
            }
          } else {
            const data = await fetchSessionData(session.user.id);
            if (data && active) {
              setRolState(data.rol);
              setGiroState(data.giro);
              setEmpresaIdState(data.empresaId);
              setEmpresaNombreState(data.empresaNombre);
              setPlanState(data.plan);
            }
          }
        }
      } catch (err) {
        console.error('Error al restaurar sesión activa:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadInitialSession();

    // Suscribirse a cambios en tiempo real de Supabase Auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (session?.user) {
        try {
          const storedRol = localStorage.getItem('rol') as RolUsuario | null;
          const storedGiro = localStorage.getItem('giro') as 'CAFETERIA' | 'RESTAURANTE' | null;
          const storedEmpresaId = localStorage.getItem('empresaId');

          if (storedRol && storedGiro && storedEmpresaId && active) {
            setRolState(storedRol);
            setGiroState(storedGiro);
            setEmpresaIdState(Number(storedEmpresaId));

            const { data: empData } = await supabase
              .from('empresas')
              .select('plan_mensual, nombre')
              .eq('id', Number(storedEmpresaId))
              .single();

            if (empData && active) {
              setEmpresaNombreState(empData.nombre);
              setPlanState(derivePlan(empData.plan_mensual));
            }
          } else {
            const data = await fetchSessionData(session.user.id);
            if (data && active) {
              setRolState(data.rol);
              setGiroState(data.giro);
              setEmpresaIdState(data.empresaId);
              setEmpresaNombreState(data.empresaNombre);
              setPlanState(data.plan);
            }
          }
        } catch (err) {
          console.error('Error al cargar perfil tras cambio de estado:', err);
        }
      } else {
        setRolState(null);
        setGiroState(null);
        setEmpresaIdState(1);
        setEmpresaNombreState('GastroLedger');
        setPlanState(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string, selectedRol: RolUsuario, selectedGiro: 'CAFETERIA' | 'RESTAURANTE') => {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authErr) throw authErr;
    if (!authData.user) throw new Error('No se pudo autenticar el usuario.');

    try {
      setRolState(selectedRol);
      setGiroState(selectedGiro);
      setEmpresaIdState(1); // Empresa fija en 1 para la simulación de entorno del onboarding

      localStorage.setItem('rol', selectedRol);
      localStorage.setItem('giro', selectedGiro);
      localStorage.setItem('empresaId', '1');

      const { data: empData } = await supabase
        .from('empresas')
        .select('plan_mensual, nombre')
        .eq('id', 1)
        .single();

      if (empData) {
        setEmpresaNombreState(empData.nombre);
        setPlanState(derivePlan(empData.plan_mensual));
      }

      return {
        rol: selectedRol,
        giro: selectedGiro,
        empresaId: 1
      };
    } catch (err) {
      await supabase.auth.signOut();
      localStorage.removeItem('rol');
      localStorage.removeItem('giro');
      localStorage.removeItem('empresaId');
      throw err;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('rol');
    localStorage.removeItem('giro');
    localStorage.removeItem('empresaId');
    setRolState(null);
    setGiroState(null);
    setEmpresaIdState(1);
    setEmpresaNombreState('GastroLedger');
    setPlanState(null);
  };

  const setRol = (nuevoRol: RolUsuario | null) => {
    setRolState(nuevoRol);
    if (nuevoRol) localStorage.setItem('rol', nuevoRol);
    else localStorage.removeItem('rol');
  };
  
  const setGiro = (nuevoGiro: 'CAFETERIA' | 'RESTAURANTE' | null) => {
    setGiroState(nuevoGiro);
    if (nuevoGiro) localStorage.setItem('giro', nuevoGiro);
    else localStorage.removeItem('giro');
  };

  const setEmpresaId = (nuevaEmpresaId: number) => {
    setEmpresaIdState(nuevaEmpresaId);
    localStorage.setItem('empresaId', String(nuevaEmpresaId));
  };

  return (
    <AuthContext.Provider
      value={{
        rol,
        empresaId,
        giro,
        empresaNombre,
        plan,
        setRol,
        setGiro,
        setEmpresaId,
        loading,
        login,
        logout,
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
