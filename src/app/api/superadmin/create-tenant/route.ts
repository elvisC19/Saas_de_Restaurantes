import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

// Inicializar cliente de Supabase con privilegios administrativos
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(req: Request) {
  try {
    // Validar configuración de variables de entorno del servidor
    if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === 'placeholder-key') {
      return NextResponse.json(
        { error: 'La clave de servicio SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.' },
        { status: 500 }
      );
    }

    const { nombre, giro, plan, email, password } = await req.json();

    if (!nombre || !giro || !plan || !email || !password) {
      return NextResponse.json({ error: 'Todos los campos son obligatorios.' }, { status: 400 });
    }

    // 1. Crear el usuario en Supabase Auth
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Confirmar correo automáticamente
    });

    if (userErr) {
      return NextResponse.json({ error: `Error al crear Auth User: ${userErr.message}` }, { status: 400 });
    }

    if (!userData.user) {
      return NextResponse.json({ error: 'No se pudo crear el usuario de autenticación.' }, { status: 400 });
    }

    const userId = userData.user.id;

    // Mapear valor del plan mensual
    const planVal = plan === 'Premium' ? 450.00 : plan === 'Medio' ? 280.00 : 140.00;

    // 2. Insertar en la tabla de empresas
    const { data: empData, error: empErr } = await supabaseAdmin
      .from('empresas')
      .insert({
        nombre,
        giro,
        plan_mensual: planVal
      })
      .select()
      .single();

    if (empErr) {
      // Rollback: Eliminar usuario creado si falla la empresa
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Error al registrar empresa: ${empErr.message}` }, { status: 400 });
    }

    const empresaId = empData.id;

    // 3. Insertar el perfil de usuario en la tabla usuarios vinculando al tenant
    const { error: perfilErr } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: userId,
        empresa_id: empresaId,
        nombre: `Administrador de ${nombre}`,
        rol: 'Administrador'
      });

    if (perfilErr) {
      // Rollback: Eliminar empresa y usuario si falla el perfil
      await supabaseAdmin.from('empresas').delete().eq('id', empresaId);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: `Error al crear perfil de usuario: ${perfilErr.message}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, empresaId });
  } catch (error: any) {
    console.error('Error en Route Handler de Tenant:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
