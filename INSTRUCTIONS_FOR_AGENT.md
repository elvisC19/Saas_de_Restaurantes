# GUÍA TÉCNICA Y DE ALCANCE: DESARROLLO DEL MVP SAAS GASTRONÓMICO
## OBJETIVO DEL AGENTE IA
Construir un prototipo funcional robusto, comercialmente viable y de nivel de producción para un software SaaS (Software as a Service) multi-inquilino (Multi-tenant) enfocado exclusivamente en **Restaurantes y Cafeterías**. El sistema debe operar con costo $0$ de infraestructura utilizando la arquitectura unificada de **Next.js (con TypeScript)** y **Supabase (PostgreSQL + Realtime)**.

---

## 🚨 REGLAS CRÍTICAS DE CONTROL (PROHIBIDO DESVIARSE)
1. **Precisión Financiera Obligatoria:** Está estrictamente prohibido usar tipos de datos `FLOAT`, `REAL` o `NUMBER` genéricos en la base de datos o en la lógica de TypeScript para dinero o inventario. Se debe usar `NUMERIC(10,2)` para dinero y `NUMERIC(12,4)` para inventario de recetas. En TypeScript, los cálculos monetarios deben ser tratados con el cuidado de strings fijos o redondeos matemáticos explícitos de dos decimales para evitar pérdida de centavos.
2. **Aislamiento SaaS (Multi-tenant):** Toda consulta a la base de datos, inserción o actualización debe incluir de forma explícita y obligatoria la columna `empresa_id` (Tenant). Un restaurante jamás debe ver los datos de otro.
3. **Flujo de Simulación en un solo Repositorio:** Toda la API (Backend) y las pantallas (Frontend) deben coexistir en el mismo proyecto de Next.js. El flujo de pago con QR "Simple" de Bolivia debe ser simulado con un Webhook interno de un solo clic.

---

## 🗄️ FASE 1: MODELO DE DATOS COMPLETO (POSTGRESQL - SUPABASE)

Ejecutar el siguiente script DDL en el editor SQL de Supabase de manera exacta:

```sql
-- 1. Tabla de Empresas/Inquilinos (SaaS Tenants)
CREATE TABLE empresas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    plan_mensual NUMERIC(10,2) NOT NULL, -- Valores válidos en el modelo de negocio: 140.00, 280.00, 450.00
    creado_at TIMESTAMP DEFAULT NOW()
);

-- 2. Perfiles de Usuario vinculados a una empresa (RBAC)
CREATE TABLE usuarios (
    id UUID REFERENCES auth.users PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('Administrador', 'Cajero', 'Cocina')),
    creado_at TIMESTAMP DEFAULT NOW()
);

-- 3. Inventario de Insumos Base (Materias primas)
CREATE TABLE inventario_insumos (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    stock_actual NUMERIC(12,4) NOT NULL,
    unidad_medida VARCHAR(10) NOT NULL CHECK (unidad_medida IN ('gr', 'ml', 'unidades'))
);

-- 4. Ítems del Menú Comercial (Productos finales de venta)
CREATE TABLE items_menu (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10,2) NOT NULL
);

-- 5. Relación Multia-a-Multi (Recetario Avanzado con Costo Directo)
CREATE TABLE receta_detail (
    id SERIAL PRIMARY KEY,
    item_menu_id INT REFERENCES items_menu(id) ON DELETE CASCADE,
    insumo_id INT REFERENCES inventario_insumos(id) ON DELETE CASCADE,
    cantidad_requerida NUMERIC(12,4) NOT NULL -- Ejemplo: 18.0000 gr de café, 200.0000 ml de leche
);

-- 6. Cabecera de Pedidos
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    empresa_id INT REFERENCES empresas(id) ON DELETE CASCADE,
    total NUMERIC(10,2) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'En Preparación', 'Listo', 'Pagado')),
    creado_at TIMESTAMP DEFAULT NOW()
);

-- 7. Detalle de Pedidos
CREATE TABLE detalle_pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES pedidos(id) ON DELETE CASCADE,
    item_menu_id INT REFERENCES items_menu(id) ON DELETE RESTRICT,
    cantidad INT NOT NULL CHECK (cantidad > 0)
);