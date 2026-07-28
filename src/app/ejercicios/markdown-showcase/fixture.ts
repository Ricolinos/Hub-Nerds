import type { PieceAttachment } from "@/app/actions/portfolioPieces";

// Fixture del proyecto de prueba: un caso de estudio que ejerce TODOS los
// elementos que hoy se pueden ver en un markdown del visor, en el mismo orden
// en que aparecen en el picker "Añadir sección" del editor (ver BLOCK_TYPES en
// profile/ContentBlocks.tsx) más los componentes sueltos que el Modo Pro
// permite escribir a mano (ver PRO_SUPPORTED_COMPONENTS_HELP).
//
// Se escribe como el MISMO par (markdown, attachments) que guarda una pieza
// real: `PortfolioPiece.markdownContent` + `PortfolioPiece.attachments`. Si
// algún día se quiere sembrar como pieza de BD, estas dos constantes se copian
// tal cual al seed — no hay nada específico de la página de prueba aquí.
//
// OJO con el `src` de `Media`: el visor resuelve por NOMBRE de adjunto, no por
// ruta (ver `resolveAttachmentSrc` en mdx.tsx — solo `http(s)://`, `//` y
// `data:` se tratan como URL directa). Una ruta `/images/...` escrita a mano
// cae en el "Archivo no encontrado", así que aquí se referencia por nombre y
// el mapeo a archivo vive en SHOWCASE_ATTACHMENTS, igual que en una pieza
// creada desde el modo Pro del editor.

const PHOTO_COUNT = 12;

export const SHOWCASE_ATTACHMENTS: PieceAttachment[] = Array.from(
  { length: PHOTO_COUNT },
  (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { name: `foto-${n}`, url: `/images/gallery/img-${n}.jpg`, type: "image" as const };
  },
);

export const MARKDOWN_SHOWCASE = `
## Texto y encabezados

Este es un párrafo normal con **negritas**, _cursivas_, \`código en línea\` y un
[enlace](https://hub-nerds.com). Debajo va una cita:

> El markdown del editor se serializa igual desde el modo Asistido y el modo Pro.

### Encabezado de tercer nivel

- Primer elemento de lista
- Segundo elemento
- Tercer elemento

1. Lista ordenada
2. Segundo paso
3. Tercer paso

---

## Carousel — estilo coverflow

<MdxCarousel variant="coverflow" aspectRatio="16 / 9">
  <Media src="foto-01" alt="Coverflow 1" />
  <Media src="foto-02" alt="Coverflow 2" />
  <Media src="foto-03" alt="Coverflow 3" />
  <Media src="foto-04" alt="Coverflow 4" />
  <Media src="foto-05" alt="Coverflow 5" />
  <Media src="foto-06" alt="Coverflow 6" />
  <Media src="foto-07" alt="Coverflow 7" />
</MdxCarousel>

## Carousel — estilo anillo 3D

<MdxCarousel variant="ring">
  <Media src="foto-01" alt="Anillo 1" />
  <Media src="foto-02" alt="Anillo 2" />
  <Media src="foto-03" alt="Anillo 3" />
  <Media src="foto-04" alt="Anillo 4" />
  <Media src="foto-05" alt="Anillo 5" />
  <Media src="foto-06" alt="Anillo 6" />
  <Media src="foto-07" alt="Anillo 7" />
  <Media src="foto-08" alt="Anillo 8" />
</MdxCarousel>

## Carousel — estilo clásico (Once UI)

<MdxCarousel indicator="thumbnail" aspectRatio="16 / 9" controls>
  <Media src="foto-01" alt="Clásico 1" />
  <Media src="foto-02" alt="Clásico 2" />
  <Media src="foto-03" alt="Clásico 3" />
  <Media src="foto-04" alt="Clásico 4" />
</MdxCarousel>

## Imagen suelta

<Media src="foto-08" alt="Imagen a ancho completo" aspectRatio="16 / 9" radius="m" />

## Cuadrícula de fotos

<MasonryGrid columns="3">
  <Media src="foto-09" alt="Cuadrícula 1" />
  <Media src="foto-10" alt="Cuadrícula 2" />
  <Media src="foto-11" alt="Cuadrícula 3" />
  <Media src="foto-12" alt="Cuadrícula 4" />
  <Media src="foto-01" alt="Cuadrícula 5" />
  <Media src="foto-02" alt="Cuadrícula 6" />
</MasonryGrid>

## Tira deslizable

<Scroller>
  <Tag label="Branding" variant="brand" />
  <Tag label="Motion" variant="accent" />
  <Tag label="Ilustración" variant="success" />
  <Tag label="Dirección de arte" variant="warning" />
  <Tag label="Storyboard" variant="danger" />
</Scroller>

## Etiquetas, insignias, estado y progreso

<Tag label="Etiqueta suelta" variant="brand" />

<Badge title="Insignia con enlace" href="https://hub-nerds.com" />

<StatusIndicator color="green" />

<ProgressBar value="72" />

## Aviso

<Feedback variant="info" title="Nota del autor" description="Los Feedback se usan para avisos dentro del caso de estudio." />

## Acordeón

<Accordion title="¿Qué incluye este proyecto de prueba?">
Todos los bloques del picker "Añadir sección" más los componentes que el modo Pro permite escribir a mano.
</Accordion>

## Bloque de código

\`\`\`tsx
export function Ejemplo() {
  return <Media src="foto-01" alt="ejemplo" />;
}
\`\`\`

## Encabezado alineado

<Heading as="h2" align="center">Un encabezado centrado</Heading>

---

Fin del recorrido.
`;
