/**
 * Once UI 1.8 añadió la prop `multiple` a `Select`, y con ella ensanchó
 * `value` y `onSelect` de `string` a `string | string[]` (ver
 * node_modules/@once-ui-system/core/dist/components/Select.d.ts).
 *
 * Ningún `Select` de este proyecto usa `multiple`, así que en runtime el valor
 * sigue siendo siempre un string: lo único que cambió es el tipo. Este helper
 * estrecha el valor en UN solo sitio en lugar de repetir el mismo guard —o,
 * peor, un `as string`— en cada llamada.
 *
 * Si algún día hace falta un Select múltiple, ese caso debe leer el array
 * directamente en vez de pasar por aquí.
 */
export function selectValue(value: string | string[]): string {
  return Array.isArray(value) ? (value[0] ?? "") : value;
}
