import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Las variables de entorno de Supabase no están configuradas en el servidor.' },
        { status: 500 }
      );
    }

    const { email, password, nombre, rol, empresaId } = await req.json();

    if (!email || !password || !nombre || !rol || !empresaId) {
      return NextResponse.json(
        { error: 'Todos los campos son obligatorios.' },
        { status: 400 }
      );
    }

    // Inicializar cliente administrativo de Supabase
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Crear el usuario directamente en Auth y confirmarlo inmediatamente
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authErr) {
      return NextResponse.json(
        { error: `Error al crear usuario en autenticación: ${authErr.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'No se pudo obtener el usuario creado.' },
        { status: 400 }
      );
    }

    // Crear el perfil correspondiente en la tabla relacional 'usuarios'
    const { error: profileErr } = await supabaseAdmin.from('usuarios').insert({
      id: authData.user.id,
      empresa_id: parseInt(empresaId, 10),
      nombre: nombre.trim(),
      rol: rol
    });

    if (profileErr) {
      // Intentar limpiar/eliminar el usuario en Auth si falla la inserción del perfil
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: `Error al registrar perfil de usuario: ${profileErr.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id
    });
  } catch (error: any) {
    console.error('Error en API de creación de usuario:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
