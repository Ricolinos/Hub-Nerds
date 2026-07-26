// Geometría de los tres paneles de cristal del hero y la matemática para
// encajar contenido HTML plano dentro de ellos.
//
// Los paneles están dibujados EN PERSPECTIVA dentro de la imagen (cada uno es
// un cuadrilátero, no un rectángulo), así que para meterles contenido real no
// basta con posicionar un div: hay que aplicar la misma transformación
// proyectiva. Eso es lo que hace `quadToMatrix3d`.

/** Punto en coordenadas normalizadas de la imagen (0..1 en cada eje). */
export type UV = readonly [number, number];

export interface PanelQuad {
  id: string;
  /** Esquinas del ÁREA DE CONTENIDO (el marco interior del cristal), en
   *  sentido TL → TR → BR → BL. Medidas sobre la capa layer-4-glass.webp. */
  corners: readonly [UV, UV, UV, UV];
  /** Resolución de diseño del contenido en px. Solo fija la relación de
   *  aspecto y la escala tipográfica: la matriz lo estira hasta el quad. */
  base: { w: number; h: number };
}

// Medidas tomadas sobre la capa de cristal (2800x1562) y afinadas
// visualmente contra el render. El área de contenido es el marco INTERIOR,
// no la silueta exterior del panel: entre ambos queda la franja superior
// donde va el título.
export const HERO_PANELS: PanelQuad[] = [
  {
    id: "left",
    corners: [
      [0.1121, 0.2175],
      [0.3564, 0.2698],
      [0.3548, 0.5872],
      [0.1112, 0.5989],
    ],
    base: { w: 680, h: 420 },
  },
  {
    id: "center",
    corners: [
      [0.5093, 0.3005],
      [0.6822, 0.3300],
      [0.6810, 0.5378],
      [0.5085, 0.5310],
    ],
    base: { w: 480, h: 300 },
  },
  {
    id: "right",
    corners: [
      [0.7040, 0.3300],
      [0.9052, 0.3352],
      [0.9038, 0.6018],
      [0.7030, 0.5920],
    ],
    base: { w: 560, h: 360 },
  },
];

/** Relación de aspecto de las capas del hero (2800x1562). */
export const LAYER_ASPECT = 2800 / 1562;

/**
 * Convierte un punto normalizado de la imagen a píxeles dentro del contenedor,
 * replicando cómo `background-size: cover` + `background-position` recortan y
 * escalan la imagen. Sin esto el contenido se despegaría de los cristales en
 * cuanto el viewport cambiara de proporción.
 */
export function uvToLocal(
  uv: UV,
  containerW: number,
  containerH: number,
  posX = 0.46,
  posY = 0.42,
): [number, number] {
  const scale = Math.max(containerW / 2800, containerH / 1562);
  const drawnW = 2800 * scale;
  const drawnH = 1562 * scale;
  const offsetX = (containerW - drawnW) * posX;
  const offsetY = (containerH - drawnH) * posY;
  return [offsetX + uv[0] * drawnW, offsetY + uv[1] * drawnH];
}

/**
 * Matriz CSS que mapea el rectángulo (0,0)-(w,h) sobre un cuadrilátero
 * arbitrario. Es la transformación proyectiva clásica de cuadrado unidad a
 * quad, pre-escalada por 1/w y 1/h, y volcada al orden column-major que
 * espera `matrix3d`.
 */
export function quadToMatrix3d(
  w: number,
  h: number,
  p: readonly [[number, number], [number, number], [number, number], [number, number]],
): string {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = p;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;

  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, hh: number;

  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    // Sin componente proyectiva: el quad es un paralelogramo (caso afín).
    a = x1 - x0;
    b = x2 - x1;
    c = x0;
    d = y1 - y0;
    e = y2 - y1;
    f = y0;
    g = 0;
    hh = 0;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    hh = (dx1 * sy - sx * dy1) / den;
    a = x1 - x0 + g * x1;
    b = x3 - x0 + hh * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + hh * y3;
    f = y0;
  }

  // Pre-escalado: el origen es un rect de w x h, no el cuadrado unidad.
  const m = [a / w, d / w, g / w, b / h, e / h, hh / h, c, f, 1];
  const [A, D, G, B, E, H, C, F, I] = m;

  // matrix3d es column-major.
  return `matrix3d(${A}, ${D}, 0, ${G}, ${B}, ${E}, 0, ${H}, 0, 0, 1, 0, ${C}, ${F}, 0, ${I})`;
}
