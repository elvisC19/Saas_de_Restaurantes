/**
 * Suma dos números representados como strings o numbers y formatea con el número de decimales especificado (por defecto 2).
 * Evita imprecisiones de punto flotante multiplicando por un factor de escala antes de redondear.
 */
export function addDecimals(a: string | number, b: string | number, decimals: number = 2): string {
  const valA = typeof a === 'string' ? parseFloat(a || '0') : a;
  const valB = typeof b === 'string' ? parseFloat(b || '0') : b;
  const factor = Math.pow(10, decimals);
  const result = Math.round((valA + valB) * factor) / factor;
  return result.toFixed(decimals);
}

/**
 * Resta dos números representados como strings o numbers y formatea con el número de decimales especificado (por defecto 2).
 */
export function subtractDecimals(a: string | number, b: string | number, decimals: number = 2): string {
  const valA = typeof a === 'string' ? parseFloat(a || '0') : a;
  const valB = typeof b === 'string' ? parseFloat(b || '0') : b;
  const factor = Math.pow(10, decimals);
  const result = Math.round((valA - valB) * factor) / factor;
  return result.toFixed(decimals);
}

/**
 * Multiplica dos números representados como strings o numbers y formatea con el número de decimales especificado (por defecto 2).
 */
export function multiplyDecimals(a: string | number, b: string | number, decimals: number = 2): string {
  const valA = typeof a === 'string' ? parseFloat(a || '0') : a;
  const valB = typeof b === 'string' ? parseFloat(b || '0') : b;
  const factor = Math.pow(10, decimals);
  const result = Math.round((valA * valB) * factor) / factor;
  return result.toFixed(decimals);
}

/**
 * Formatea un valor decimal como moneda boliviana (Bs.) con el símbolo al final.
 */
export function formatCurrency(value: string | number): string {
  const val = typeof value === 'string' ? parseFloat(value || '0') : value;
  return `${val.toFixed(2)} Bs.`;
}

/**
 * Parsea un string decimal de forma segura a number.
 */
export function safeParseFloat(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
}
