-- =============================================================================
-- SCRIPT DE BASE DE DATOS - MVP SAAS GASTRONÓMICO MULTI-TENANT
-- =============================================================================
-- Este script crea las tablas, el trigger de control de inventario y los datos
-- semilla requeridos. Ejecútalo directamente en el SQL Editor de Supabase.
-- =============================================================================

-- Limpieza previa de tablas (en orden inverso de dependencias por si existen)
DROP TRIGGER IF EXISTS trg_descontar_inventario ON pedidos;
DROP FUNCTION IF EXISTS descontar_inventario_por_pedido();
DROP TABLE IF EXISTS detalle_pedidos CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS receta_detail CASCADE;
DROP TABLE IF EXISTS items_menu CASCADE;
DROP TABLE IF EXISTS inventario_insumos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;
DROP TABLE IF EXISTS empresas CASCADE;

-- 1. TABLA DE EMPRESAS / INQUILINOS (SaaS Tenants)
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    plan_mensual NUMERIC(10,2) NOT NULL, -- Planes de negocio: 140.00, 280.00, 450.00 Bs.
    creado_at TIMESTAMP DEFAULT NOW()
);

-- 2. PERFILES DE USUARIO vinculados a una empresa (Role-Based Access Control)
CREATE TABLE usuarios (
    id UUID REFERENCES auth.users PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('Administrador', 'Cajero', 'Cocina')),
    creado_at TIMESTAMP DEFAULT NOW()
);

-- 3. INVENTARIO DE INSUMOS BASE (Materias primas)
CREATE TABLE inventario_insumos (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    stock_actual NUMERIC(12,4) NOT NULL, -- Alta precisión decimal para gramos/ml
    unidad_medida VARCHAR(10) NOT NULL CHECK (unidad_medida IN ('gr', 'ml', 'unidades'))
);

-- 4. ÍTEMS DEL MENÚ COMERCIAL (Productos terminados)
CREATE TABLE items_menu (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10,2) NOT NULL -- Dinero con precisión de 2 decimales
);

-- 5. RELACIÓN MULTI-A-MULTI (Recetario Avanzado con Costo Directo)
CREATE TABLE receta_detail (
    id SERIAL PRIMARY KEY,
    item_menu_id INT REFERENCES items_menu(id) ON DELETE CASCADE,
    insumo_id INT REFERENCES inventario_insumos(id) ON DELETE CASCADE,
    cantidad_requerida NUMERIC(12,4) NOT NULL, -- Cantidad exacta requerida por porción
    UNIQUE (item_menu_id, insumo_id)
);

-- 6. CABECERA DE PEDIDOS
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    total NUMERIC(10,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Preparación', 'Listo', 'Pagado')),
    creado_at TIMESTAMP DEFAULT NOW()
);

-- 7. DETALLE DE PEDIDOS
CREATE TABLE detalle_pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    item_menu_id INT REFERENCES items_menu(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0)
);

-- =============================================================================
-- AUTOMATIZACIÓN DE INVENTARIO: TRIGGER POSTGRESQL
-- =============================================================================

-- Función que realiza el descuento físico agrupado
CREATE OR REPLACE FUNCTION descontar_inventario_por_pedido()
RETURNS TRIGGER AS $$
BEGIN
    -- El trigger se dispara cuando el estado del pedido pasa a ser 'Pagado'
    -- y previamente no estaba en ese estado.
    IF (NEW.estado = 'Pagado' AND OLD.estado IS DISTINCT FROM 'Pagado') THEN
        
        -- Actualizamos el inventario_insumos restando el consumo agrupado por insumo_id.
        -- Agrupar primero previene anomalías si un insumo es referenciado varias veces.
        UPDATE inventario_insumos ii
        SET stock_actual = ii.stock_actual - sub.total_descuento
        FROM (
            SELECT rd.insumo_id, SUM(rd.cantidad_requerida * dp.cantidad) AS total_descuento
            FROM detalle_pedidos dp
            JOIN receta_detail rd ON rd.item_menu_id = dp.item_menu_id
            WHERE dp.pedido_id = NEW.id
            GROUP BY rd.insumo_id
        ) sub
        WHERE ii.id = sub.insumo_id;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Definición del Trigger en la tabla de pedidos
CREATE TRIGGER trg_descontar_inventario
AFTER UPDATE ON pedidos
FOR EACH ROW
EXECUTE FUNCTION descontar_inventario_por_pedido();

-- =============================================================================
-- DATA SEMILLA OBLIGATORIA (Café Central Sucre)
-- =============================================================================

-- 1. Insertar Empresa
INSERT INTO empresas (id, nombre, plan_mensual)
VALUES (1, 'Café Central Sucre', 280.00);

-- Ajustar secuencia del autoincremental de empresas
SELECT setval(pg_get_serial_sequence('empresas', 'id'), COALESCE(MAX(id), 1)) FROM empresas;

-- 2. Insertar Insumos Base (en gramos, mililitros y unidades)
INSERT INTO inventario_insumos (id, empresa_id, nombre, stock_actual, unidad_medida) VALUES
(1, 1, 'Café en grano', 5000.0000, 'gr'),          -- 5 kg iniciales
(2, 1, 'Leche entera', 10000.0000, 'ml'),          -- 10 L iniciales
(3, 1, 'Azúcar', 3000.0000, 'gr'),                 -- 3 kg iniciales
(4, 1, 'Agua purificada', 20000.0000, 'ml'),       -- 20 L iniciales
(5, 1, 'Taza descartable 8oz', 200.0000, 'unidades'); -- 200 vasos

SELECT setval(pg_get_serial_sequence('inventario_insumos', 'id'), COALESCE(MAX(id), 1)) FROM inventario_insumos;

-- 3. Insertar Ítems del Menú (Productos finales de venta)
INSERT INTO items_menu (id, empresa_id, nombre, precio) VALUES
(1, 1, 'Café Americano', 12.00),
(2, 1, 'Café con Leche', 15.00);

SELECT setval(pg_get_serial_sequence('items_menu', 'id'), COALESCE(MAX(id), 1)) FROM items_menu;

-- 4. Insertar Recetas Asociadas (Fórmula exacta)
-- Café Americano: 18g de Café, 150ml de Agua, 1 Vaso/Taza
INSERT INTO receta_detail (item_menu_id, insumo_id, cantidad_requerida) VALUES
(1, 1, 18.0000),
(1, 4, 150.0000),
(1, 5, 1.0000);

-- Café con Leche: 18g de Café, 120ml de Leche, 50ml de Agua, 1 Vaso/Taza
INSERT INTO receta_detail (item_menu_id, insumo_id, cantidad_requerida) VALUES
(2, 1, 18.0000),
(2, 2, 120.0000),
(2, 4, 50.0000),
(2, 5, 1.0000);

SELECT setval(pg_get_serial_sequence('receta_detail', 'id'), COALESCE(MAX(id), 1)) FROM receta_detail;

-- =============================================================================
-- GUÍA DE VERIFICACIÓN / TESTS DEL TRIGGER (OPCIONAL)
-- =============================================================================
/*
  Para verificar que el trigger funciona de manera matemática exacta:

  1. Crear un pedido de prueba en estado 'Pendiente' por valor de 27.00 Bs (1 Americano + 1 Café con Leche)
     INSERT INTO pedidos (id, empresa_id, total, estado) VALUES (999, 1, 27.00, 'Pendiente');

  2. Insertar los detalles del pedido
     INSERT INTO detalle_pedidos (pedido_id, item_menu_id, cantidad) VALUES 
     (999, 1, 1), -- 1x Café Americano
     (999, 2, 1); -- 1x Café con Leche

  3. Consultar stock actual del café en grano (debe ser 5000.0000 gr)
     SELECT * FROM inventario_insumos WHERE id = 1;

  4. Pagar el pedido (simula la transición de estado)
     UPDATE pedidos SET estado = 'Pagado' WHERE id = 999;

  5. Volver a consultar stock de café en grano (debe haber bajado a 4964.0000 gr ya que 18gr + 18gr = 36gr descontados)
     SELECT * FROM inventario_insumos WHERE id = 1;
     
  6. Limpiar prueba
     DELETE FROM pedidos WHERE id = 999;
*/

-- =============================================================================
-- MIGRACIONES POST-MVP
-- =============================================================================
-- Añadir columna 'giro' a la tabla de empresas sin borrar datos existentes
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS giro VARCHAR(20) CHECK (giro IN ('CAFETERIA', 'RESTAURANTE'));
UPDATE empresas SET giro = 'CAFETERIA' WHERE giro IS NULL;
ALTER TABLE empresas ALTER COLUMN giro SET NOT NULL;

-- Habilitar el rol 'SuperAdmin' en el CHECK constraint de la tabla usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('Administrador', 'Cajero', 'Cocina', 'SuperAdmin'));

-- Columnas de Control Multi-Tenant (Bloque 1 SaaS)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS plan_suscripcion VARCHAR(20) DEFAULT 'Basico' CHECK (plan_suscripcion IN ('Basico', 'Medio', 'Premium'));
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS estado_cuenta VARCHAR(20) DEFAULT 'Activo' CHECK (estado_cuenta IN ('Activo', 'Suspendido', 'Demo'));
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS subdominio VARCHAR(50) UNIQUE;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS total_licencias INT DEFAULT 1;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS nit VARCHAR(20);

-- 1. Crear tabla 'mesas'
CREATE TABLE IF NOT EXISTS mesas (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    numero_mesa INT NOT NULL,
    estado VARCHAR(20) DEFAULT 'Libre' CHECK (estado IN ('Libre', 'Ocupada', 'Sucia')),
    capacidad INT DEFAULT 4,
    unificada_con INT REFERENCES mesas(id) ON DELETE SET NULL,
    creado_at TIMESTAMP DEFAULT NOW()
);

-- 2. Vincular clave foránea 'mesa_id' en la tabla 'pedidos'
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS mesa_id INT REFERENCES mesas(id) ON DELETE SET NULL;

-- 3. Insertar mesas de semilla para Café Central Sucre (empresa_id = 1)
INSERT INTO mesas (id, empresa_id, numero_mesa, estado, capacidad) VALUES
(1, 1, 1, 'Libre', 4),
(2, 1, 2, 'Libre', 2),
(3, 1, 3, 'Libre', 4),
(4, 1, 4, 'Libre', 6),
(5, 1, 5, 'Libre', 4),
(6, 1, 6, 'Libre', 2)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('mesas', 'id'), COALESCE(MAX(id), 1)) FROM mesas;

-- 4. Crear tabla 'turnos_personal'
CREATE TABLE IF NOT EXISTS turnos_personal (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    fecha_apertura TIMESTAMP DEFAULT NOW(),
    fecha_cierre TIMESTAMP NULL,
    monto_apertura NUMERIC(10,2) NOT NULL,
    monto_cierre NUMERIC(10,2) NULL,
    ventas_calculadas NUMERIC(10,2) DEFAULT 0.00,
    notas_caja TEXT NULL,
    estado VARCHAR(20) DEFAULT 'Abierto' CHECK (estado IN ('Abierto', 'Cerrado'))
);



