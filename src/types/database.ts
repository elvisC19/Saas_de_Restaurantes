export interface Empresa {
  id: number;
  nombre: string;
  plan_mensual: string; // NUMERIC(10,2) - Ejemplo: "280.00"
  giro?: 'CAFETERIA' | 'RESTAURANTE';
  creado_at?: string;
}

export type RolUsuario = 'Administrador' | 'Cajero' | 'Cocina' | 'SuperAdmin';

export interface Usuario {
  id: string; // UUID referenciando auth.users
  empresa_id: number;
  nombre: string;
  rol: RolUsuario;
  creado_at?: string;
}

export type UnidadMedidaInsumo = 'gr' | 'ml' | 'unidades';

export interface InventarioInsumo {
  id: number;
  empresa_id: number;
  nombre: string;
  stock_actual: string; // NUMERIC(12,4) - Ejemplo: "1500.0000"
  unidad_medida: UnidadMedidaInsumo;
}

export interface ItemMenu {
  id: number;
  empresa_id: number;
  nombre: string;
  precio: string; // NUMERIC(10,2) - Ejemplo: "15.00"
}

export interface RecetaDetail {
  id: number;
  item_menu_id: number;
  insumo_id: number;
  cantidad_requerida: string; // NUMERIC(12,4) - Ejemplo: "18.0000"
}

export type EstadoPedido = 'Pendiente' | 'En Preparación' | 'Listo' | 'Pagado';

export interface Pedido {
  id: number;
  empresa_id: number;
  total: string; // NUMERIC(10,2) - Ejemplo: "30.00"
  estado: EstadoPedido;
  creado_at?: string;
}

export interface DetallePedido {
  id: number;
  pedido_id: number;
  item_menu_id: number;
  cantidad: number; // INT
}

// Estructuras extendidas útiles para el desarrollo Frontend (DTOs/Joins)
export interface RecetaDetailConInsumo extends RecetaDetail {
  inventario_insumos: {
    nombre: string;
    unidad_medida: UnidadMedidaInsumo;
  };
}

export interface ItemMenuConReceta extends ItemMenu {
  receta_detail: RecetaDetailConInsumo[];
}

export interface DetallePedidoConMenu extends DetallePedido {
  items_menu: ItemMenu;
}

export interface PedidoConDetalles extends Pedido {
  detalle_pedidos: DetallePedidoConMenu[];
}
