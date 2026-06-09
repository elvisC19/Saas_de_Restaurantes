import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Las variables de entorno de Supabase no están configuradas en el servidor.' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const empresaIdStr = searchParams.get('empresa_id') || '1';
    const empresaId = parseInt(empresaIdStr, 10);

    // 1. Obtener todos los pedidos pagados para estadísticas financieras
    const { data: paidOrders, error: paidError } = await supabaseAdmin
      .from('pedidos')
      .select('id, total, creado_at, mesa_id')
      .eq('empresa_id', empresaId)
      .eq('estado', 'Pagado');

    if (paidError) throw paidError;

    // 2. Obtener los detalles de pedidos de pedidos pagados para el ranking de productos
    const { data: details, error: detailsError } = await supabaseAdmin
      .from('detalle_pedidos')
      .select('cantidad, item_menu_id, items_menu(nombre, precio), pedidos!inner(empresa_id, estado)')
      .eq('pedidos.empresa_id', empresaId)
      .eq('pedidos.estado', 'Pagado');

    if (detailsError) throw detailsError;

    // 3. Obtener los últimos 100 pedidos (cualquier estado) con su mesa para la auditoría
    const { data: recentOrders, error: recentError } = await supabaseAdmin
      .from('pedidos')
      .select('id, total, estado, creado_at, mesa_id, mesas(numero_mesa)')
      .eq('empresa_id', empresaId)
      .order('creado_at', { ascending: false })
      .limit(100);

    if (recentError) throw recentError;

    // --- CÁLCULOS FINANCIEROS ---
    let gmv = 0;
    paidOrders?.forEach(p => {
      gmv += parseFloat(p.total || '0');
    });

    const ticketPromedio = paidOrders && paidOrders.length > 0 ? gmv / paidOrders.length : 0;

    // Impuestos simulados (13% IVA) y comisiones QR (1% de pasarela QR)
    const impuestosSimulados = gmv * 0.13;
    const comisionesQR = gmv * 0.01;

    // --- CRECIMIENTO COMPARATIVO HASTA EL ÚLTIMO DÍA CON ACTIVIDAD ---
    let growthPercent = 0;
    if (paidOrders && paidOrders.length > 0) {
      const dates = paidOrders.map(o => o.creado_at.split('T')[0]);
      dates.sort();
      const latestDateStr = dates[dates.length - 1];

      const latestDate = new Date(latestDateStr);
      const dayBeforeDate = new Date(latestDate.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeStr = dayBeforeDate.toISOString().split('T')[0];

      let latestDaySales = 0;
      let dayBeforeSales = 0;

      paidOrders.forEach(o => {
        const dStr = o.creado_at.split('T')[0];
        if (dStr === latestDateStr) {
          latestDaySales += parseFloat(o.total || '0');
        } else if (dStr === dayBeforeStr) {
          dayBeforeSales += parseFloat(o.total || '0');
        }
      });

      if (dayBeforeSales > 0) {
        growthPercent = ((latestDaySales - dayBeforeSales) / dayBeforeSales) * 100;
      } else if (latestDaySales > 0) {
        growthPercent = 100;
      }
    }

    // --- TENDENCIA DE VENTAS POR HORA (0 - 23) ---
    const hourlySales = Array(24).fill(0);
    paidOrders?.forEach(o => {
      try {
        const timePart = o.creado_at.split('T')[1];
        if (timePart) {
          const hour = parseInt(timePart.split(':')[0], 10);
          if (hour >= 0 && hour < 24) {
            hourlySales[hour] += parseFloat(o.total || '0');
          }
        }
      } catch (err) {
        // Ignorar errores de parsing
      }
    });

    // --- TENDENCIA DE VENTAS POR DÍA DE LA SEMANA (Lunes a Domingo) ---
    // Mapeamos Date.getDay(): 0 = Domingo, 1 = Lunes, etc.
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dailySalesMap: Record<string, number> = {
      'Lun': 0, 'Mar': 0, 'Mié': 0, 'Jue': 0, 'Vie': 0, 'Sáb': 0, 'Dom': 0
    };
    
    paidOrders?.forEach(o => {
      try {
        const dateObj = new Date(o.creado_at);
        const dayIndex = dateObj.getDay();
        const name = dayNames[dayIndex];
        if (name) {
          dailySalesMap[name] = (dailySalesMap[name] || 0) + parseFloat(o.total || '0');
        }
      } catch (err) {
        // Ignorar
      }
    });

    const weeklySales = [
      { name: 'Lun', value: dailySalesMap['Lun'] },
      { name: 'Mar', value: dailySalesMap['Mar'] },
      { name: 'Mié', value: dailySalesMap['Mié'] },
      { name: 'Jue', value: dailySalesMap['Jue'] },
      { name: 'Vie', value: dailySalesMap['Vie'] },
      { name: 'Sáb', value: dailySalesMap['Sáb'] },
      { name: 'Dom', value: dailySalesMap['Dom'] }
    ];

    // --- RANKING DE PRODUCTOS MÁS VENDIDOS ---
    const productSalesMap: Record<number, { nombre: string, cantidad: number, totalCaja: number }> = {};
    
    details?.forEach(d => {
      const itemMenu: any = d.items_menu;
      if (!itemMenu) return;
      
      const itemId = d.item_menu_id;
      const itemName = Array.isArray(itemMenu) ? itemMenu[0]?.nombre : itemMenu.nombre;
      const itemPrice = parseFloat(Array.isArray(itemMenu) ? itemMenu[0]?.precio : itemMenu.precio) || 0;
      const qty = d.cantidad || 0;

      if (!productSalesMap[itemId]) {
        productSalesMap[itemId] = {
          nombre: itemName || `Producto #${itemId}`,
          cantidad: 0,
          totalCaja: 0
        };
      }
      productSalesMap[itemId].cantidad += qty;
      productSalesMap[itemId].totalCaja += qty * itemPrice;
    });

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8); // Top 8 productos

    // --- FORMATEAR AUDITORÍA RECIENTE ---
    const auditLogs = (recentOrders || []).map(o => {
      const rawMesa: any = o.mesas;
      const mesaNum = rawMesa ? (Array.isArray(rawMesa) ? rawMesa[0]?.numero_mesa : rawMesa.numero_mesa) : null;
      return {
        id: o.id,
        fecha: o.creado_at,
        canal: mesaNum ? `Mesa ${mesaNum}` : 'Barra',
        monto: parseFloat(o.total || '0'),
        estado: o.estado
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        financials: {
          gmv: gmv.toFixed(2),
          ticketPromedio: ticketPromedio.toFixed(2),
          growthPercent: growthPercent.toFixed(1),
          impuestosSimulados: impuestosSimulados.toFixed(2),
          comisionesQR: comisionesQR.toFixed(2)
        },
        hourlySales,
        weeklySales,
        topProducts,
        auditLogs
      }
    });

  } catch (error: any) {
    console.error('Error al generar reporte premium:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
