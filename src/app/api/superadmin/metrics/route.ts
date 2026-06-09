import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Las variables de entorno de Supabase no están configuradas en el servidor.' },
        { status: 500 }
      );
    }

    // 1. Obtener datos de empresas para calcular inquilinos y MRR
    const { data: companies, error: compError } = await supabaseAdmin
      .from('empresas')
      .select('plan_suscripcion, estado_cuenta, plan_mensual');

    if (compError) throw compError;

    const totalTenants = companies?.length || 0;
    const activeTenants = companies?.filter(c => c.estado_cuenta === 'Activo').length || 0;

    // MRR: Básico = 140 BOB, Medio = 280 BOB, Premium = 450 BOB
    let mrr = 0;
    companies?.forEach(c => {
      if (c.estado_cuenta === 'Activo') {
        const plan = (c.plan_suscripcion || '').toLowerCase();
        if (plan === 'premium' || Number(c.plan_mensual) === 450) {
          mrr += 450;
        } else if (plan === 'medio' || Number(c.plan_mensual) === 280) {
          mrr += 280;
        } else {
          mrr += 140;
        }
      }
    });

    // 2. Calcular volumen histórico GMV transaccionado en el POS
    const { data: pedidos, error: pedError } = await supabaseAdmin
      .from('pedidos')
      .select('total')
      .eq('estado', 'Pagado');

    if (pedError) throw pedError;

    let gmv = 0;
    pedidos?.forEach(p => {
      gmv += parseFloat(p.total || '0');
    });

    return NextResponse.json({
      success: true,
      totalTenants,
      activeTenants,
      mrr,
      gmv
    });
  } catch (error: any) {
    console.error('Error al calcular métricas consolidadas:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
