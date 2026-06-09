import { supabase } from './supabase';

export async function initDatabaseSeed(empresaId: number = 1) {
  try {
    console.log('Iniciando verificación y semillado de base de datos...');

    // 1. Asegurar que la Empresa con id 1 existe
    const { data: emp, error: empErr } = await supabase
      .from('empresas')
      .select('id')
      .eq('id', empresaId);

    if (empErr) {
      console.error('Error al verificar empresa:', empErr);
    }
    if (!emp || emp.length === 0) {
      const { error: insertEmpErr } = await supabase
        .from('empresas')
        .insert({
          id: empresaId,
          nombre: 'Café Central Sucre',
          plan_mensual: 280.00
        });
      if (insertEmpErr) {
        console.error('Error al insertar empresa por defecto:', insertEmpErr);
      } else {
        console.log('Empresa por defecto creada exitosamente.');
      }
    }

    // 2. Definir Insumos del Sistema
    const insumosSeed = [
      // Cafetería
      { nombre: 'Café en grano', stock_actual: 5000.0000, unidad_medida: 'gr' },
      { nombre: 'Leche entera', stock_actual: 10000.0000, unidad_medida: 'ml' },
      { nombre: 'Azúcar', stock_actual: 3000.0000, unidad_medida: 'gr' },
      { nombre: 'Agua purificada', stock_actual: 20000.0000, unidad_medida: 'ml' },
      { nombre: 'Taza descartable 8oz', stock_actual: 200.0000, unidad_medida: 'unidades' },
      
      // Restaurante
      { nombre: 'Lomo de res', stock_actual: 10000.0000, unidad_medida: 'gr' },
      { nombre: 'Papas', stock_actual: 100.0000, unidad_medida: 'unidades' },
      { nombre: 'Arroz', stock_actual: 5000.0000, unidad_medida: 'gr' },
      { nombre: 'Aceite', stock_actual: 2000.0000, unidad_medida: 'ml' },
      { nombre: 'Huevo', stock_actual: 50.0000, unidad_medida: 'unidades' }
    ];

    // Cargar insumos existentes
    const { data: existingInsumos, error: insErr } = await supabase
      .from('inventario_insumos')
      .select('*')
      .eq('empresa_id', empresaId);

    if (insErr) throw insErr;

    const insumoMap: Record<string, number> = {};
    existingInsumos?.forEach((ins) => {
      insumoMap[ins.nombre] = ins.id;
    });

    // Insertar insumos faltantes
    for (const seed of insumosSeed) {
      if (!insumoMap[seed.nombre]) {
        const { data, error } = await supabase
          .from('inventario_insumos')
          .insert({
            empresa_id: empresaId,
            nombre: seed.nombre,
            stock_actual: seed.stock_actual,
            unidad_medida: seed.unidad_medida
          })
          .select()
          .single();

        if (error) {
          console.error(`Error al insertar insumo ${seed.nombre}:`, error);
        } else if (data) {
          console.log(`Insumo sembrado: ${seed.nombre} con ID ${data.id}`);
          insumoMap[seed.nombre] = data.id;
        }
      }
    }

    // 3. Definir Ítems de Menú
    const itemsSeed = [
      // Cafetería
      { nombre: 'Café Americano', precio: 12.00 },
      { nombre: 'Café con Leche', precio: 15.00 },
      { nombre: 'Café Espresso', precio: 10.00 },
      { nombre: 'Capuccino', precio: 18.00 },
      
      // Restaurante
      { nombre: 'Lomo Saltado', precio: 35.00 },
      { nombre: 'Sopa de Maní', precio: 15.00 }
    ];

    const { data: existingItems, error: itemsErr } = await supabase
      .from('items_menu')
      .select('*')
      .eq('empresa_id', empresaId);

    if (itemsErr) throw itemsErr;

    const itemsMap: Record<string, number> = {};
    existingItems?.forEach((item) => {
      itemsMap[item.nombre] = item.id;
    });

    for (const seed of itemsSeed) {
      if (!itemsMap[seed.nombre]) {
        const { data, error } = await supabase
          .from('items_menu')
          .insert({
            empresa_id: empresaId,
            nombre: seed.nombre,
            precio: seed.precio
          })
          .select()
          .single();

        if (error) {
          console.error(`Error al insertar plato/producto ${seed.nombre}:`, error);
        } else if (data) {
          console.log(`Ítem de menú sembrado: ${seed.nombre} con ID ${data.id}`);
          itemsMap[seed.nombre] = data.id;
        }
      }
    }

    // 4. Definir Fórmulas / Recetas
    const recipesSeed = [
      // Café Americano: 18g Café, 150ml Agua, 1 Taza
      {
        itemName: 'Café Americano',
        ingredients: [
          { name: 'Café en grano', qty: 18.0000 },
          { name: 'Agua purificada', qty: 150.0000 },
          { name: 'Taza descartable 8oz', qty: 1.0000 }
        ]
      },
      // Café con Leche: 18g Café, 120ml Leche, 50ml Agua, 1 Taza
      {
        itemName: 'Café con Leche',
        ingredients: [
          { name: 'Café en grano', qty: 18.0000 },
          { name: 'Leche entera', qty: 120.0000 },
          { name: 'Agua purificada', qty: 50.0000 },
          { name: 'Taza descartable 8oz', qty: 1.0000 }
        ]
      },
      // Café Espresso: 18g Café, 40ml Agua, 1 Taza
      {
        itemName: 'Café Espresso',
        ingredients: [
          { name: 'Café en grano', qty: 18.0000 },
          { name: 'Agua purificada', qty: 40.0000 },
          { name: 'Taza descartable 8oz', qty: 1.0000 }
        ]
      },
      // Capuccino: 18g Café, 150ml Leche, 40ml Agua, 1 Taza
      {
        itemName: 'Capuccino',
        ingredients: [
          { name: 'Café en grano', qty: 18.0000 },
          { name: 'Leche entera', qty: 150.0000 },
          { name: 'Agua purificada', qty: 40.0000 },
          { name: 'Taza descartable 8oz', qty: 1.0000 }
        ]
      },
      // Lomo Saltado: 200g Lomo, 3 Papas, 150g Arroz, 30ml Aceite
      {
        itemName: 'Lomo Saltado',
        ingredients: [
          { name: 'Lomo de res', qty: 200.0000 },
          { name: 'Papas', qty: 3.0000 },
          { name: 'Arroz', qty: 150.0000 },
          { name: 'Aceite', qty: 30.0000 }
        ]
      },
      // Sopa de Maní: 1 Papa, 30g Arroz, 1 Huevo
      {
        itemName: 'Sopa de Maní',
        ingredients: [
          { name: 'Papas', qty: 1.0000 },
          { name: 'Arroz', qty: 30.0000 },
          { name: 'Huevo', qty: 1.0000 }
        ]
      }
    ];

    // Cargar recetas existentes para evitar duplicados
    const { data: existingRecetas, error: recErr } = await supabase
      .from('receta_detail')
      .select('*');

    if (recErr) throw recErr;

    const recetaSet = new Set(existingRecetas?.map((r) => `${r.item_menu_id}_${r.insumo_id}`));

    for (const rSeed of recipesSeed) {
      const itemId = itemsMap[rSeed.itemName];
      if (!itemId) continue;

      for (const ing of rSeed.ingredients) {
        const insumoId = insumoMap[ing.name];
        if (!insumoId) continue;

        const key = `${itemId}_${insumoId}`;
        if (!recetaSet.has(key)) {
          const { error } = await supabase
            .from('receta_detail')
            .insert({
              item_menu_id: itemId,
              insumo_id: insumoId,
              cantidad_requerida: ing.qty
            });

          if (error) {
            console.error(`Error al insertar receta para ${rSeed.itemName} -> ${ing.name}:`, error);
          } else {
            console.log(`Receta insertada para ${rSeed.itemName} -> ${ing.name}`);
          }
        }
      }
    }

    console.log('Comprobación de semillado finalizada.');
  } catch (err) {
    console.error('Error en initDatabaseSeed:', err);
  }
}
