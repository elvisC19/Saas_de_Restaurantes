'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { RolUsuario } from '@/types/database';
import { supabase } from '@/lib/supabase';


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
  login: (email: string, password: string) => Promise<{ rol: RolUsuario; giro: 'CAFETERIA' | 'RESTAURANTE' | null; empresaId: number }>;
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

  const login = async (email: string, password: string) => {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authErr) throw authErr;
    if (!authData.user) throw new Error('No se pudo autenticar el usuario.');

    try {
      // 1. Obtener perfil de usuario desde la tabla 'usuarios'
      const { data: userData, error: userErr } = await supabase
        .from('usuarios')
        .select('empresa_id, rol, nombre')
        .eq('id', authData.user.id)
        .single();

      if (userErr || !userData) {
        throw new Error('El usuario no posee un perfil configurado en la base de datos.');
      }

      const userRol = userData.rol as RolUsuario;
      const userEmpresaId = userData.empresa_id || 1; // Fallback de seguridad si no hay empresa (ej: SuperAdmin global)

      // 2. Obtener datos de la empresa si existe empresa_id
      let empGiro: 'CAFETERIA' | 'RESTAURANTE' | null = null;
      let empNombre = 'Plataforma SaaS';
      let empPlan: 'basico' | 'medio' | 'premium' | null = null;

      if (userData.empresa_id) {
        const { data: empData, error: empErr } = await supabase
          .from('empresas')
          .select('giro, nombre, plan_mensual')
          .eq('id', userData.empresa_id)
          .single();

        if (!empErr && empData) {
          empGiro = empData.giro as 'CAFETERIA' | 'RESTAURANTE';
          empNombre = empData.nombre;
          empPlan = derivePlan(empData.plan_mensual);
        }
      }

      // Guardar estados en el AuthContext
      setRolState(userRol);
      setGiroState(empGiro);
      setEmpresaIdState(userEmpresaId);
      setEmpresaNombreState(empNombre);
      setPlanState(empPlan);

      // Guardar en localStorage para persistencia
      localStorage.setItem('rol', userRol);
      if (empGiro) {
        localStorage.setItem('giro', empGiro);
      } else {
        localStorage.removeItem('giro');
      }
      localStorage.setItem('empresaId', String(userEmpresaId));



      return {
        rol: userRol,
        giro: empGiro,
        empresaId: userEmpresaId
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
