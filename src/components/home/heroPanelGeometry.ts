// Geometría de los tres paneles de cristal del hero y la matemática para
// encajar contenido HTML plano dentro de ellos.
//
// Los paneles están dibujados EN PERSPECTIVA dentro de la imagen (cada uno es
// un cuadrilátero, no un rectángulo), así que para meterles contenido real no
// basta con posicionar un div: hay que aplicar la misma transformación
// proyectiva. Eso es lo que hace `quadToMatrix3d`.

/** Punto en coordenadas normalizadas de la imagen (0..1 en cada eje). */
export type UV = readonly [number, number];

export type Quad = readonly [UV, UV, UV, UV];

export interface PanelQuad {
  id: string;
  /** Título de la categoría que muestra el panel. */
  title: string;
  /** Silueta EXTERIOR del cristal. Se usa para el desenfoque del fondo:
   *  el vidrio difumina todo el panel, no solo su área de contenido. */
  outer: Quad;
  /** Franja entre el borde superior exterior y el marco interior: es donde
   *  va el título, no dentro del área de contenido. */
  header: Quad;
  /** Marco INTERIOR del cristal: aquí aparecen los proyectos al revelar. */
  corners: Quad;
  /** Resolución de diseño del contenido en px. Solo fija la relación de
   *  aspecto y la escala tipográfica: la matriz lo estira hasta el quad. */
  base: { w: number; h: number };
}

/**
 * Endereza un quad forzando que sus dos lados (izquierdo y derecho) sean
 * exactamente verticales.
 *
 * Dato de verificación visual del usuario (2026-07-26): en esta escena las
 * líneas verticales SIEMPRE son verticales; lo único que se inclina son las
 * horizontales. Los `header` medidos a mano llegaban a 17° de desviación
 * porque sus esquinas superior/inferior se tomaban de `outer` e `inner`, que
 * no comparten `u` al tener el marco del cristal grosor — eso cizallaba el
 * título. Promediar la `u` de las dos esquinas de cada lado (y aplicarla a
 * ambas) codifica la regla de la escena para TODOS los quads, así un ajuste
 * manual futuro de las coordenadas no puede reintroducir esa inclinación.
 */
function straightenQuad(quad: Quad): Quad {
  const [p0, p1, p2, p3] = quad;
  const leftU = (p0[0] + p3[0]) / 2;
  const rightU = (p1[0] + p2[0]) / 2;
  return [
    [leftU, p0[1]],
    [rightU, p1[1]],
    [rightU, p2[1]],
    [leftU, p3[1]],
  ];
}

function straightenPanel(panel: PanelQuad): PanelQuad {
  return {
    ...panel,
    outer: straightenQuad(panel.outer),
    header: straightenQuad(panel.header),
    corners: straightenQuad(panel.corners),
  };
}

// Medidas tomadas sobre la capa de cristal (2800x1562), detectando la silueta
// por alfa y afinadas contra un overlay de depuración dibujado encima.
//
// `header` reconstruido a mano: esquinas superiores = las de `outer` (mismo
// `u` que la silueta exterior), esquinas inferiores = mismo `u` que las
// superiores pero a la altura (`v`) de las esquinas superiores de `corners`.
// Así la franja del título baja RECTA desde el borde del cristal hasta el
// marco interior, en vez de cizallarse entre dos siluetas con `u` distinta.
// `straightenPanel` (abajo) corrige además cualquier resto submilimétrico.
const HERO_PANELS_RAW: PanelQuad[] = [
  {
    id: "left",
    title: "Diseño gráfico",
    outer: [
      [0.0957, 0.1229],
      [0.3579, 0.1972],
      [0.3607, 0.5992],
      [0.0929, 0.6159],
    ],
    header: [
      [0.0957, 0.1229],
      [0.3579, 0.1972],
      [0.3579, 0.2698],
      [0.0957, 0.2175],
    ],
    corners: [
      [0.1182, 0.2336],
      [0.3446, 0.2857],
      [0.3444, 0.5668],
      [0.1182, 0.5768],
    ],
    base: { w: 680, h: 420 },
  },
  {
    id: "center",
    title: "Motion",
    outer: [
      [0.5007, 0.2484],
      [0.6864, 0.2702],
      [0.6871, 0.5519],
      [0.4993, 0.5506],
    ],
    header: [
      [0.5007, 0.2484],
      [0.6864, 0.2702],
      [0.6864, 0.3300],
      [0.5007, 0.3005],
    ],
    corners: [
      [0.5150, 0.3204],
      [0.6726, 0.3378],
      [0.6719, 0.5242],
      [0.5142, 0.5251],
    ],
    base: { w: 480, h: 300 },
  },
  {
    id: "right",
    title: "Branding",
    outer: [
      [0.6996, 0.3043],
      [0.9129, 0.2641],
      [0.9139, 0.6292],
      [0.7001, 0.6098],
    ],
    header: [
      [0.6996, 0.3043],
      [0.9129, 0.2641],
      [0.9129, 0.3354],
      [0.6996, 0.3605],
    ],
    corners: [
      [0.7098, 0.3685],
      [0.8949, 0.3473],
      [0.8944, 0.5994],
      [0.7098, 0.5837],
    ],
    base: { w: 560, h: 360 },
  },
];

export const HERO_PANELS: PanelQuad[] = HERO_PANELS_RAW.map(straightenPanel);

/** Cuadrilátero de una superficie plana sin título ni rejilla de proyectos
 *  (p.ej. la pantalla del monitor apagado): solo el área donde se proyecta
 *  contenido. */
export interface ScreenQuad {
  id: string;
  quad: Quad;
  /** Resolución de diseño del contenido en px, ver `PanelQuad.base`. */
  base: { w: number; h: number };
}

// Pantalla del monitor en layer-3-monitor.webp (2800x1562), medida con una
// página de depuración (rejilla normalizada cada 0.01 sobre la capa a ancho
// nativo, superpuesta a un fondo a cuadros para distinguir el recorte alfa
// del monitor del resto de la escena) y afinada con capturas ampliadas por
// esquina. El bisel es delgado en este diseño plano: las esquinas se miden
// un poco DENTRO del borde exterior del monitor (no en la silueta alfa) para
// que el logo quede sobre el vidrio, no montado sobre el marco.
const MONITOR_SCREEN_RAW: ScreenQuad = {
  id: "monitor-screen",
  quad: [
    [0.338, 0.456],
    [0.56, 0.466],
    [0.558, 0.661],
    [0.338, 0.667],
  ],
  base: { w: 300, h: 190 },
};

export const MONITOR_SCREEN: ScreenQuad = {
  ...MONITOR_SCREEN_RAW,
  quad: straightenQuad(MONITOR_SCREEN_RAW.quad),
};

/** Relación de aspecto de las capas del hero (2800x1562). */
export const LAYER_ASPECT = 2800 / 1562;

/**
 * REGLA DE ENCUADRE ÚNICA de la escena, compartida entre el CSS de las capas
 * (`HeroParallax.tsx`, que pinta `background-size`/`background-position` en
 * px con estos mismos números) y `uvToLocal` (que ubica títulos, desenfoque y
 * proyectos sobre esas mismas capas). Un solo consumidor por bando garantiza
 * que nunca se desincronicen: cambiar el encuadre es cambiar ESTA función.
 *
 * Con `background-size: cover` puro, en un viewport vertical la imagen (ratio
 * 2800/1562 ≈ 1.79, muy apaisada) se escala para llenar el ALTO y se recorta
 * brutalmente a lo ancho — a 390x844 solo sobrevivía ~26% del ancho de la
 * escena, perdiendo dos de los tres cristales. Por eso el `scale` real es una
 * interpolación entre dos modos según el aspect ratio del contenedor:
 *
 * - `aspect >= LANDSCAPE_ASPECT` (desktop/horizontal, incluido 1440x900 con
 *   aspect 1.6): `scale = cover` exacto y `posY = 0.42`, IDÉNTICO a la fórmula
 *   anterior — cero cambio visual ahí.
 * - `aspect <= PORTRAIT_ASPECT` (móvil/tablet vertical): `scale = fit-width`
 *   (el ancho llena el contenedor exacto, `offsetX` siempre 0) y `posY = 0`
 *   (la escena arranca pegada arriba, bajo el header). Como el ancho SIEMPRE
 *   llena el contenedor en este modo, los tres cristales —que ocupan
 *   u∈[0,1]— quedan completos; solo se pierde alto, que es justo donde vive
 *   el bloque de texto (fondo oscuro, ver `backgroundColor` en
 *   `HeroParallax`).
 * - Entre ambos umbrales: interpolación lineal por `t`, para que un resize
 *   (rotar el dispositivo, redimensionar la ventana) no salte de golpe entre
 *   modos.
 *
 * `TOP_CLEARANCE_PX`: primer intento con `posY = 0` puro pegaba el panel
 * izquierdo (y su título) contra el header — el Column raíz de HomeHero
 * arranca con `marginTop: -48px`, así que y=0 de la escena es y=0 del
 * viewport, DEBAJO del header (medido: 60px en 390px, 64px en 834px de
 * ancho). Verificado con captura de pantalla real (390x844): el título
 * "Diseño gráfico" quedaba recortado y el pill "Beta" se montaba sobre el
 * cristal. `offsetY` nunca baja de este piso en modo vertical, con el mismo
 * `t` para que se desvanezca a 0 exactamente donde `posY` vuelve a 0.42 (sin
 * el piso, el desktop tampoco cambia).
 */
const LANDSCAPE_ASPECT = 1.15;
export const PORTRAIT_ASPECT = 0.95;
const SCENE_POS_X = 0.46;
const SCENE_POS_Y = 0.42;
const TOP_CLEARANCE_PX = 88;

export interface SceneFraming {
  /** Factor de escala aplicado a la imagen nativa (2800x1562). */
  scale: number;
  /** Tamaño dibujado de la imagen, en px del contenedor. */
  drawnW: number;
  drawnH: number;
  /** Esquina superior-izquierda de la imagen dibujada, en px del contenedor. */
  offsetX: number;
  offsetY: number;
}

/** Calcula el encuadre de la escena para un tamaño de contenedor dado. */
export function computeSceneFraming(containerW: number, containerH: number): SceneFraming {
  if (containerW <= 0 || containerH <= 0) {
    return { scale: 1, drawnW: 2800, drawnH: 1562, offsetX: 0, offsetY: 0 };
  }
  const aspect = containerW / containerH;
  const t = Math.min(
    1,
    Math.max(0, (aspect - PORTRAIT_ASPECT) / (LANDSCAPE_ASPECT - PORTRAIT_ASPECT)),
  );
  const coverScale = Math.max(containerW / 2800, containerH / 1562);
  const fitWidthScale = containerW / 2800;
  const scale = fitWidthScale + t * (coverScale - fitWidthScale);
  const posY = t * SCENE_POS_Y;
  const drawnW = 2800 * scale;
  const drawnH = 1562 * scale;
  const offsetX = (containerW - drawnW) * SCENE_POS_X;
  // Piso de despeje del header, desvanecido con el mismo `t`: en t=1 suma 0
  // (idéntico a la fórmula anterior), en t=0 fuerza el mínimo medido a mano.
  const offsetY = Math.max((containerH - drawnH) * posY, (1 - t) * TOP_CLEARANCE_PX);
  return { scale, drawnW, drawnH, offsetX, offsetY };
}

/**
 * Alto que ocupa la banda de la escena en modo VERTICAL, medido desde el borde
 * superior del hero. Se usa para colocar el bloque de texto justo debajo de la
 * escena en vez de anclarlo al fondo del viewport (ver `useHeroPortrait` en
 * HomeHero.tsx).
 *
 * Depende SOLO del ancho, a propósito: en vertical `scale` es fit-width y
 * `offsetY` es el despeje fijo del header, así que el resultado no cambia con
 * el alto. Eso es lo que permite que el hero pase a medir según su contenido
 * sin que su propio alto realimente el encuadre. Se fuerza el alto de consulta
 * al umbral de vertical para garantizar que la interpolación quede en t=0.
 */
export function portraitSceneBottom(containerW: number): number {
  const { offsetY, drawnH } = computeSceneFraming(containerW, containerW / PORTRAIT_ASPECT);
  return offsetY + drawnH;
}

/**
 * Convierte un punto normalizado de la imagen a píxeles dentro del contenedor,
 * usando el mismo `computeSceneFraming` que pinta las capas. Sin esto el
 * contenido se despegaría de los cristales en cuanto el viewport cambiara de
 * proporción o de modo de encuadre.
 */
export function uvToLocal(uv: UV, containerW: number, containerH: number): [number, number] {
  const { offsetX, offsetY, drawnW, drawnH } = computeSceneFraming(containerW, containerH);
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
