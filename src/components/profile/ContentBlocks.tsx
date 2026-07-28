"use client";

import {
  Avatar,
  AvatarGroup,
  Badge,
  Button,
  Chip,
  ColorInput,
  Column,
  DropdownWrapper,
  EmojiPickerDropdown,
  Feedback,
  Grid,
  HoverCard,
  Icon,
  IconButton,
  Input,
  Line,
  LogoCloud,
  MasonryGrid,
  Media,
  NumberInput,
  Option,
  ProgressBar,
  Row,
  Scroller,
  Select,
  SegmentedControl,
  Spinner,
  StatusIndicator,
  Switch,
  Tag,
  Text,
  Textarea,
  Tooltip,
} from "@once-ui-system/core";
import { MediaUpload } from "@once-ui-system/core/modules";
import {
  type ClipboardEvent,
  type DragEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { type PublicFreelancerResult, searchPublicFreelancers } from "@/app/actions/portfolioPieces";
import { CarouselVideoSlide, MdxCarousel, type MdxCarouselVariant } from "@/components/mdx-carousel";
import { uploadMediaFile } from "@/lib/storageUpload";
import {
  DEFAULT_TEXT_PT,
  FONT_LIBRARY,
  ptToPx,
  resolveFontStack,
  TEXT_SIZE_PRESETS,
} from "@/lib/fontLibrary";
import { PROJECT_SUBCATEGORIES, PROJECT_VERTICALS } from "@/lib/projectCategories";
import { VideoFileDropzone } from "./VideoFileDropzone";

// El Canvas no edita un .md crudo: el usuario arma bloques estructurados y
// estos se serializan a Markdown/MDX (texto plano) tras bambalinas al
// guardar. El visualizador de proyectos (src/components/mdx.tsx) resuelve
// ese texto con el mismo sistema de componentes Once UI, así que los
// bloques que generan JSX (ej. Carousel) deben tener su contraparte
// registrada ahí.
// Tokens tal cual los expone Once UI (ver ai/components/*.json del harness):
// no son libres, así que se restringen aquí a los valores reales de cada prop.
export type TagVariant =
  | "neutral"
  | "brand"
  | "accent"
  | "info"
  | "danger"
  | "warning"
  | "success"
  | "gradient";
export type TagSize = "s" | "m" | "l";
export type StatusColor =
  | "blue"
  | "indigo"
  | "violet"
  | "magenta"
  | "pink"
  | "red"
  | "orange"
  | "yellow"
  | "moss"
  | "green"
  | "emerald"
  | "aqua"
  | "cyan"
  | "gray";

export type TextBlockAlign = "left" | "center" | "right" | "justify";
export type TextBlockWeight = "default" | "strong" | "light";
// FEATURE (tipografía avanzada, tarea 4): color/familia de bloque, mismo
// criterio que `weight`/`italic` — ambos son props STRING reales de `Text`
// (ver ai/components/Text.json: `onBackground: Colors`, `family: TextType`),
// así que sobreviven el GOTCHA de props con llaves (ver comentario extenso
// junto a `escapeAttr`) igual que `variant`/`align`, ya probados. "default"
// = sin override (usa el mismo cálculo de color que ya deriva `weight`, y
// family="body" de siempre).
// BUG CONFIRMADO (auditoría, "el color elegido no se ve en el visor"):
// verificado con Playwright contra una pieza real (markdown guardado +
// `getComputedStyle` en el visor publicado) que un párrafo SOLO-color SÍ
// toma la ruta JSX de `serializeTextSegment` con el `onBackground` correcto
// (`<Text onBackground="brand-strong">...`) — la serialización nunca fue el
// problema. La causa raíz es el TOKEN elegido: los 4 sufijos "-strong" no
// neutros (brand/accent/danger/success) son, en el tema real del sitio,
// variantes de texto optimizadas para MÁXIMO CONTRASTE —Once UI las resuelve
// casi negras sin importar el matiz (`--brand-on-background-strong:
// #050b0d`, `--accent-on-background-strong: #050911`, `--danger-on-
// background-strong: #130507`, `--success-on-background-strong: #040b07`,
// todas indistinguibles entre sí y del negro por defecto `--neutral-on-
// background-strong: #0a0a0a`), mientras que el sufijo "-medium" del MISMO
// scheme sí muestra el matiz real y sigue siendo legible (`--brand-on-
// background-medium: #0c6367` teal, `--accent-on-background-medium:
// #045b9c` azul, `--danger-on-background-medium: #b6020c` rojo, `--success-
// on-background-medium: #0c6731` verde). Se cambian los 4 valores de "fuerte"
// a "medio" (mismo patrón semántico que ya usa "Neutro medio"); los
// "neutral-*" no se tocan (esos SÍ son distinguibles entre sí, ver
// `--neutral-on-background-{strong,medium,weak}` arriba). Sin cambios de
// runtime en piezas YA publicadas con el valor viejo ("brand-strong", etc.):
// ese string sigue siendo un `onBackground` válido de Once UI, solo que
// republicar (re-guardar) la pieza con la opción re-seleccionada aplicará el
// tono visible nuevo.
export type TextBlockColor =
  | "default"
  | "neutral-strong"
  | "neutral-medium"
  | "neutral-weak"
  | "brand-medium"
  | "accent-medium"
  | "danger-medium"
  | "success-medium";
export type TextBlockFamily = "default" | "heading" | "label" | "code";

export type ContentBlock =
  | {
      id: string;
      type: "text";
      html: string;
      align?: TextBlockAlign;
      // `weight`/`color`/`family` (tokens semánticos) quedan SOLO para
      // retrocompatibilidad de piezas publicadas antes de la tarea
      // "controles universales" (ver comentario extenso junto a
      // `TEXT_COLOR_OPTIONS`/`TEXT_FAMILY_OPTIONS` más abajo): la toolbar ya
      // no ofrece forma de ESCRIBIR estos 3 campos, pero sigue
      // leyéndolos/serializándolos igual para que una pieza vieja renderice
      // IDÉNTICO. Los bloques nuevos usan `font`/`pt`/`hexColor` en su lugar.
      weight?: TextBlockWeight;
      italic?: boolean;
      color?: TextBlockColor;
      family?: TextBlockFamily;
      // FEATURE (controles universales, tarea "herramienta de texto
      // amigable"): reemplazo de `family`/`color` por props libres tipo
      // procesador de texto — `font` es un nombre de FONT_LIBRARY (ver
      // src/lib/fontLibrary.ts), `pt` un tamaño en puntos, `hexColor` un
      // color hex libre. Los 3 sobreviven el pipeline de MDX como props
      // string reales (`font="Roboto"` `pt="18"` `color="#0c6367"`, ver
      // `serializeTextSegment`) y el wrapper de `Text` en mdx.tsx los
      // traduce a `style` al renderizar. `undefined` en cualquiera de los 3
      // = sin override (hereda el tema/tamaño/color de siempre).
      font?: string;
      pt?: number;
      hexColor?: string;
    }
  | { id: string; type: "image"; url: string; alt: string }
  | { id: string; type: "carousel"; images: { id: string; url: string; alt: string }[] }
  | { id: string; type: "embed"; language: string; code: string }
  | { id: string; type: "link"; url: string; label: string }
  // FEATURE (tarea "video por archivo"): dos modos, elegidos con
  // `SegmentedControl` en el editor. `source` decide cuál de los dos campos
  // usa `blockToMarkdown` — se conservan AMBOS al cambiar de tab (no se
  // pisan entre sí) para no perder lo ya escrito/subido si el usuario
  // cambia de opinión de ida y vuelta. `url` = link de YouTube (modo
  // original, retrocompatible: piezas viejas sin `source`/`fileUrl` caen en
  // "url" vía el default de ContentBlockCard). `fileUrl` = data URL de un
  // .mp4 subido (mismas reglas que la portada, ver lib/videoUpload.ts).
  | { id: string; type: "video"; source?: "url" | "file"; url: string; fileUrl?: string }
  | { id: string; type: "divider" }
  // FEATURE (bloque "Nueva sección", tarea "HeadingNav"): el canvas SOLO
  // edita `title` (un Input de una línea) — ver ContentBlockCard más abajo.
  // Serializa a `---` (divisor) + `## título` (ver blockToMarkdown case
  // "section"): markdown puro que el visor ya sabe renderizar (hr → Line
  // estilizada, `##` → heading real con id de ancla vía `createHeading`), sin
  // requerir ningún registro nuevo en el mapa de `components` de mdx.tsx.
  | { id: string; type: "section"; title: string }
  | { id: string; type: "tag"; label: string; variant: TagVariant; size: TagSize }
  // Chips de categorías predefinidas del dominio (verticales/subcategorías
  // reales de src/lib/projectCategories.ts): multi-select en el editor con
  // `Chip` (interactivo, onClick de Once UI), serializado como fila de `Tag`
  // estáticos al guardar — ver decisión documentada junto a `blockToMarkdown`
  // (case "categoryTags").
  | { id: string; type: "categoryTags"; selected: string[] }
  | { id: string; type: "badge"; title: string; href: string }
  | { id: string; type: "status"; color: StatusColor; text: string }
  | { id: string; type: "progress"; value: number; min: number; max: number; showLabel: boolean }
  | {
      id: string;
      type: "avatarGroup";
      // `username`/`name` son opcionales y retrocompatibles: los bloques
      // guardados antes de la herramienta "Freelancers" (edición manual de
      // URL/iniciales) no los tienen y siguen renderizando igual (sin link).
      avatars: {
        id: string;
        url: string;
        initials: string;
        username?: string;
        name?: string;
      }[];
    }
  | { id: string; type: "logoCloud"; logos: { id: string; url: string }[]; columns: number }
  | { id: string; type: "scroller"; items: { id: string; text: string }[] }
  | {
      id: string;
      type: "masonry";
      images: { id: string; url: string; alt: string }[];
      columns: number;
    }
  // FEATURE (tarea "Carousel nativo Once UI"): bloque nuevo, DISTINTO del
  // viejo "carousel" (que se conserva intacto — ver comentario junto a
  // BLOCK_TYPES, ahora relabeled "Tira de fotos" en la UI): este produce un
  // `Carousel` real de Once UI (un slide grande a la vez, con flechas e
  // indicador) vía el wrapper `MdxCarousel` (ver mdx-carousel.tsx),
  // mientras que "carousel" sigue siendo una tira horizontal (`Scroller`).
  // Slides mixtos: imagen, video de YouTube, o video de archivo subido
  // (mismas reglas que el bloque "video", ver lib/videoUpload.ts).
  | {
      id: string;
      type: "mediaCarousel";
      slides: CarouselSlide[];
      indicator: "line" | "thumbnail";
      aspectRatio: string;
      // Estilo de presentación (ver MdxCarouselVariant en mdx-carousel.tsx):
      // OPCIONAL — las piezas guardadas antes de esta prop no la traen y
      // deben seguir renderizando el `Carousel` clásico exactamente igual
      // (léelo siempre con `?? "default"`, nunca asumas que está presente).
      carouselVariant?: MdxCarouselVariant;
    };

export type CarouselSlide =
  | { id: string; kind: "image"; url: string; alt: string }
  | { id: string; kind: "youtube"; url: string }
  | { id: string; kind: "file"; url: string };

export type ContentBlockType = ContentBlock["type"];

// Panel "Añadir sección" (tarea 2, auditoría de herramientas): se retiraron
// Insignia/Categorías/Links/Etiqueta/Estado/Barra de progreso de esta lista
// —su propósito quedó cubierto por la cabecera nueva del visor
// (categoría+subcategorías+software, ver page.tsx) o por el enlace desde
// texto (bloque "link")—, pero sus `type` SIGUEN en `ContentBlock`/
// `createBlock`/el render de `ContentBlockCard` de más abajo intactos: una
// pieza vieja que ya trae uno de esos bloques debe seguir editándose y
// renderizando en el visor exactamente igual. Solo se quitan de esta lista
// (fuente única de los 3 selectores de tipo: panel derecho, "+" del lienzo y
// el picker de arrastre — ver CreateProjectModal.tsx), así que tampoco
// aparecen como opción para arrastrar/instanciar un bloque nuevo.
export const BLOCK_TYPES: { type: ContentBlockType; label: string; icon: string }[] = [
  { type: "image", label: "Imagen", icon: "images" },
  { type: "text", label: "Texto", icon: "document" },
  // Re-etiquetado (tarea "Carousel nativo Once UI"): mismo bloque de
  // siempre (tira horizontal con Scroller, ver blockToMarkdown case
  // "carousel") — solo cambia el label para dejarle el nombre "Carousel" al
  // bloque nuevo de abajo. Las piezas ya guardadas con este tipo no
  // cambian: solo es texto de la UI del editor.
  { type: "carousel", label: "Tira de fotos", icon: "photoStack" },
  { type: "mediaCarousel", label: "Carousel", icon: "carouselSlides" },
  { type: "embed", label: "Código", icon: "codeBracket" },
  { type: "video", label: "Video", icon: "film" },
  { type: "divider", label: "Divisor", icon: "divider" },
  // Bloque "Nueva sección" (tarea "HeadingNav"): divisor + título propio
  // (`## texto`, ver blockToMarkdown case "section") — a diferencia de
  // "divider" (un guion sin texto), este alimenta el HeadingNav del visor de
  // proyecto con una entrada navegable por sección.
  { type: "section", label: "Nueva sección", icon: "sectionDivider" },
  { type: "avatarGroup", label: "Freelancers", icon: "userGroup" },
  { type: "logoCloud", label: "Nube de logos", icon: "grid" },
  { type: "masonry", label: "Cuadrícula de fotos", icon: "photoGrid" },
];
// "Tira deslizable" (scroller) se retira del picker de "Añadir sección"
// (tarea "quitar scroller del picker", auditoría de herramientas — mismo
// criterio que Insignia/Categorías/Links/Etiqueta/Estado/Barra de progreso
// arriba): su `type` SIGUE en `ContentBlock`/`createBlock`/`blockToMarkdown`/
// el render de `ContentBlockCard` y en `ALL_BLOCK_META` más abajo intactos,
// así que una pieza vieja con este bloque sigue editándose y renderizando
// exactamente igual — solo desaparece como opción para instanciar uno nuevo.

// Mapa COMPLETO de label/icon por tipo (a diferencia de `BLOCK_TYPES`, que
// solo lista lo instanciable desde el panel): la cabecera de
// `ContentBlockCard` (icono + nombre del tipo de bloque) debe seguir
// mostrando algo coherente para los 6 tipos retirados del panel cuando una
// pieza vieja ya los trae — derivar esto de `BLOCK_TYPES` los dejaría con
// `undefined`.
const ALL_BLOCK_META: Record<ContentBlockType, { label: string; icon: string }> = {
  image: { label: "Imagen", icon: "images" },
  text: { label: "Texto", icon: "document" },
  carousel: { label: "Tira de fotos", icon: "photoStack" },
  mediaCarousel: { label: "Carousel", icon: "carouselSlides" },
  embed: { label: "Código", icon: "codeBracket" },
  link: { label: "Links", icon: "openLink" },
  video: { label: "Video", icon: "film" },
  divider: { label: "Divisor", icon: "divider" },
  section: { label: "Nueva sección", icon: "sectionDivider" },
  tag: { label: "Etiqueta", icon: "shapes" },
  categoryTags: { label: "Categorías", icon: "briefcase" },
  badge: { label: "Insignia", icon: "sparkles" },
  status: { label: "Estado", icon: "infoCircle" },
  progress: { label: "Barra de progreso", icon: "refreshCw" },
  avatarGroup: { label: "Freelancers", icon: "userGroup" },
  logoCloud: { label: "Nube de logos", icon: "grid" },
  scroller: { label: "Tira deslizable", icon: "swipeStrip" },
  masonry: { label: "Cuadrícula de fotos", icon: "photoGrid" },
};

const BLOCK_LABEL: Record<ContentBlockType, string> = Object.fromEntries(
  Object.entries(ALL_BLOCK_META).map(([type, meta]) => [type, meta.label]),
) as Record<ContentBlockType, string>;

const BLOCK_ICON: Record<ContentBlockType, string> = Object.fromEntries(
  Object.entries(ALL_BLOCK_META).map(([type, meta]) => [type, meta.icon]),
) as Record<ContentBlockType, string>;

function newId(): string {
  return crypto.randomUUID();
}

// LogoCloud extiende Grid: su prop `columns` es GridSize (1–12), no un
// `number` genérico como el resto de los bloques. Se acota aquí para la
// vista previa en vivo del editor.
function toGridSize(columns: number): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 {
  const clamped = Math.min(12, Math.max(1, Math.round(columns) || 1));
  return clamped as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
}

export function createBlock(type: ContentBlockType): ContentBlock {
  switch (type) {
    case "text":
      return { id: newId(), type, html: "" };
    case "image":
      return { id: newId(), type, url: "", alt: "" };
    case "carousel":
      return { id: newId(), type, images: [] };
    case "embed":
      return { id: newId(), type, language: "bash", code: "" };
    case "link":
      return { id: newId(), type, url: "", label: "" };
    case "video":
      return { id: newId(), type, source: "url", url: "", fileUrl: "" };
    case "mediaCarousel":
      return {
        id: newId(),
        type,
        slides: [],
        // El indicador (línea/miniaturas) ya no se elige en el editor (tarea
        // "sacar Indicador del editor"): quedó como control exclusivo de la
        // barra de previsualización del laboratorio (ver
        // originkit/CarouselPreview.tsx, ClassicCarousel en mdx-carousel.tsx).
        // "line" es el más neutro para un bloque recién creado. Los bloques
        // YA guardados con "thumbnail" no se tocan ni migran — este default
        // solo aplica a piezas nuevas.
        indicator: "line",
        aspectRatio: "16 / 9",
        carouselVariant: "default",
      };
    case "divider":
      return { id: newId(), type };
    case "section":
      return { id: newId(), type, title: "" };
    case "tag":
      return { id: newId(), type, label: "", variant: "neutral", size: "m" };
    case "categoryTags":
      return { id: newId(), type, selected: [] };
    case "badge":
      return { id: newId(), type, title: "", href: "" };
    case "status":
      return { id: newId(), type, color: "green", text: "" };
    case "progress":
      return { id: newId(), type, value: 50, min: 0, max: 100, showLabel: true };
    case "avatarGroup":
      return { id: newId(), type, avatars: [] };
    case "logoCloud":
      return { id: newId(), type, logos: [], columns: 4 };
    case "scroller":
      return { id: newId(), type, items: [] };
    case "masonry":
      return { id: newId(), type, images: [], columns: 3 };
  }
}

// Soporta watch?v=, youtu.be/, /embed/ y /shorts/.
export function extractYouTubeId(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{11})/,
  );
  return match ? match[1] : null;
}

// GOTCHA CRÍTICO (descubierto al integrar los 8 bloques nuevos, aplica
// retroactivamente a carousel/video/compare): next-mdx-remote/rsc compila
// con blockJS=true por defecto (serialize.js → removeJavaScriptExpressions),
// que elimina TODO atributo JSX escrito con llaves `prop={...}` —number,
// boolean, array u objeto— y solo deja pasar strings entre comillas planas
// o el shorthand booleano `prop` (sin valor). Verificado en pantalla:
// `<ProgressBar value={70} .../>` llega al componente con props={} (el
// atributo entero desaparece, no solo su valor), y `items={[...]}` en
// Carousel dejaba el prop `items` undefined sin tronar (silencioso). Por
// eso todos los bloques de abajo escriben SIEMPRE atributos planos con
// comillas ("value=\"70\"") en vez de `{70}`, y usan el shorthand
// booleano en vez de `{true}`/`{false}`.
const escapeAttr = (value: string) => value.replace(/"/g, "%22");

// FEATURE (tamaños de texto/títulos): el editor permite convertir la línea
// del cursor en h2/h3/h4 vía `document.execCommand("formatBlock", ...)` (ver
// RichTextEditor), que dentro del contentEditable deja un <h2>/<h3>/<h4>
// LITERAL en el `innerHTML` guardado. GOTCHA CRÍTICO verificado contra el
// propio comentario de mdx.tsx (case study "3 negocios ideas"): MDX compila
// HTML embebido literal (no producido por sintaxis Markdown `#`/`##`) como
// JSX con el nombre de tag a secas —`_jsx("h2", {...})`—, NUNCA como
// `_jsx(_components.h2, ...)`; el mapa de `components` de mdx.tsx
// (createHeading → HeadingLink con estilos Once UI) solo se activa para
// headings generados por la sintaxis Markdown real. Un <h2> literal dentro
// del <Text> del bloque escaparía ese mapeo y saldría con el h2 nativo del
// navegador (sin token tipográfico de Once UI, sin id de ancla). Por eso,
// antes de serializar, se extraen los h2/h3/h4 de nivel superior del HTML del
// bloque y se emiten como Markdown ATX puro (`## texto`) en su PROPIA línea,
// AFUERA de cualquier <Text>: eso sí pasa por el parser de Markdown real
// (remark) y llega a `components.h2` con el estilo completo de Once UI. El
// resto del contenido (párrafos normales) conserva el <Text> de siempre.
//
// BUG CONFIRMADO (auditoría con Playwright, ver reporte): cuando el heading
// llevaba el atributo `align` (centrado/derecha/justificado vía la barra de
// alineación por párrafo, ver `alignCurrentParagraph`), este camino ATX puro
// lo descartaba por completo — `node.textContent` no incluye atributos, así
// que `## texto` no transporta ninguna alineación y la vista pública SIEMPRE
// pintaba el heading a la izquierda aunque el editor mostrara el atributo
// correcto en el h2. Confirmado en las 3 capas: DOM del editor con
// `<h2 align="center">`, markdown guardado como `## texto` (sin rastro del
// align), visor público sin `style`/atributo de alineación en el `<h2>`
// resultante. FIX: cuando el heading SÍ tiene align explícito (no "left"), se
// emite como JSX literal `<Heading as="h2" align="center" ...>texto</Heading>`
// en vez de `##` — `Heading` ya está registrado tal cual en el mapa de
// `components` de mdx.tsx (import directo de Once UI, no wrapper propio), así
// que SÍ pasa por él (JSX con nombre en mayúscula, a diferencia del gotcha de
// arriba que solo aplica a HTML embebido con tag en minúscula) y su prop
// `align` es real (Heading.js aplica `textAlign` vía `style` DESDE el propio
// componente en render, no un `style=` escrito a mano en el Markdown fuente,
// así que `stripInlineStyleAttrs` de mdx.tsx —que solo limpia el texto fuente
// crudo— no lo toca). Se pierde el ícono de "copiar link" de `HeadingLink`
// para ESE heading puntual (tradeoff aceptado: `Heading` no trae esa afordancia,
// y replicarla requeriría duplicar su lógica de slug/clipboard aquí), pero se
// mantiene variant/tipografía Once UI idéntica a la del heading ATX (mismo
// mapeo de tamaño que `variantMap` de HeadingLink.js). Headings SIN align
// explícito siguen su camino ATX de siempre (parte, sin cambios de
// comportamiento para el caso común).
type TextSegment =
  | { type: "text"; html: string }
  | {
      type: "heading";
      level: 2 | 3 | 4;
      text: string;
      align?: TextBlockAlign;
      variant?: string;
    }
  // FEATURE (listas en la herramienta de texto): mismo criterio que
  // "heading" arriba — un `<ul>/<ol>` real del contentEditable (producido
  // por `execCommand("insertUnorderedList"/"insertOrderedList")`, ver
  // toolbar de `RichTextEditor`) sale de su propia ruta Markdown (líneas
  // `- item`/`1. item`, ver `serializeListElement`) en vez de ir embebido
  // como HTML crudo dentro de un `<Text>` — así SÍ pasa por la sintaxis real
  // de lista de remark y llega a `components.ul`/`ol`/`li` de mdx.tsx (List/
  // ListItem de Once UI), en vez de quedar como un `<ul>` nativo sin
  // registrar (mismo GOTCHA de "HTML embebido literal no pasa por
  // `components`" documentado junto a `escapeJsxText`/`TextSegment`).
  | { type: "list"; markdown: string };

const HEADING_TAG_LEVEL: Record<string, 2 | 3 | 4> = { H2: 2, H3: 3, H4: 4 };
const LIST_TAGS = new Set(["UL", "OL"]);

// Serializa un `<ul>`/`<ol>` real del contentEditable a líneas Markdown de
// lista (`- item` / `1. item`). Anidación simple: si un `<li>` trae su
// propia `<ul>/<ol>` hija (indentado por Tab dentro del contentEditable,
// comportamiento nativo de `execCommand`), se serializa recursivamente con 4
// espacios de indentación extra por nivel — 4 es el indent "universal" que
// CommonMark/remark reconoce como contenido anidado tanto bajo un marcador
// de viñeta ("- ", 2 chars) como bajo uno numerado de un dígito ("1. ", 3
// chars), sin necesitar calcular el ancho exacto del marcador padre.
function serializeListElement(el: Element, depth: number): string[] {
  const ordered = el.tagName === "OL";
  const indent = "    ".repeat(depth);
  const lines: string[] = [];
  let index = 1;
  Array.from(el.children).forEach((child) => {
    if (child.tagName !== "LI") return;
    const nestedLists = Array.from(child.children).filter((c) => LIST_TAGS.has(c.tagName));
    // Clona el <li> y le quita las listas anidadas antes de leer su
    // `innerHTML`: el contenido PROPIO del item (texto + negrita/cursiva/
    // enlace inline, ver GOTCHA de `TextSegment` arriba — sobrevive igual
    // que en un párrafo normal) debe quedar en su propia línea, separado de
    // las líneas que aporta la lista anidada.
    const clone = child.cloneNode(true) as Element;
    clone.querySelectorAll("ul, ol").forEach((nested) => nested.remove());
    const itemHtml = (clone.innerHTML || "").replace(/\s+/g, " ").trim();
    const marker = ordered ? `${index}.` : "-";
    lines.push(`${indent}${marker} ${itemHtml}`.trimEnd());
    nestedLists.forEach((nested) => {
      lines.push(...serializeListElement(nested, depth + 1));
    });
    if (ordered) index += 1;
  });
  return lines;
}

// Mismo mapeo que `variantMap` de HeadingLink.js (harness Once UI): variant
// tipográfico real por nivel de heading, para que un heading alineado (ruta
// JSX) se vea idéntico en tamaño/peso a uno sin alinear (ruta ATX). También
// sirve como valor "Predeterminado" (sin override) del selector de estilo.
const HEADING_VARIANT: Record<2 | 3 | 4, string> = {
  2: "heading-strong-xl",
  3: "heading-strong-l",
  4: "heading-strong-m",
};

// FEATURE (variantes de encabezado, curaduría ~6-8 opciones): `Heading`
// comparte `TextProps` con `Text` (ver ai/components/Heading.json →
// TextProps.variant: TextVariant), y `TextVariant` es un template literal
// `${TextType}-${TextWeight}-${TextSize}` con TextType = "body"|"heading"|
// "display"|"label"|"code" (ver ai/spec.json) — Heading.js (dist) solo
// parte el string por guiones para armar las clases `font-*`, sin validar
// que el tipo sea "heading": un `variant="body-strong-l"` en un `<Heading
// as="h2">` es 100% válido y renderiza con las mismas clases `font-body
// font-strong font-l` que ya usa cualquier `<Text variant="body-strong-l">`
// del sitio (verificado leyendo Heading.js: getVariantClasses no distingue
// origen). GOTCHA de props con llaves (ver arriba): `variant` es siempre
// string plano, así que sobrevive el pipeline igual que `align` — por eso
// el heading toma la MISMA ruta JSX (`<Heading variant=... />`) que ya usa
// `align`, ampliada para disparar también cuando el usuario elige un estilo
// no-default (ver `blockToMarkdown`, case "text").
// AUDITORÍA (duplicidad confirmada, ver informe): "body-strong-l"/
// "body-default-l" ("Texto destacado"/"Texto grande") duplicaban, con un
// mecanismo distinto y más costoso (obliga a convertir el párrafo en h2/h3/h4
// real —tag semántico, ver `setHeadingFormat`—, y este Select solo se
// habilita cuando `blockFormat !== "p"`), lo que el usuario ya espera resolver
// con "Peso del bloque" a nivel párrafo normal: texto grande/destacado SIN
// pagar el costo semántico de un heading. Se retiran de la curaduría
// visible (este array, fuente única del dropdown) para no ofrecer dos
// caminos a la misma intención — pero se CONSERVAN en
// `LEGACY_HEADING_VARIANT_VALUES` (ver abajo) para que una pieza YA
// guardada con ese valor en `data-variant` siga reconociéndose/
// serializándose IDÉNTICO (round-trip intacto, ver `syncSelectionState` y
// `splitTextBlockHtml`), aunque ya no aparezca como opción para elegir de
// nuevo.
const HEADING_VARIANT_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Predeterminado" },
  { value: "display-strong-l", label: "Título grande" },
  { value: "heading-strong-xl", label: "Título" },
  { value: "heading-strong-l", label: "Subtítulo" },
  { value: "heading-strong-m", label: "Encabezado" },
  { value: "heading-default-m", label: "Encabezado ligero" },
];

// Valores retirados de `HEADING_VARIANT_OPTIONS` (ver comentario arriba) que
// una pieza guardada ANTES de esta auditoría puede seguir trayendo en su
// `data-variant`: solo se usan para no romper el round-trip de esas piezas.
const LEGACY_HEADING_VARIANT_VALUES = new Set(["body-strong-l", "body-default-l"]);

const HEADING_VARIANT_VALUES = new Set([
  ...HEADING_VARIANT_OPTIONS.filter((option) => option.value !== "default").map(
    (option) => option.value,
  ),
  ...LEGACY_HEADING_VARIANT_VALUES,
]);

// FEATURE (color de texto, tarea 4, RETIRADA de la toolbar en la auditoría
// "controles universales" — ver `TextBlockColor` arriba): esta curaduría de
// tokens semánticos (`onBackground`) ya NO tiene dropdown propio; el control
// "Color" de la toolbar ahora es el `ColorInput` (hex libre, ver
// `RichTextEditor` más abajo). `TEXT_COLOR_OPTIONS` se retira junto con el
// dropdown — `TextBlockColor`/`color` (el campo, no el picker) siguen vivos
// solo para que una pieza publicada ANTES de esta tarea con
// `onBackground="brand-medium"` (etc.) en su Markdown guardado siga
// serializando/renderizando IDÉNTICO (ver `serializeTextSegment`).

// FEATURE (familia tipográfica, tarea 4, RETIRADA de la toolbar en la misma
// auditoría — ver `TextBlockFamily` arriba): mismo criterio que el color de
// arriba. El control "Fuente" de la toolbar ahora es libre (nombre real,
// FONT_LIBRARY) en vez de las 4 familias semánticas de Once UI
// (body/heading/label/code); `TEXT_FAMILY_OPTIONS` se retira junto con su
// dropdown — `TextBlockFamily`/`family` siguen vivos solo para
// retrocompatibilidad de piezas ya publicadas.

// El texto de un heading pasa a vivir como children de JSX (`<Heading>texto
// </Heading>`) en vez de texto plano de Markdown ATX (`## texto`): a
// diferencia del ATX (donde `{`/`<` no tienen significado especial), dentro
// de children JSX SÍ lo tienen (expresión `{...}` / posible tag nuevo). Se
// escapan a entidades HTML para que el heading centrado no trone/pierda texto
// si el usuario tecleó esos caracteres — el heading ya se aplana a texto
// plano de por sí (ver comentario de `splitTextBlockHtml`), así que no hace
// falta preservar ningún markup interno.
function escapeJsxText(value: string): string {
  return value.replace(/[{}<>]/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

function splitTextBlockHtml(html: string): TextSegment[] {
  // blockToMarkdown solo corre en el navegador (useMemo dentro de
  // CreateProjectModal, "use client"): usar el propio DOM para parsear es
  // más confiable que un regex contra HTML arbitrario del contentEditable.
  if (typeof document === "undefined") return [{ type: "text", html }];
  const container = document.createElement("div");
  container.innerHTML = html;
  const hasHeading = Array.from(container.children).some(
    (child) => child.tagName in HEADING_TAG_LEVEL,
  );
  const hasList = Array.from(container.children).some((child) => LIST_TAGS.has(child.tagName));
  if (!hasHeading && !hasList) return [{ type: "text", html }];

  const segments: TextSegment[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer.trim()) segments.push({ type: "text", html: buffer });
    buffer = "";
  };
  container.childNodes.forEach((node) => {
    const tagName = node.nodeType === Node.ELEMENT_NODE ? (node as Element).tagName : undefined;
    if (tagName && tagName in HEADING_TAG_LEVEL) {
      flush();
      const level = HEADING_TAG_LEVEL[tagName];
      // ATX heading de una sola línea: se aplana cualquier formato inline
      // interno (negrita/cursiva/enlace) a texto plano — un heading Once UI
      // ya trae su propio peso tipográfico fuerte, y anidar Markdown dentro
      // de un heading generado a mano abre más GOTCHAs de los que resuelve.
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      const rawAlign = (node as Element).getAttribute("align");
      const align =
        rawAlign === "center" || rawAlign === "right" || rawAlign === "justify"
          ? rawAlign
          : undefined;
      // `data-variant`: atributo HTML plano (no `style`), mismo criterio que
      // `align` arriba — puesto/quitado por `setHeadingVariant` en
      // RichTextEditor. Solo se respeta si coincide con la curaduría
      // (`HEADING_VARIANT_VALUES`), para no colar un valor arbitrario.
      const rawVariant = (node as Element).getAttribute("data-variant");
      const variant = rawVariant && HEADING_VARIANT_VALUES.has(rawVariant) ? rawVariant : undefined;
      if (text) segments.push({ type: "heading", level, text, align, variant });
    } else if (tagName && LIST_TAGS.has(tagName)) {
      flush();
      const lines = serializeListElement(node as Element, 0);
      if (lines.length > 0) segments.push({ type: "list", markdown: lines.join("\n") });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      buffer += (node as Element).outerHTML;
    } else {
      buffer += node.textContent ?? "";
    }
  });
  flush();
  return segments;
}

// Serializa un segmento de párrafo normal: es el mismo cuerpo que antes
// serializaba TODO el bloque de una sola vez (ver blame), ahora reutilizable
// por segmento cuando el bloque se partió por headings.
// FEATURE (controles universales — Fuente/Tamaño/Color, ver comentario junto
// a `ContentBlock["font"|"pt"|"hexColor"]` arriba): `font`/`pt`/`hexColor`
// son props STRING reales (mismo tipo de prop que `variant`/`onBackground`,
// sobreviven el GOTCHA de props con llaves igual que esos), así que se
// emiten como atributos planos adicionales del mismo `<Text>` cuando el
// usuario los definió — el wrapper de `Text` en mdx.tsx (`createTextElement`)
// los traduce a `style` al renderizar. `hexColor` tiene prioridad de
// RENDER sobre `color` (legacy) cuando ambos coexisten (no debería pasar
// desde este editor: la toolbar ya no permite fijar ambos a la vez), pero
// `onBackground` se sigue emitiendo siempre como fallback semántico.
function serializeTextSegment(
  html: string,
  align: TextBlockAlign,
  weight: TextBlockWeight,
  italic: boolean,
  color: TextBlockColor,
  family: TextBlockFamily,
  font: string | undefined,
  pt: number | undefined,
  hexColor: string | undefined,
): string {
  const trimmed = html.trim();
  if (!trimmed) return "";
  // Camino "sin cambios" (todo default): serializa IDÉNTICO a como
  // siempre — no ensucia el Markdown de las piezas que no tocan la
  // barra de estilo del bloque.
  if (
    align === "left" &&
    weight === "default" &&
    !italic &&
    color === "default" &&
    family === "default" &&
    !font &&
    pt === undefined &&
    !hexColor
  ) {
    return `<Text variant="body-default-m" onBackground="neutral-medium">\n${trimmed}\n</Text>`;
  }
  // Con cualquier override, `variant` deja de usarse: Text.js (Once UI)
  // IGNORA `size`/`weight` por completo cuando `variant` está presente
  // (ver dist/components/Text.js — `classes = variant ? getVariantClasses(variant)
  // : [sizeClass, weightClass]`), así que `weight="strong"` junto a
  // `variant="body-default-m"` no aplicaría nada. Se reconstruye la
  // misma tipografía body/m con `family`+`size` sueltos para poder
  // sumar `weight`/`align`/`color`/`family` reales.
  // "light" no existe como TextWeight real de Once UI (solo
  // "default"|"strong", ver ai/components/Text.json del harness): se
  // aproxima con `onBackground="neutral-weak"` (color atenuado, prop
  // real) en vez de un peso tipográfico inexistente. El selector de color
  // (tarea 4) es prioritario sobre esa aproximación: si el usuario elige un
  // color explícito, gana sobre el fallback de `weight="light"`.
  const resolvedOnBackground =
    color !== "default" ? color : weight === "light" ? "neutral-weak" : "neutral-medium";
  // `family` (TextType real: body/heading/label/code, ver ai/components/
  // Text.json) — "default" mantiene "body" de siempre.
  const resolvedFamily = family !== "default" ? family : "body";
  const attrs = [
    `family="${resolvedFamily}"`,
    `size="m"`,
    `onBackground="${resolvedOnBackground}"`,
  ];
  if (align !== "left") attrs.push(`align="${align}"`);
  if (weight === "strong") attrs.push(`weight="strong"`);
  if (font) attrs.push(`font="${escapeAttr(font)}"`);
  if (pt !== undefined) attrs.push(`pt="${pt}"`);
  if (hexColor) attrs.push(`color="${escapeAttr(hexColor)}"`);
  // GOTCHA (verificado en pantalla contra la pieza real de prueba):
  // cuando el contenido del bloque queda en su PROPIA línea dentro del
  // <Text> (con saltos de línea antes/después, como en el camino
  // "default" de arriba), MDX lo trata como contenido de bloque y lo
  // envuelve en un <p> — que este mismo archivo mapea a `createParagraph`
  // (ver mdx.tsx), el cual fuerza SIEMPRE `onBackground="neutral-medium"`
  // sin importar el `onBackground` del <Text> exterior. Ese doble
  // envoltorio ya existía en el camino "default" (inofensivo ahí: ambos
  // niveles pintan "neutral-medium", así que nadie lo notó), pero con
  // weight="light" (mapeado a onBackground="neutral-weak" en el Text
  // exterior) el <p> interno gana la pulseada de color y el texto se ve
  // igual de oscuro que el normal — el "aligerado" se pierde por
  // completo en la vista pública aunque el editor sí lo muestre bien.
  // Mantener el contenido PEGADO a las etiquetas (sin su propia línea)
  // evita que MDX lo trate como bloque aparte: así llega como contenido
  // en línea del propio <Text>, sin el <p>/createParagraph de por medio.
  const content = italic ? `<em>${trimmed}</em>` : trimmed;
  return `<Text ${attrs.join(" ")}>${content}</Text>`;
}

function blockToMarkdown(block: ContentBlock): string {
  switch (block.type) {
    case "text": {
      const html = block.html.trim();
      if (!html) return "";
      const align = block.align ?? "left";
      const weight = block.weight ?? "default";
      const italic = block.italic ?? false;
      const color = block.color ?? "default";
      const family = block.family ?? "default";
      const font = block.font;
      const pt = block.pt;
      const hexColor = block.hexColor;
      const segments = splitTextBlockHtml(html);
      const parts = segments.map((segment) => {
        if (segment.type === "list") {
          // Ver GOTCHA junto a `TextSegment`/`serializeListElement`: markdown
          // de lista real (línea propia, fuera de cualquier <Text>) para que
          // pase por la sintaxis de remark y llegue a `components.ul/ol/li`.
          return segment.markdown;
        }
        if (segment.type !== "heading") {
          return serializeTextSegment(
            segment.html,
            align,
            weight,
            italic,
            color,
            family,
            font,
            pt,
            hexColor,
          );
        }
        // Ver GOTCHA extenso junto a `TextSegment`/`escapeJsxText`: un heading
        // sin align NI variante propia sigue el camino ATX de siempre (con
        // anchor de copiar link); uno CON align y/o variante se emite como
        // `Heading` real de Once UI para que ambos sobrevivan a la vista
        // pública (ver comentario junto a `HEADING_VARIANT_OPTIONS`).
        if (!segment.align && !segment.variant) {
          return `${"#".repeat(segment.level)} ${segment.text}`;
        }
        const tag = `h${segment.level}` as "h2" | "h3" | "h4";
        const variant = segment.variant ?? HEADING_VARIANT[segment.level];
        const alignAttr = segment.align ? ` align="${segment.align}"` : "";
        return `<Heading as="${tag}" variant="${variant}"${alignAttr} marginTop="24" marginBottom="12">${escapeJsxText(segment.text)}</Heading>`;
      });
      return parts.filter((part) => part.trim() !== "").join("\n\n");
    }
    case "image":
      return block.url ? `![${block.alt}](${block.url})` : "";
    case "carousel": {
      const images = block.images.filter((i) => i.url);
      if (images.length === 0) return "";
      // Carousel real requiere `items` como array-prop: mismo bloqueo
      // estructural que AvatarGroup.avatars/LogoCloud.logos (ver GOTCHA
      // arriba) — imposible de pasar por este pipeline. Se sustituye por
      // Scroller (componente real, props planas) con Media individuales:
      // una tira horizontal deslizable, con las mismas flechas de
      // navegación que trae Scroller de fábrica.
      const items = images
        .map(
          (i) =>
            `  <Media src="${escapeAttr(i.url)}" alt="${escapeAttr(i.alt)}" aspectRatio="4 / 3" radius="m" width="160" minWidth="160" />`,
        )
        .join("\n");
      return `<Scroller direction="row" fadeColor="page" gap="12">\n${items}\n</Scroller>`;
    }
    case "embed": {
      if (!block.code.trim()) return "";
      // Un fence de 3 backticks trunca si el propio código pegado por el
      // usuario ya contiene una racha de 3+ backticks (ej. un snippet que
      // documenta Markdown): remark cierra el bloque en la PRIMERA racha
      // igual o mayor a la de apertura. Se usa un fence 1 backtick más largo
      // que la racha más larga encontrada en el código (mínimo 3) para que
      // el contenido nunca lo pueda cerrar antes de tiempo.
      const longestBacktickRun = Math.max(
        0,
        ...(block.code.match(/`+/g)?.map((run) => run.length) ?? [0]),
      );
      const fence = "`".repeat(Math.max(3, longestBacktickRun + 1));
      return `${fence}${block.language}\n${block.code}\n${fence}`;
    }
    case "link": {
      if (!block.url) return "";
      // Antes emitía markdown plano (`[label](url)`), que remark envuelve en
      // un `<p>` indistinguible del texto normal — no hay forma de centrar
      // SOLO ese `<p>` sin también centrar párrafos de texto real. Usar
      // `SmartLink` (ya registrado en el mapa de components de MDX) dentro
      // de un `Row` explícito lo vuelve un bloque propio, centrable igual
      // que logoCloud/avatarGroup/status (ver createRowElement en mdx.tsx).
      const label = block.label.trim() || block.url;
      return `<Row fillWidth horizontal="center">\n  <SmartLink href="${escapeAttr(block.url)}">${label}</SmartLink>\n</Row>`;
    }
    case "video": {
      // Dos modos (tarea "video por archivo"): "file" (subido, ver
      // VideoFileDropzone) serializa un <video> nativo con la data URL
      // directa en `src` — sobrevive el pipeline MDX como prop STRING plana
      // (mismo mecanismo que cualquier otro `src="..."` de este archivo,
      // ver GOTCHA junto a `escapeAttr`), sin necesitar registro en el mapa
      // de `components` de mdx.tsx (elemento HTML nativo, como el <iframe>
      // de YouTube de siempre). `controls` sin `autoPlay`: dentro del
      // cuerpo del artículo un video es contenido a demanda, no decorativo
      // (a diferencia de la portada, que autoplay-mutea de fondo).
      if (block.source === "file") {
        const fileUrl = block.fileUrl?.trim();
        if (!fileUrl) return "";
        return `<Column fillWidth radius="m" overflow="hidden" aspectRatio="16 / 9">\n  <video src="${escapeAttr(fileUrl)}" controls playsInline></video>\n</Column>`;
      }
      const youtubeId = extractYouTubeId(block.url);
      if (!youtubeId) return "";
      const embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
      // `src={JSON.stringify(embedUrl)}` y `style={{ aspectRatio, border }}`
      // se eliminaban por el GOTCHA de arriba (llaves) — y aunque no fuera
      // así, <iframe> es un elemento nativo (sin override en mdx.tsx) y
      // React exige que `style` sea objeto, no string, así que un
      // `style="..."` plano tampoco serviría. El aspect ratio se resuelve
      // con el prop nativo `aspectRatio` (string) de Column, igual que en
      // `compare`/`carousel`, en vez de un `style` de CSS.
      return `<Column fillWidth radius="m" overflow="hidden" aspectRatio="16 / 9">\n  <iframe width="100%" height="100%" src="${embedUrl}" title="Video de YouTube" frameBorder="0" allowFullScreen></iframe>\n</Column>`;
    }
    case "divider":
      return "---";
    case "section": {
      // `---\n\n## título`: la línea en blanco ENTRE el divisor y el heading
      // es obligatoria (no solo la que ya pone `blocksToMarkdown.join("\n\n")`
      // ENTRE bloques) — sin ella, remark podría leer el `##` como parte del
      // mismo párrafo del `---` en vez de dos nodos de bloque separados (hr +
      // heading). Sin título, el bloque degrada a un divisor plano (mismo
      // output que "divider"): un heading vacío no aporta nada al
      // HeadingNav ni al visor.
      const title = block.title.trim();
      return title ? `---\n\n## ${title}` : "---";
    }
    case "tag":
      // Envuelto en su propio `Row fillWidth horizontal="center"` (igual
      // que logoCloud/avatarGroup/status/link): `Tag` es `fitWidth` en
      // Once UI (Tag.js), así que sin este envoltorio queda pegado a la
      // izquierda del artículo. No se centra desde el mapa de components de
      // MDX porque `Tag` también es el chip que arma `scroller` (ver
      // createRowElement en mdx.tsx para el detalle).
      return block.label.trim()
        ? `<Row fillWidth horizontal="center">\n  <Tag variant="${block.variant}" size="${block.size}" label="${escapeAttr(block.label.trim())}" />\n</Row>`
        : "";
    case "categoryTags": {
      // DECISIÓN VERIFICADA (Chip vs Tag en el visor publicado): `Chip` (ver
      // node_modules/@once-ui-system/core/ai/components/Chip.json y
      // https://docs.once-ui.com/once-ui/form-controls/chip) es un control
      // interactivo — su selección visual depende de `onClick`
      // (MouseEventHandler, prop con llaves) y de `iconButtonProps`
      // (`Partial<IconButtonProps> = {}`, objeto). ambos se eliminan por el
      // mismo GOTCHA de arriba (blockJS quita cualquier atributo JSX escrito
      // con llaves), y aunque no fuera así el visor publicado (RSC estático,
      // sin cliente para manejar el evento) no tiene ningún handler real que
      // `onClick` pudiera invocar — solo tiene sentido como picker DENTRO de
      // este editor. `selected` (boolean, default `true`) sí sobreviviría
      // como shorthand (mismo truco que `label` de ProgressBar), pero sin
      // `onClick` cada Chip se vería SIEMPRE en su estado "seleccionado"
      // (ver Chip.js: el ícono de check y el borde de selección dependen de
      // ese boolean, no de si hay handler), lo que no comunica nada útil en
      // una lectura pasiva. Se opta por la ruta robusta ya probada en este
      // mismo archivo (mismo patrón que "tag"/"badge"/"scroller"): `Tag`
      // estático (props string, ya registrado tal cual en el mapa de
      // `components` de mdx.tsx) manteniendo la ESTÉTICA de chip/etiqueta en
      // la vista pública, aunque pierda la interactividad de picker (que de
      // cualquier forma no tendría ningún efecto en una pieza ya publicada).
      const selected = block.selected.filter((s) => s.trim());
      if (selected.length === 0) return "";
      const tags = selected
        .map((label) => `  <Tag variant="brand" size="m" label="${escapeAttr(label)}" />`)
        .join("\n");
      // `wrap` (sin `fillWidth`/`fill`) dispara el auto-centrado +
      // `fitWidth` de `createRowElement` en mdx.tsx — mismo mecanismo que ya
      // usa `logoCloud` (ver ese wrapper en mdx.tsx para el detalle).
      return `<Row gap="8" wrap>\n${tags}\n</Row>`;
    }
    case "badge": {
      if (!block.title.trim()) return "";
      const href = block.href.trim();
      // Mismo criterio que "tag" (ver comentario ahí): `Badge` es `fitWidth`
      // en Once UI (Badge.js).
      return `<Row fillWidth horizontal="center">\n  <Badge title="${escapeAttr(block.title.trim())}"${
        href ? ` href="${escapeAttr(href)}"` : ""
      } />\n</Row>`;
    }
    case "status": {
      if (!block.text.trim()) return "";
      return [
        `<Row gap="8" vertical="center">`,
        `  <StatusIndicator color="${block.color}" />`,
        `  <Text variant="body-default-m" onBackground="neutral-medium">${block.text.trim()}</Text>`,
        `</Row>`,
      ].join("\n");
    }
    case "progress": {
      // `label` es boolean: {true}/{false} se eliminan igual que cualquier
      // otro atributo con llaves, así que se usa el shorthand JSX (mismo
      // efecto que label={true}) o un string vacío (falsy) para false.
      const labelAttr = block.showLabel ? " label" : ` label=""`;
      return `<ProgressBar value="${block.value}" min="${block.min}" max="${block.max}"${labelAttr} />`;
    }
    case "avatarGroup": {
      const avatars = block.avatars.filter((a) => a.url || a.initials.trim());
      if (avatars.length === 0) return "";
      // AvatarGroup real requiere `avatars` como array-prop: imposible de
      // pasar por este pipeline (ver GOTCHA arriba) — verificado en
      // pantalla que el prop llega undefined y truena en "avatars.map".
      // Se sustituye por Avatar individuales (mismo componente real de
      // Once UI, props planas) dentro de una Row. Los colaboradores
      // agregados vía búsqueda (con `username`) se envuelven en `SmartLink`
      // (ya registrado en el mapa de components de MDX, mismo patrón que el
      // bloque "link") para enlazar a su perfil `/${username}`; los
      // avatares viejos sin `username` quedan igual que antes, sin link.
      const items = avatars
        .map((a) => {
          const avatarTag = a.url
            ? `<Avatar src="${escapeAttr(a.url)}" size="m" />`
            : `<Avatar value="${escapeAttr(a.initials.trim())}" size="m" />`;
          if (a.username) {
            return `  <SmartLink href="/${escapeAttr(a.username)}">${avatarTag}</SmartLink>`;
          }
          return `  ${avatarTag}`;
        })
        .join("\n");
      return `<Row gap="8">\n${items}\n</Row>`;
    }
    case "logoCloud": {
      const logos = block.logos.filter((l) => l.url);
      if (logos.length === 0) return "";
      // Mismo bloqueo que AvatarGroup: `logos` es un array-prop imposible
      // de pasar por este pipeline. Se sustituye por una fila de Media
      // (mismo tamaño de tile) — visualmente equivalente a una nube de
      // logos, aunque no sea el componente LogoCloud en sí.
      const items = logos
        .map(
          (l) =>
            `  <Media src="${escapeAttr(l.url)}" alt="Logo" width="6" height="4" radius="m" />`,
        )
        .join("\n");
      // `fitWidth` es clave: sin él, el Row hereda el ancho completo del
      // Column padre (align-items: stretch por default) y, al quedar más
      // ancho que sus tiles, deja un hueco final del tamaño aproximado de
      // un tile más — verificado en pantalla, se percibe como un "5º
      // espacio" vacío aunque el DOM solo tenga 4 <Media>. `fitWidth` hace
      // que el Row se encoja a su contenido real (4 tiles + gaps), sin
      // importar cuántos logos haya.
      return `<Row gap="24" wrap fitWidth>\n${items}\n</Row>`;
    }
    case "scroller": {
      const items = block.items.filter((i) => i.text.trim());
      if (items.length === 0) return "";
      const tags = items
        .map((i) => `  <Tag variant="neutral" label="${escapeAttr(i.text.trim())}" />`)
        .join("\n");
      return `<Scroller direction="row" fadeColor="page">\n${tags}\n</Scroller>`;
    }
    case "masonry": {
      const images = block.images.filter((i) => i.url);
      if (images.length === 0) return "";
      const items = images
        .map((i) => `  <Media src="${escapeAttr(i.url)}" alt="${escapeAttr(i.alt)}" radius="m" />`)
        .join("\n");
      return `<MasonryGrid columns="${block.columns}">\n${items}\n</MasonryGrid>`;
    }
    case "mediaCarousel": {
      // `MdxCarousel` (ver mdx-carousel.tsx) arma `Carousel.items` (array,
      // imposible como prop JSX — mismo GOTCHA de arriba) a partir de sus
      // `children` literales, así que cada slide se serializa como un tag
      // propio con props STRING planas. Slides sin contenido real (imagen
      // sin `url`, YouTube sin id extraíble, archivo sin subir) se
      // descartan, igual que el resto de los bloques con listas.
      const validSlides = block.slides.filter((s) => {
        if (s.kind === "image") return Boolean(s.url);
        if (s.kind === "youtube") return Boolean(extractYouTubeId(s.url));
        return Boolean(s.url);
      });
      if (validSlides.length === 0) return "";
      const items = validSlides
        .map((s) => {
          if (s.kind === "image") {
            return `  <Media src="${escapeAttr(s.url)}" alt="${escapeAttr(s.alt)}" />`;
          }
          if (s.kind === "youtube") {
            const youtubeId = extractYouTubeId(s.url) ?? "";
            return `  <CarouselVideoSlide kind="youtube" youtubeId="${escapeAttr(youtubeId)}" />`;
          }
          return `  <CarouselVideoSlide kind="file" src="${escapeAttr(s.url)}" />`;
        })
        .join("\n");
      // `variant` se omite por completo cuando es "default" (clásico): el
      // markdown de piezas ya guardadas no cambia ni un carácter y los
      // diffs de esta feature quedan mínimos. Prop STRING plana, nunca con
      // llaves (mismo GOTCHA de `escapeAttr` de arriba: blockJS elimina
      // cualquier `prop={...}`).
      const variant = block.carouselVariant ?? "default";
      const variantAttr = variant === "default" ? "" : ` variant="${escapeAttr(variant)}"`;
      return `<MdxCarousel indicator="${block.indicator}" aspectRatio="${escapeAttr(block.aspectRatio)}"${variantAttr} controls>\n${items}\n</MdxCarousel>`;
    }
  }
}

export function blocksToMarkdown(blocks: ContentBlock[]): string {
  return blocks
    .map(blockToMarkdown)
    .filter((text) => text.trim() !== "")
    .join("\n\n");
}

// --- Editor de texto enriquecido -------------------------------------------
// contentEditable + una barra con las operaciones más comunes. El resultado
// se guarda como HTML crudo: el visualizador lo embebe tal cual dentro de un
// <Text> (MDX soporta HTML embebido sin registrar cada tag).
// NOTA (Select de fuente/tamaño, intento 1, retirado): `applyStyle` envolvía
// la selección en un `<span style="...">` — pero el visor público
// (src/components/mdx.tsx, commit 77d966c, fix del HTML pegado de Word/Docs)
// elimina cualquier atributo `style` inline en strings, así que ese span
// jamás llegaba a verse en la pieza publicada aunque el editor lo mostrara
// bien. Además, con selección colapsada `wrapSelection` no hacía nada (retorno
// temprano), y los Select en sí se veían recortados/desalineados en esta
// barra.
// Intento 2 (el que sí quedó, ver `HEADING_FORMAT_OPTIONS`/`setBlockFormat`
// en RichTextEditor): en vez de `style`, se usa `document.execCommand(
// "formatBlock", ...)` para envolver la línea del cursor en h2/h3/h4 —tags
// reales, no atributos— y en `blockToMarkdown` esos headings se extraen y se
// re-emiten como Markdown `##`/`###` puro (ver `splitTextBlockHtml`), que sí
// sobrevive el pipeline completo y llega con el estilo Once UI real (pasa por
// `components.h2` de mdx.tsx). Mismo criterio de siempre: lo que no puede
// verse en el visor se quita del editor; lo que si sobrevive, se implementa.

// --- Opciones de los bloques nuevos -----------------------------------------
const TAG_VARIANT_OPTIONS: { label: string; value: TagVariant }[] = [
  { label: "Neutro", value: "neutral" },
  { label: "Marca", value: "brand" },
  { label: "Acento", value: "accent" },
  { label: "Info", value: "info" },
  { label: "Peligro", value: "danger" },
  { label: "Advertencia", value: "warning" },
  { label: "Éxito", value: "success" },
  { label: "Degradado", value: "gradient" },
];

const TAG_SIZE_OPTIONS: { label: string; value: TagSize }[] = [
  { label: "Pequeño", value: "s" },
  { label: "Mediano", value: "m" },
  { label: "Grande", value: "l" },
];

// Lenguajes soportados por el `CodeBlock` real de Once UI (Prism.js, ver
// `languageDependencies` en dist/modules/code/CodeBlock.impl.js): estos son
// standalone (sin dependencias extra) salvo "javascript"/"typescript", que
// el propio componente resuelve solo. "" (Texto plano) desactiva el
// resaltado de sintaxis pero conserva la barra completa + botón de copiar.
const CODE_LANGUAGE_OPTIONS: { label: string; value: string }[] = [
  { label: "Bash / Shell", value: "bash" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "CSS", value: "css" },
  { label: "HTML", value: "html" },
  { label: "JSON", value: "json" },
  { label: "Texto plano", value: "" },
];

const STATUS_COLOR_OPTIONS: { label: string; value: StatusColor }[] = [
  { label: "Azul", value: "blue" },
  { label: "Índigo", value: "indigo" },
  { label: "Violeta", value: "violet" },
  { label: "Magenta", value: "magenta" },
  { label: "Rosa", value: "pink" },
  { label: "Rojo", value: "red" },
  { label: "Naranja", value: "orange" },
  { label: "Amarillo", value: "yellow" },
  { label: "Musgo", value: "moss" },
  { label: "Verde", value: "green" },
  { label: "Esmeralda", value: "emerald" },
  { label: "Aqua", value: "aqua" },
  { label: "Cian", value: "cyan" },
  { label: "Gris", value: "gray" },
];

// --- Herramienta "Freelancers" (bloque avatarGroup) -----------------------
const MAX_COLLABORATORS = 8;

// Iniciales para el fallback de `Avatar` cuando el freelancer no tiene foto de
// perfil: primeras letras de las 2 primeras palabras del nombre (o del
// username si no hay nombre).
function computeInitials(name: string | null, username: string): string {
  const source = (name || username).trim();
  if (!source) return "";
  const letters = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || source[0]?.toUpperCase() || "";
}

function freelancerToAvatar(freelancer: PublicFreelancerResult): {
  id: string;
  url: string;
  initials: string;
  username?: string;
  name?: string;
} {
  return {
    id: freelancer.id,
    url: freelancer.imageUrl ?? "",
    initials: computeInitials(freelancer.name, freelancer.username),
    username: freelancer.username,
    name: freelancer.name ?? undefined,
  };
}

interface CollaboratorSearchProps {
  disabled?: boolean;
  excludeIds: string[];
  onAdd: (freelancer: PublicFreelancerResult) => void;
}

// Buscador de perfiles reales (server action `searchPublicFreelancers`) con
// debounce, usado por el editor del bloque "Freelancers" en vez de la
// antigua subida manual de foto/iniciales.
function CollaboratorSearch({ disabled, excludeIds, onAdd }: CollaboratorSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicFreelancerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const handle = setTimeout(() => {
      searchPublicFreelancers(query, 8)
        .then((freelancers) => setResults(freelancers))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, open]);

  const visibleResults = results.filter((freelancer) => !excludeIds.includes(freelancer.id));

  return (
    <Column fillWidth gap="8" style={{ position: "relative" }}>
      <Input
        id="collaborator-search"
        placeholder="Buscar por nombre o usuario…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Retraso corto: deja que el onMouseDown de la opción (que ya hizo
          // preventDefault) dispare su onClick antes de cerrar el popover.
          setTimeout(() => setOpen(false), 150);
        }}
        disabled={disabled}
      />
      {open && (loading || visibleResults.length > 0) && (
        <Column
          fillWidth
          gap="2"
          radius="m"
          border="neutral-alpha-weak"
          padding="4"
          background="page"
          shadow="l"
          style={{ maxHeight: "14rem", overflowY: "auto" }}
        >
          {loading && (
            <Row fillWidth horizontal="center" padding="8">
              <Spinner size="s" ariaLabel="Buscando colaboradores" />
            </Row>
          )}
          {!loading &&
            visibleResults.map((freelancer) => (
              <Row
                key={freelancer.id}
                fillWidth
                gap="8"
                vertical="center"
                padding="8"
                radius="s"
                cursor="interactive"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onAdd(freelancer);
                  setQuery("");
                  setResults([]);
                }}
              >
                {freelancer.imageUrl ? (
                  <Avatar src={freelancer.imageUrl} size="s" />
                ) : (
                  <Avatar value={computeInitials(freelancer.name, freelancer.username)} size="s" />
                )}
                <Column gap="2">
                  <Text variant="label-default-s" onBackground="neutral-strong">
                    {freelancer.name || freelancer.username}
                  </Text>
                  {freelancer.headline && (
                    <Text variant="body-default-xs" onBackground="neutral-weak">
                      {freelancer.headline}
                    </Text>
                  )}
                </Column>
              </Row>
            ))}
        </Column>
      )}
    </Column>
  );
}

// Envuelve la selección actual en `tag` (con atributos opcionales, ej. href).
// Si la selección cruza límites de nodos, surroundContents falla: el
// fallback extrae y reinserta el contenido, perdiendo el nodo original pero
// preservando el texto.
function wrapSelection(tag: string, attrs?: Record<string, string>): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
  const range = selection.getRangeAt(0);
  const wrapper = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) wrapper.setAttribute(key, value);
  }
  try {
    range.surroundContents(wrapper);
  } catch {
    const content = range.extractContents();
    wrapper.appendChild(content);
    range.insertNode(wrapper);
  }
  selection.removeAllRanges();
  const newRange = document.createRange();
  newRange.selectNodeContents(wrapper);
  selection.addRange(newRange);
}

function insertTextAtCursor(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

// Inserta un fragmento HTML (ya saneado) en la posición del cursor —
// contraparte de `insertTextAtCursor` para el pegado con formato (tarea
// "pegar texto con formato").
function insertHtmlAtCursor(html: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// --- Pegado con formato (tarea "pegar texto con formato") ------------------
// El navegador entrega el portapapeles en `text/html` cuando el origen tiene
// una versión enriquecida (Word, Google Docs, cualquier página web, o el
// propio contentEditable de otro bloque) y en `text/plain` como fallback
// universal. La meta es conservar SOLO el subconjunto que la toolbar ya sabe
// producir/serializar (negrita/cursiva/subrayado/tachado/enlace/listas/
// párrafos), sin colar el "cruft" que Word/Docs mete en cada `<span>` (clases
// `Mso*`, `style="mso-..."`, XML propietario en tags con namespace `o:`/`w:`/
// `v:`) — en vez de intentar un blocklist de esas marcas específicas (fase
// perdida, aparecen decenas de variantes), se usa un ALLOWLIST: solo se
// reconstruyen los tags que el editor entiende, y todo lo demás se DESENVUELVE
// (se conserva el contenido de texto, se descarta el tag) o se DESCARTA
// entero cuando es contenido no visible (script/style/meta/XML de Word).
const PASTE_DROP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "META",
  "LINK",
  "TITLE",
  "HEAD",
  "XML",
  "OBJECT",
  "NOSCRIPT",
  "IMG",
]);
const PASTE_HEADING_RE = /^H[1-6]$/;

function isBoldStyle(el: HTMLElement): boolean {
  const weight = el.style.fontWeight;
  return weight === "bold" || (weight !== "" && Number(weight) >= 600);
}
function isItalicStyle(el: HTMLElement): boolean {
  return el.style.fontStyle === "italic";
}
function isUnderlineStyle(el: HTMLElement): boolean {
  const decoration = el.style.textDecorationLine || el.style.textDecoration;
  return decoration.includes("underline");
}
function isStrikeStyle(el: HTMLElement): boolean {
  const decoration = el.style.textDecorationLine || el.style.textDecoration;
  return decoration.includes("line-through");
}

// Envuelve `node` (fragmento o elemento ya limpio) en `tagName`: usado para
// reconstruir negrita/cursiva/subrayado/tachado tanto desde el tag real
// (B/STRONG/I/EM/...) como desde el `style` inline de un `<span>` de Word
// (ver default branch de `cleanPastedNode`). `appendChild` sobre un
// `DocumentFragment` mueve sus hijos (lo vacía); sobre un `Node` normal lo
// reparenta — ambos casos dejan `node` listo para envolver de nuevo si hace
// falta apilar varios formatos (ej. negrita + cursiva de un span "bold
// italic").
function wrapPasteNode(tagName: string, node: Node): Node {
  const el = document.createElement(tagName);
  el.appendChild(node);
  return el;
}

// Limpia un `<li>` cuyo contenido Google Docs/Word envolvió en su propio
// `<p>`/`<div>` (patrón común al pegar listas desde Docs): desenreda UN nivel
// para que el `<li>` quede con contenido inline plano, listo para que
// `serializeListElement` lo lea como una sola línea de item.
function unwrapListItemParagraphs(fragment: DocumentFragment): DocumentFragment {
  const unwrapped = document.createDocumentFragment();
  Array.from(fragment.childNodes).forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName === "DIV") {
      Array.from((child as Element).childNodes).forEach((grandChild) =>
        unwrapped.appendChild(grandChild),
      );
    } else {
      unwrapped.appendChild(child);
    }
  });
  return unwrapped;
}

function cleanPastedFragment(source: Element | DocumentFragment): DocumentFragment {
  const output = document.createDocumentFragment();
  source.childNodes.forEach((child) => {
    const cleaned = cleanPastedNode(child);
    if (cleaned) output.appendChild(cleaned);
  });
  return output;
}

// Reconstruye recursivamente un nodo del portapapeles contra el allowlist del
// editor (b/strong, i/em, u, s/strike/del, a[href], ul/ol/li, p/div, br). Todo
// lo demás se desenvuelve a su contenido (spans/fonts/divs de layout,
// conservando negrita/cursiva/subrayado/tachado si venían por `style` inline
// en vez de por tag) o se descarta entero si es contenido no visible/no
// textual (ver `PASTE_DROP_TAGS`, tags con namespace de Word, `display:none`).
function cleanPastedNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? "";
    return text ? document.createTextNode(text) : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null; // comentarios, etc.
  const el = node as HTMLElement;
  const tag = el.tagName;

  // Tags con namespace de Word/Office (o:p, w:sdt, v:shapetype…) llegan como
  // nombres literales "O:P"/"W:SDT" al parsear vía innerHTML (el navegador no
  // los reconoce como HTML real) — se descartan por completo en vez de
  // intentar un allowlist de las decenas de variantes que existen.
  if (PASTE_DROP_TAGS.has(tag) || tag.includes(":")) return null;
  const inlineDisplay = el.style.display;
  if (inlineDisplay === "none") return null;

  const childFragment = cleanPastedFragment(el);
  const hasChildren = childFragment.childNodes.length > 0;

  switch (tag) {
    case "B":
    case "STRONG": {
      if (!hasChildren) return null;
      const b = document.createElement("b");
      b.appendChild(childFragment);
      return b;
    }
    case "I":
    case "EM": {
      if (!hasChildren) return null;
      const i = document.createElement("i");
      i.appendChild(childFragment);
      return i;
    }
    case "U": {
      if (!hasChildren) return null;
      const u = document.createElement("u");
      u.appendChild(childFragment);
      return u;
    }
    case "S":
    case "STRIKE":
    case "DEL": {
      if (!hasChildren) return null;
      const s = document.createElement("s");
      s.appendChild(childFragment);
      return s;
    }
    case "A": {
      const href = el.getAttribute("href");
      if (!href || !hasChildren) return hasChildren ? childFragment : null;
      const a = document.createElement("a");
      a.setAttribute("href", href);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      a.appendChild(childFragment);
      return a;
    }
    case "UL":
    case "OL": {
      if (!hasChildren) return null;
      const list = document.createElement(tag.toLowerCase());
      list.appendChild(childFragment);
      return list;
    }
    case "LI": {
      const li = document.createElement("li");
      if (hasChildren) li.appendChild(unwrapListItemParagraphs(childFragment));
      return li;
    }
    case "BR":
      return document.createElement("br");
    case "P":
    case "DIV":
    case "SECTION":
    case "ARTICLE": {
      // Mismo tag "de párrafo" que usa el resto del editor (ver
      // `BLOCK_LEVEL_TAGS`/`ensureBlockWrapping`): `<div>`, no `<p>`, para
      // que un párrafo pegado se comporte como cualquier línea escrita a
      // mano en este mismo contentEditable (alineación por párrafo,
      // detección de heading, etc.).
      if (!hasChildren) return null;
      const div = document.createElement("div");
      div.appendChild(childFragment);
      return div;
    }
    default: {
      if (PASTE_HEADING_RE.test(tag)) {
        // Encabezados de Word/Docs → párrafo con negrita (la tarea pide
        // "párrafos con bold o texto normal": el bloque de texto no maneja
        // headings propios — esos son el bloque "Nueva sección" aparte).
        if (!hasChildren) return null;
        const div = document.createElement("div");
        const b = document.createElement("b");
        b.appendChild(childFragment);
        div.appendChild(b);
        return div;
      }
      // span/font/cualquier otro tag no reconocido (incluye los `<span
      // style="mso-...">` de Word): se desenreda al contenido, conservando
      // negrita/cursiva/subrayado/tachado SOLO si venían por `style` inline
      // real (no por clase — las clases `Mso*` no traen ninguna regla CSS
      // real disponible aquí, ya que el <style> del documento se descarta).
      if (!hasChildren) return null;
      let content: Node = childFragment;
      if (isBoldStyle(el)) content = wrapPasteNode("b", content);
      if (isItalicStyle(el)) content = wrapPasteNode("i", content);
      if (isUnderlineStyle(el)) content = wrapPasteNode("u", content);
      if (isStrikeStyle(el)) content = wrapPasteNode("s", content);
      return content;
    }
  }
}

function sanitizePastedHtml(html: string): string {
  const container = document.createElement("div");
  container.innerHTML = html;
  const cleanedFragment = cleanPastedFragment(container);
  const wrapper = document.createElement("div");
  wrapper.appendChild(cleanedFragment);
  return wrapper.innerHTML;
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeHtmlAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

// Formato inline de una línea de texto plano con sintaxis Markdown evidente:
// mismo subconjunto que el resto de esta sección (bold/italic/link) — listas
// se resuelven aparte, línea por línea, en `plainTextOrMarkdownToHtml`.
function inlineMarkdownToHtml(text: string): string {
  let result = escapeHtmlText(text);
  result = result.replace(
    /\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_match, label: string, url: string) =>
      `<a href="${escapeHtmlAttr(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
  result = result.replace(
    /\*\*([^*]+)\*\*|__([^_]+)__/g,
    (_match, a: string | undefined, b: string | undefined) => `<b>${a ?? b}</b>`,
  );
  result = result.replace(
    /\*([^*]+)\*|_([^_]+)_/g,
    (_match, a: string | undefined, b: string | undefined) => `<i>${a ?? b}</i>`,
  );
  return result;
}

// Sintaxis Markdown "evidente" en texto plano (sin `text/html` en el
// portapapeles, ej. pegado desde un editor de código o una nota .md/.mdx):
// negrita/cursiva, listas con viñeta o numeradas, y links `[texto](url)`.
// Un texto sin ninguna de estas marcas cae al camino de texto plano de
// siempre (sin falsos positivos de un guion suelto o un asterisco de más).
const MARKDOWN_HINT_RE =
  /\*\*[^*]+\*\*|__[^_]+__|\[[^\]]+\]\([^)\s]+\)|^[ \t]*[-*+][ \t]+\S|^[ \t]*\d+\.[ \t]+\S/m;

function looksLikeMarkdownText(text: string): boolean {
  return MARKDOWN_HINT_RE.test(text);
}

// Convierte texto plano en HTML para el contentEditable: con sintaxis
// Markdown evidente, reconstruye negrita/cursiva/links/listas (mismos tags
// que produce la toolbar); sin ella, cada línea pasa a su propio `<div>`
// (mismo comportamiento nativo de pegado de Chrome en un contentEditable con
// `defaultParagraphSeparator` = div, ver `EMPTY_TEXT_BLOCK_SEED`/
// `ensureBlockWrapping`) — el pegado de texto plano "simple" no cambia.
function plainTextOrMarkdownToHtml(text: string): string {
  const lines = text.split(/\r\n|\r|\n/);
  if (!looksLikeMarkdownText(text)) {
    return lines.map((line) => `<div>${escapeHtmlText(line) || "<br>"}</div>`).join("");
  }
  const parts: string[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  const flushList = () => {
    if (!listBuffer) return;
    const tag = listBuffer.ordered ? "ol" : "ul";
    parts.push(`<${tag}>${listBuffer.items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`);
    listBuffer = null;
  };
  lines.forEach((line) => {
    const bulletMatch = line.match(/^[ \t]*[-*+][ \t]+(.*)$/);
    const numberedMatch = !bulletMatch ? line.match(/^[ \t]*\d+\.[ \t]+(.*)$/) : null;
    if (bulletMatch || numberedMatch) {
      const ordered = !!numberedMatch;
      const content = inlineMarkdownToHtml((bulletMatch ?? numberedMatch)?.[1] ?? "");
      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList();
        listBuffer = { ordered, items: [] };
      }
      listBuffer.items.push(content);
      return;
    }
    flushList();
    if (line.trim() === "") return; // separador entre párrafos markdown, no una línea vacía real
    parts.push(`<div>${inlineMarkdownToHtml(line)}</div>`);
  });
  flushList();
  return parts.join("");
}

interface RichTextEditorProps {
  html: string;
  align: TextBlockAlign;
  // `weight`/`color`/`family` (tokens semánticos legacy, ver comentario junto
  // a `ContentBlock["font"|"pt"|"hexColor"]`): ya no tienen control propio en
  // la toolbar, pero se siguen recibiendo/reenviando para que el preview en
  // vivo de una pieza vieja (cargada para editar) se vea idéntico a como se
  // publicó, y para que `blockToMarkdown` los siga serializando igual.
  weight: TextBlockWeight;
  italic: boolean;
  color: TextBlockColor;
  family: TextBlockFamily;
  // FEATURE (controles universales — Fuente/Tamaño/Color): reemplazos libres
  // de `family`/`color`, ver comentario extenso junto a `ContentBlock`.
  font?: string;
  pt?: number;
  hexColor?: string;
  onChange: (html: string) => void;
  onAlignChange: (align: TextBlockAlign) => void;
  onItalicChange: (italic: boolean) => void;
  // `onWeightChange`/`onColorChange`/`onFamilyChange` (setters de los 3
  // controles retirados de la toolbar, ver comentario junto a `weight`/
  // `color`/`family` arriba) se quitaron de esta interfaz: sin botón que los
  // dispare, `RichTextEditor` nunca los llamaba (parámetros muertos,
  // detectado por Biome). `ContentBlockCard` sigue leyendo `block.weight`/
  // `block.color`/`block.family` directo del estado para el `onChange` que sí
  // usa (guardar el bloque completo), sin pasar por estos.
  onFontChange: (font: string | undefined) => void;
  onPtChange: (pt: number | undefined) => void;
  onHexColorChange: (hexColor: string | undefined) => void;
  disabled?: boolean;
}

const ALIGN_OPTIONS: { value: TextBlockAlign; icon: string; label: string }[] = [
  { value: "left", icon: "alignLeft", label: "Izquierda" },
  { value: "center", icon: "alignCenter", label: "Centro" },
  { value: "right", icon: "alignRight", label: "Derecha" },
  { value: "justify", icon: "alignJustify", label: "Justificado" },
];

// `HeadingFormat` (p/h2/h3/h4): ya NO tiene selector propio en la toolbar
// (ver comentario junto a `RichTextEditorProps` — "Tipo de texto" se retiró
// en la auditoría "controles universales"). El tipo se conserva SOLO para
// `blockFormat`/`cursorInHeading` (detección de si el cursor vive dentro de
// un heading legacy ya guardado en una pieza vieja, ver `syncSelectionState`
// más abajo) — `HEADING_FORMAT_OPTIONS`/`HEADING_FORMAT_ABBR` (el catálogo
// del dropdown retirado) se eliminaron por quedar sin ningún uso.
type HeadingFormat = "p" | "h2" | "h3" | "h4";

// Alineación POR PÁRRAFO (tarea 4): investigado y confirmado con Playwright
// (test_align.mjs, descartado tras la prueba) que `document.execCommand(
// "justifyCenter"/...)` en Chromium SIEMPRE deja `style="text-align: ..."` en
// el elemento —incluso forzando `execCommand("styleWithCSS", false, false)`,
// que en teoría debería preferir tags/atributos sobre CSS—, y ese `style`
// es EXACTAMENTE lo que `stripInlineStyleAttrs` en mdx.tsx elimina (el
// sanitizador anti-HTML-de-Word). Alinear por párrafo vía execCommand se
// vería bien en el editor y se perdería por completo en la vista pública.
// Alternativa verificada que SÍ sobrevive: el atributo HTML clásico `align`
// (deprecado pero real, no `style`) en el elemento de bloque del párrafo
// (p/div/h2/h3/h4). Confirmado en 3 capas: (1) el navegador SÍ lo interpreta
// sin CSS propio (computed text-align pasa a "-webkit-left/-center/-right" o
// "justify" con solo el atributo, sin ninguna regla CSS de por medio); (2)
// `stripInlineStyleAttrs` solo filtra `style=`, no `align=`, así que
// sobrevive intacto al sanitizador; (3) React SÍ reenvía `align` como
// atributo DOM real en un host element nativo como "p" (probado con
// renderToStaticMarkup), que es justo la ruta que toma MDX para HTML
// embebido literal (ver GOTCHA de mdx.tsx sobre `_jsx("p", {...})`). Por eso
// el grupo de alineación de la toolbar ya NO cambia `block.align` (el
// bloque completo) sino que aplica/quita el atributo `align` en el elemento
// de bloque (p/div/h2/h3/h4) donde vive el cursor — cada línea/párrafo se
// alinea de forma independiente. `block.align`/`onAlignChange` se conservan
// solo como fallback para el caso raro de un bloque sin NINGÚN elemento de
// bloque interno (texto suelto directo en el contentEditable, sin línea
// propia todavía) y para no romper la serialización de piezas ya guardadas
// con ese campo.
const BLOCK_LEVEL_TAGS = new Set(["P", "DIV", "H2", "H3", "H4", "LI", "BLOCKQUOTE"]);

function getBlockAncestor(node: Node | null, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== root) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      BLOCK_LEVEL_TAGS.has((current as HTMLElement).tagName)
    ) {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }
  return null;
}

// BUG CONFIRMADO (auditoría con Playwright, "el ajuste de alineación a veces
// se ignora" — HIPÓTESIS B): en Chromium, la PRIMERA línea de un bloque de
// texto tecleada directo en el contentEditable (antes de cualquier Enter)
// vive como un text-node SUELTO, hijo directo del `<div ref>` — sin ningún
// `<p>`/`<div>` propio. Solo las líneas creadas DESPUÉS de presionar Enter
// quedan envueltas en su propio `<div>`. Verificado en pantalla: `getBlockAncestor`
// no encuentra ningún ancestro de bloque para ese texto suelto, así que
// `alignCurrentParagraph` cae al fallback legado (`onAlignChange`, alinea
// `block.align` ENTERO) — el usuario alinea "solo esa línea" y en realidad
// alinea/desalinea TODO el bloque, incluidas líneas posteriores ya envueltas
// en su propio `<div>` con su PROPIO `align` independiente. De ahí la
// intermitencia percibida: "a veces" el cursor cae en una línea con `<div>`
// propio (funciona bien, por párrafo) y "a veces" cae en la primera línea
// suelta (alinea todo el bloque, pisando lo demás).
// FIX: normalizar el contenido para que TODO viva dentro de un elemento de
// bloque propio desde el primer momento, casi eliminando el caso del
// fallback. `ensureBlockWrapping` envuelve cada tramo consecutivo de nodos
// sueltos (texto o inline) en su propio `<div>`, preservando orden y
// contenido; se invoca solo cuando `html` llega actualizado desde AFUERA
// (montaje inicial de un bloque nuevo, o carga de una pieza guardada para
// Editar) — nunca durante la edición activa del usuario, para no arriesgar
// saltos de cursor.
function ensureBlockWrapping(el: HTMLElement): boolean {
  let changed = false;
  const run: ChildNode[] = [];
  const hasRealContent = () =>
    run.some(
      (n) =>
        (n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "") ||
        n.nodeType === Node.ELEMENT_NODE,
    );
  const flush = () => {
    if (run.length > 0 && hasRealContent()) {
      const wrapper = document.createElement("div");
      el.insertBefore(wrapper, run[0]);
      run.forEach((node) => wrapper.appendChild(node));
      changed = true;
    }
    run.length = 0;
  };
  Array.from(el.childNodes).forEach((node) => {
    const isBlock =
      node.nodeType === Node.ELEMENT_NODE && BLOCK_LEVEL_TAGS.has((node as Element).tagName);
    if (isBlock) {
      flush();
    } else {
      run.push(node);
    }
  });
  flush();
  return changed;
}

// Semilla de un bloque de texto totalmente vacío (nunca se escribió nada
// todavía): un `<div>` con un `<br>` propio, para que la PRIMERA tecla que el
// usuario escriba caiga DENTRO de ese elemento de bloque (comportamiento
// nativo de Chromium al posicionar el caret en un contentEditable con un solo
// hijo elemento) en vez de crear, de nuevo, un text-node suelto directo del
// contentEditable — ver GOTCHA de `ensureBlockWrapping` arriba.
const EMPTY_TEXT_BLOCK_SEED = "<div><br></div>";

// BUG CONFIRMADO (auditoría, clase 2 — "opciones que no se reflejan en la
// previsualización del editor pero SÍ renderizan en el visor"): Color,
// Familia y Estilo de encabezado escribían únicamente en el estado del
// bloque (`onColorChange`/`onFamilyChange`/`data-variant`) sin tocar NUNCA
// el DOM del `contentEditable` — el editor en vivo se veía exactamente
// igual sin importar qué opción de esos 3 controles estuviera activa,
// mientras que el visor publicado (que sí lee esos valores en
// `serializeTextSegment`/`splitTextBlockHtml`) los aplicaba. Fix: reproducir
// en el propio `contentEditable` las MISMAS clases utilitarias que Once UI
// genera internamente para `Text`/`Heading` (ver dist/components/Text.js y
// Heading.js — `getVariantClasses`/`colorClass`, verificadas leyendo el
// paquete y confirmadas contra dist/css/styles.css: `.font-{type}`,
// `.font-{weight}`, `.font-{size}`, `.{scheme}-on-background-{weight}`,
// `.font-family-{family}` son clases REALES ya cargadas globalmente, no CSS
// nuevo). Se referencian por nombre en vez de re-renderizar `<Text>`/
// `<Heading>` de React porque el contenido es un DOM crudo editado por
// `execCommand` — envolverlo en componentes React competiría por el mismo
// nodo y perdería el caret en cada tecla.
function getVariantClasses(variant: string): string[] {
  const parts = variant.split("-");
  const size = parts.pop() ?? "m";
  const weight = parts.pop() ?? "default";
  const fontType = parts.join("-") || "body";
  return [`font-${fontType}`, `font-${weight}`, `font-${size}`];
}

function getOnBackgroundClass(value: string): string {
  const [scheme, weight] = value.split("-");
  return `${scheme}-on-background-${weight}`;
}

// Clases del párrafo/bloque normal (no-heading), calcadas 1:1 de
// `serializeTextSegment` (mismo par de caminos: "sin cambios" usa el
// shorthand `variant="body-default-m"`; cualquier override reconstruye
// `family`+`size="m"`+`onBackground`+`weight` sueltos — ver ese comentario
// para el detalle de por qué `variant` deja de usarse ahí).
function getParagraphPreviewClassName(
  weight: TextBlockWeight,
  color: TextBlockColor,
  family: TextBlockFamily,
): string {
  if (weight === "default" && color === "default" && family === "default") {
    return [...getVariantClasses("body-default-m"), getOnBackgroundClass("neutral-medium")].join(
      " ",
    );
  }
  const resolvedColor =
    color !== "default" ? color : weight === "light" ? "neutral-weak" : "neutral-medium";
  const resolvedFamily = family !== "default" ? family : "body";
  const classes = ["font-m", getOnBackgroundClass(resolvedColor), `font-family-${resolvedFamily}`];
  if (weight === "strong") classes.push("font-strong");
  return classes.join(" ");
}

// Estilo de un heading (h2/h3/h4) en vivo: mismo mapeo `HEADING_VARIANT`/
// `HEADING_VARIANT_VALUES` que ya usa la serialización, más el color fijo
// "neutral-on-background-strong" que `Heading.js` aplica por defecto sin
// `onBackground` (ver dist/components/Heading.js: `colorClass =
// "neutral-on-background-strong"` cuando no hay override) — los headings
// NUNCA reciben `color`/`family` de bloque en `blockToMarkdown` (van por su
// propia ruta `<Heading>`/ATX sin esos props), así que su preview tampoco
// debe heredarlos del párrafo exterior.
function getHeadingPreviewClassName(level: 2 | 3 | 4, rawVariant: string | null): string {
  const variant =
    rawVariant &&
    (HEADING_VARIANT_VALUES.has(rawVariant) || LEGACY_HEADING_VARIANT_VALUES.has(rawVariant))
      ? rawVariant
      : HEADING_VARIANT[level];
  return [...getVariantClasses(variant), "neutral-on-background-strong"].join(" ");
}

// Aplica `getHeadingPreviewClassName` a TODOS los h2/h3/h4 dentro de `root` y
// neutraliza `fontStyle`/`fontWeight` heredados por CSS del `<div>` exterior
// (color/tamaño/familia sí quedan resueltos por las clases de arriba, que
// SIEMPRE ganan sobre un valor heredado — pero `fontStyle`/`fontWeight`
// inline del padre son propiedades heredadas y no hay clase equivalente que
// las pise, así que se resetean a mano). Se llama tras cualquier mutación
// que pueda crear/actualizar un heading: carga inicial del bloque,
// conversión de formato y cambio de variante.
function syncHeadingPreviewStyles(root: HTMLElement): void {
  root.querySelectorAll("h2, h3, h4").forEach((node) => {
    const el = node as HTMLElement;
    const level = HEADING_TAG_LEVEL[el.tagName];
    if (!level) return;
    el.className = getHeadingPreviewClassName(level, el.getAttribute("data-variant"));
    el.style.fontStyle = "normal";
    el.style.fontWeight = "";
    // FEATURE (controles universales — Fuente/Tamaño/Color): igual que
    // fontStyle/fontWeight arriba, `fontFamily`/`fontSize`/`color` del
    // `<div>` exterior (ver `style` del contentEditable, RichTextEditor) son
    // propiedades heredadas por CSS — un heading NUNCA recibe estos 3
    // overrides de bloque (ver `blockToMarkdown`: los headings van por su
    // propia ruta JSX/ATX, sin `font`/`pt`/`color`), así que se resetean a
    // mano para que el preview en vivo coincida con el visor publicado.
    el.style.fontFamily = "";
    el.style.fontSize = "";
    el.style.color = "";
  });
}

// REDISEÑO (auditoría "toolbar rota a dos filas"): Fuente/Tamaño/Color usaban
// controles NATIVOS de Once UI incrustados directo en la barra (`IconButton`
// con children "Aa", `NumberInput`, `ColorInput`) — los dos últimos extienden
// `Input`, que nunca baja de `--static-space-40` de alto (GOTCHA conocido del
// harness), forzando la barra a DOS filas con controles desproporcionados
// frente a los `IconButton size="s"` (24px) del resto. Fix: los 3 controles
// pasan a ser un TRIGGER compacto (mismo alto que `IconButton size="s"`, ver
// `IconButton.module.scss` — `.s { height: var(--static-space-24) }`) que
// abre un `DropdownWrapper`; el control nativo completo (con su alto real de
// Input) vive DENTRO del dropdown, donde el alto no compite con la barra.
// Un solo componente reutilizable homologa la estética entre los 3 triggers
// (Fuente ya usaba este patrón de trigger+dropdown; Tamaño/Color se suman
// aquí) — mismos tokens (`background="neutral-alpha-weak"`, `radius="s"`,
// `cursor="interactive"`), en vez de reimplementar el mismo `Row` 3 veces.
function ToolbarDropdownTrigger({
  active,
  disabled,
  tooltip,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  tooltip?: ReactNode;
  children: ReactNode;
}) {
  const trigger = (
    <Row
      gap="4"
      vertical="center"
      paddingX="8"
      height="24"
      radius="s"
      background={active ? "neutral-alpha-medium" : "neutral-alpha-weak"}
      cursor={disabled ? "not-allowed" : "interactive"}
      opacity={disabled ? 50 : undefined}
    >
      {children}
      <Icon name="chevronDown" size="xs" onBackground="neutral-weak" />
    </Row>
  );
  if (!tooltip) return trigger;
  // Mismos primitivos que usa `IconButton` por dentro para su prop `tooltip`
  // (ver dist/components/IconButton.js): se reproducen a mano porque este
  // trigger ya no ES un `IconButton` (necesita ancho libre para el número/
  // nombre de fuente, no el cuadrado fijo de `IconButton`).
  return (
    <HoverCard
      trigger={trigger}
      placement="top"
      fade={0}
      scale={0.9}
      duration={200}
      offsetDistance="4"
    >
      <Tooltip label={tooltip} />
    </HoverCard>
  );
}

// HOTFIX (piezas nuevas guardando `<!--StartFragment-->`/`<!--EndFragment-->`
// en `markdownContent`, ver GOTCHA de fix de render en mdx.tsx —
// `stripHtmlComments`): al pegar contenido copiado de Word/Google Docs en
// este `contentEditable`, el navegador inserta esos comentarios de Word/Docs
// como nodos `Comment` reales del DOM (delimitan internamente el rango
// copiado) ANTES de que `onInput`/`emit` lean `innerHTML`. No hay un handler
// de `onPaste` propio en este editor (el pegado usa la ruta nativa del
// navegador, ver comentario de arquitectura junto a `stripInlineStyleAttrs`
// en mdx.tsx) — el único punto en común entre pegar y teclear es `emit`, así
// que ahí se limpia el DOM antes de serializar, mismo criterio que
// `ensureBlockWrapping` (normaliza el DOM vivo, no el string ya serializado).
// El fix de render en mdx.tsx sana lo YA guardado; este evita que se siga
// guardando en piezas nuevas — mismo patrón de "dos capas" que documenta la
// tarea.
function stripCommentNodes(el: HTMLElement): boolean {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    comments.push(node as Comment);
  }
  comments.forEach((comment) => comment.parentNode?.removeChild(comment));
  return comments.length > 0;
}

function RichTextEditor({
  html,
  align,
  weight,
  italic,
  color,
  family,
  font,
  pt,
  hexColor,
  onChange,
  onAlignChange,
  onItalicChange,
  onFontChange,
  onPtChange,
  onHexColorChange,
  disabled,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  // IDs únicos por instancia (un `RichTextEditor` por bloque de texto, ver
  // `ContentBlockCard`): `NumberInput`/`ColorInput` (ambos extienden `Input`,
  // que exige `id` real, ver ai/components/Input.json — `id: "!string"`) no
  // pueden compartir un id fijo si el usuario tiene varios bloques de texto
  // en la misma pieza.
  const sizeInputId = useId();
  const colorInputId = useId();
  // BUG CRÍTICO (texto guardado desaparece al reabrir con "Editar"): este
  // ref arrancaba en `useRef(html)` — con el `html` que llega YA cargado
  // (ej. al precargar una pieza guardada para editar). El div (sin
  // `dangerouslySetInnerHTML`) siempre arranca vacío en el DOM real; el
  // El efecto de abajo solo escribe `innerHTML` cuando `html !== lastEmitted.current`,
  // así que en el PRIMER montaje ambos ya eran iguales y nunca se copiaba el
  // contenido al DOM — el editor se veía vacío aunque `block.html` sí tuviera
  // el texto (y al guardar de nuevo, se perdía). Arrancar en "" fuerza que el
  // primer montaje con contenido real siempre difiera y dispare la escritura.
  const lastEmitted = useRef("");
  // Última selección (Range) capturada MIENTRAS vivía dentro del editor.
  // GOTCHA (bug del emoji cayendo al inicio): al abrir el EmojiPickerDropdown
  // (o los Select de fuente/tamaño), el foco del documento se mueve fuera del
  // contentEditable — la búsqueda del picker de emoji autoenfoca su propio
  // <Input>, y los Select internamente enfocan su trigger. En ese momento el
  // `Selection` global deja de tener un Range dentro del editor. El código
  // viejo llamaba `ref.current?.focus()` justo antes de leer
  // `window.getSelection()`: el foco SÍ vuelve al div, pero como el
  // navegador ya no tenía un Range asociado a él, coloca el caret en la
  // posición 0 por defecto (comportamiento nativo de `.focus()` en
  // contentEditable sin selección previa) — de ahí que el emoji (o el
  // wrap de negrita/cursiva vía los Select) aterrizara siempre al inicio.
  // La solución: rastrear el Range activo con `selectionchange` mientras
  // esté dentro de este editor, y restaurarlo explícitamente ANTES de
  // cualquier operación de la toolbar, en vez de confiar en dónde el
  // navegador decida dejar el caret al reenfocar.
  const lastRangeRef = useRef<Range | null>(null);
  // Estado "vivo" de la selección actual, para resaltar el botón/Select
  // correcto de la toolbar (negrita activa, tamaño del párrafo del cursor,
  // alineación del párrafo del cursor) — se recalcula en cada
  // `selectionchange` dentro de este editor, igual que `lastRangeRef`.
  // `unorderedList`/`orderedList` (tarea "listas en la herramienta de
  // texto"): mismo mecanismo de toggle real vía `document.queryCommandState`
  // que bold/italic/underline/strikeThrough (ver `toggleListFormat` más
  // abajo) — `execCommand("insertUnorderedList"/"insertOrderedList")` ya es
  // un toggle nativo del navegador (reaplicar sobre una lista existente la
  // "desarma" de vuelta a párrafos), así que se reutiliza el mismo patrón en
  // vez de reinventar un estado propio de lista.
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    unorderedList: false,
    orderedList: false,
  });
  // `blockFormat` (p/h2/h3/h4) ya NO tiene control de creación en la
  // toolbar (ver `cursorInHeading` más abajo) — se conserva SOLO para
  // DETECTAR si el cursor vive dentro de un heading legacy (h2/h3/h4 ya
  // guardado en una pieza vieja) y así deshabilitar los controles que no
  // aplican ahí (B/I/U/S/enlace/Fuente/Tamaño/Color), igual que siempre.
  const [blockFormat, setBlockFormat] = useState<HeadingFormat>("p");
  const [paragraphAlign, setParagraphAlign] = useState<TextBlockAlign>(align);
  // FEATURE (controles universales — Fuente/Tamaño/Color): estado de
  // apertura de los 3 dropdowns (mismo patrón `DropdownWrapper`, ver
  // `ToolbarDropdownTrigger`) — Tamaño y Color se sumaron en el rediseño de
  // la barra a una sola fila (antes `NumberInput`/`ColorInput` vivían
  // directo en la barra, sin popover propio; ver comentario junto a
  // `ToolbarDropdownTrigger`).
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);

  // Solo sincroniza el DOM cuando el cambio viene de afuera (ej. al cargar
  // un borrador): si lo hiciéramos en cada emit, el cursor saltaría al
  // inicio en cada tecla.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (html !== lastEmitted.current) {
      el.innerHTML = html;
      lastEmitted.current = html;
      // HIPÓTESIS B (ver GOTCHA junto a `ensureBlockWrapping`): normaliza
      // contenido cargado desde afuera (ej. una pieza guardada ANTES de este
      // fix, con texto suelto sin envoltorio propio) para que el fallback de
      // alineación de bloque completo casi nunca se necesite de aquí en
      // adelante. Si wrapping cambió algo, se propaga con `onChange` para que
      // `block.html` (y lo que se guarde si el usuario no vuelve a tocar este
      // bloque) ya refleje el contenido normalizado.
      if (ensureBlockWrapping(el)) {
        lastEmitted.current = el.innerHTML;
        onChange(lastEmitted.current);
      }
    }
    // Bloque totalmente vacío (nunca se escribió nada, ej. recién agregado
    // desde "Añadir sección"): sembrar un `<div>` propio para que la PRIMERA
    // tecla ya caiga dentro de un elemento de bloque (ver
    // `EMPTY_TEXT_BLOCK_SEED`) en vez de quedar como texto suelto. No emite
    // `onChange`: el bloque sigue "vacío" (`block.html === ""`) hasta que el
    // usuario escriba contenido real.
    if (el.childNodes.length === 0) {
      el.innerHTML = EMPTY_TEXT_BLOCK_SEED;
    }
    // Preview de headings (ver `syncHeadingPreviewStyles`): una pieza
    // cargada para editar puede traer h2/h3/h4 con `data-variant` ya
    // guardado — sin esto, el editor los mostraría con el tamaño por
    // defecto del navegador hasta la primera interacción con la barra.
    syncHeadingPreviewStyles(el);
  }, [html, onChange]);

  // BUG INTERMITENTE (el estilo elegido a veces no se aplica — reproducido
  // con Playwright disparando dos clicks de la toolbar en el mismo tick de
  // JS, ej. Negrita luego Cursiva sin ceder el hilo entre medio): la causa
  // raíz NO era el listener de `selectionchange` en sí, sino que
  // `restoreSelection` (ver abajo) confiaba CIEGAMENTE en `lastRangeRef`
  // (llenado solo por ese listener, asíncrono) y lo usaba para PISAR la
  // selección viva del navegador, incluso cuando esa selección viva ya era
  // perfectamente válida. Verificado en pantalla con el propio
  // `window.getSelection()`: justo después de que `execCommand("bold")`
  // corre, la Selection real del documento YA apunta, en el MISMO tick
  // síncrono, al nodo de texto correcto dentro del `<b>` recién creado — el
  // evento `selectionchange` que actualiza `lastRangeRef` llega DESPUÉS,
  // como tarea encolada por el navegador. Si el siguiente click de la
  // toolbar (ej. Cursiva) llega antes de que ese evento encolado se procese,
  // `lastRangeRef` todavía apunta al Range VIEJO (de antes del bold), cuyo
  // nodo contenedor de texto normalmente ya fue reemplazado/desprendido del
  // documento por el propio `execCommand` — `el.contains(saved...)` da
  // `false`, y `restoreSelection` caía al último fallback: colapsar el
  // cursor al FINAL del contenido. Cursiva entonces corría sobre una
  // selección colapsada (no aplica ningún wrap visible) en vez de sobre el
  // texto recién puesto en negrita — de ahí el "a veces no se aplica".
  // FIX: `restoreSelection` ahora SIEMPRE revisa primero la selección VIVA
  // del documento; si ya cae dentro del editor (el caso normal tras
  // cualquier `execCommand`, o cuando el foco nunca salió del todo — los
  // botones simples no le quitan la Selection al documento aunque muevan
  // `document.activeElement`), la usa tal cual y refresca `lastRangeRef` con
  // ella al vuelo, sin esperar al evento asíncrono. `lastRangeRef` +
  // `selectionchange` se conservan solo como red de respaldo para el caso
  // que sí los necesita: cuando el foco se fue a un control que SÍ le quita
  // la selección al documento (el Select viejo, el buscador del emoji
  // picker) y hay que restaurar manualmente dónde estaba el cursor antes de
  // que eso pasara.
  const syncSelectionState = () => {
    const el = ref.current;
    if (!el) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return;
    lastRangeRef.current = range.cloneRange();
    // queryCommandState/Value son APIs deprecadas pero universales (única
    // forma estándar de leer el estado de toggle real de execCommand); se
    // envuelven en try/catch porque algunos navegadores las marcan como
    // inseguras/lanzan fuera de un documento con foco activo.
    try {
      setActiveFormats({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        unorderedList: document.queryCommandState("insertUnorderedList"),
        orderedList: document.queryCommandState("insertOrderedList"),
      });
    } catch {
      // no-op: se conserva el último estado conocido.
    }
    const blockEl = getBlockAncestor(range.commonAncestorContainer, el);
    const tag = blockEl?.tagName;
    setBlockFormat(
      tag === "H2" || tag === "H3" || tag === "H4" ? (tag.toLowerCase() as HeadingFormat) : "p",
    );
    const attrAlign = blockEl?.getAttribute("align");
    setParagraphAlign(
      attrAlign === "center" || attrAlign === "right" || attrAlign === "justify"
        ? attrAlign
        : "left",
    );
  };

  useEffect(() => {
    document.addEventListener("selectionchange", syncSelectionState);
    return () => document.removeEventListener("selectionchange", syncSelectionState);
  }, []);

  const emit = () => {
    if (!ref.current) return;
    // Ver `stripCommentNodes`: limpia nodos `Comment` (ej. `<!--StartFragment
    // -->` de Word/Docs) del DOM vivo ANTES de serializar a `innerHTML`, para
    // que `markdownContent` nunca guarde un comentario HTML que rompa la
    // compilación MDX del visor público.
    stripCommentNodes(ref.current);
    lastEmitted.current = ref.current.innerHTML;
    onChange(lastEmitted.current);
  };

  // Restaura el último Range guardado dentro del editor (o, si nunca hubo
  // uno —editor recién montado/vacío, o el guardado quedó obsoleto—, coloca
  // el caret al final del contenido) y lo aplica al `Selection` del
  // documento. Debe llamarse SOLO cuando ya se determinó (en `focusEditor`,
  // ANTES de mover el foco) que la Selection viva NO está dentro del
  // editor — ver GOTCHA extenso ahí sobre por qué el orden importa.
  const restoreSelection = () => {
    const el = ref.current;
    if (!el) return;
    const selection = window.getSelection();
    if (!selection) return;
    const saved = lastRangeRef.current;
    if (saved && el.contains(saved.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(saved);
      return;
    }
    const fallback = document.createRange();
    fallback.selectNodeContents(el);
    fallback.collapse(false);
    selection.removeAllRanges();
    selection.addRange(fallback);
  };

  // Reenfoca el editor y restablece la selección real ANTES de mutar el
  // DOM: todas las acciones de la toolbar (bold/italic/underline/
  // strikethrough, fuente/tamaño, link, emoji) pasan por aquí en vez de
  // solo `ref.current?.focus()`.
  //
  // BUG INTERMITENTE (el estilo elegido a veces no se aplica) — DOS causas
  // raíz relacionadas, ambas reproducidas con Playwright disparando la
  // toolbar sin ceder el hilo entre acciones:
  //
  // (1) Dos clicks de la toolbar seguidos (ej. Negrita → Cursiva) SIN que el
  // navegador alcance a procesar el evento `selectionchange` de por medio:
  // justo después de `execCommand("bold")`, la Selection VIVA del documento
  // ya apunta (en el MISMO tick síncrono) al nodo de texto correcto dentro
  // del `<b>` recién creado, pero el evento `selectionchange` que actualiza
  // `lastRangeRef` llega DESPUÉS, como tarea encolada por el navegador.
  // Llamar SIEMPRE a `restoreSelection()` (que solo conoce `lastRangeRef`,
  // desactualizado en ese instante) pisaba esa Selection viva y correcta con
  // el Range VIEJO —cuyo nodo contenedor normalmente ya fue reemplazado por
  // el propio `execCommand`, así que ni siquiera es un Range válido— y
  // `restoreSelection` caía al fallback de colapsar el cursor al FINAL del
  // contenido. Cursiva corría entonces sobre una selección colapsada (no
  // aplica ningún wrap visible) en vez de sobre el texto recién puesto en
  // negrita.
  //
  // (2) La corrección obvia de (1) —"confiar en la Selection viva si ya cae
  // dentro del editor, antes que en `lastRangeRef`"— reintroduce, si se hace
  // DESPUÉS de `el.focus()`, el bug ORIGINAL que este mismo Range cacheado
  // vino a resolver (emoji/Select cayendo al inicio, ver GOTCHA de
  // `lastRangeRef` más arriba): reproducido con Playwright posicionando el
  // cursor a medio texto, abriendo el emoji picker y escribiendo en su
  // buscador (un <Input> real, que SÍ le quita la Selection al documento,
  // a diferencia de un botón simple) — `el.focus()` en un contentEditable
  // que en ESE instante no tiene ninguna Selection propia asociada coloca,
  // como comportamiento nativo del navegador, un caret colapsado en la
  // posición 0 DENTRO del editor — indistinguible de una Selection viva
  // "ya buena" si se revisa recién DESPUÉS de llamar a `.focus()`.
  //
  // FIX: la pregunta "¿la Selection viva ya cae dentro del editor?" se
  // responde ANTES de tocar el foco (ahí SÍ distingue los dos casos: un
  // botón simple nunca le quita la Selection al documento, un <Input> real
  // sí). Si la respuesta es sí, se refresca `lastRangeRef` con esa Selection
  // ya-buena y se deja intacta (nunca se pisa con el Range cacheado ni con
  // el default de `.focus()`) — resuelve (1). Si la respuesta es no, se
  // delega en `restoreSelection()` de siempre (`lastRangeRef` → fallback al
  // final) — conserva la resolución original de (2).
  const focusEditor = () => {
    const el = ref.current;
    const selection = window.getSelection();
    const liveRangeAlreadyInEditor =
      !!el &&
      !!selection &&
      selection.rangeCount > 0 &&
      el.contains(selection.getRangeAt(0).commonAncestorContainer);
    el?.focus();
    if (liveRangeAlreadyInEditor && selection) {
      lastRangeRef.current = selection.getRangeAt(0).cloneRange();
      return;
    }
    restoreSelection();
  };

  // TOGGLE real (tarea 2): `document.execCommand("bold"/"italic"/
  // "underline"/"strikeThrough")` reemplaza a `wrapSelection` para estos 4
  // botones. A diferencia de `wrapSelection` (que solo AGREGABA un
  // <strong>/<em>/<u>/<s> nuevo sin poder quitarlo, y anidaba tags si se
  // repetía), execCommand es un toggle nativo del navegador: reaplicar
  // "bold" sobre texto ya en <b> lo QUITA (verificado con Playwright:
  // `<b>x</b>` → "bold" → "x" plano), y además el navegador recuerda el
  // estado de negrita/cursiva/etc. del CARET (no solo de la selección), así
  // que el texto que se escribe después de togglear hereda correctamente el
  // nuevo estado (activado o desactivado) sin heredar el formato viejo a la
  // fuerza. Produce <b>/<i>/<u>/<strike> (no <strong>/<em>/<u>/<s>), pero son
  // tags HTML nativos: el visor los recibe como HTML embebido crudo dentro
  // del <Text> (igual que antes) y el navegador los renderiza con el mismo
  // efecto visual (negrita/cursiva/subrayado/tachado) sin necesitar mapeo en
  // mdx.tsx.
  const toggleInlineFormat = (command: "bold" | "italic" | "underline" | "strikeThrough") => {
    focusEditor();
    document.execCommand(command);
    emit();
  };

  // Listas (tarea "listas en la herramienta de texto"): mismo patrón toggle
  // que `toggleInlineFormat` — `execCommand("insertUnorderedList"/
  // "insertOrderedList")` convierte el/los párrafo(s) de la selección actual
  // en `<ul>`/`<ol>` con sus `<li>`, o los devuelve a párrafos si ya eran una
  // lista del mismo tipo (toggle nativo). `blockToMarkdown` (ver
  // `splitTextBlockHtml`/`serializeListElement`) convierte esos `<ul>/<ol>/
  // <li>` reales a Markdown de lista (`- item`/`1. item`) al guardar.
  const toggleListFormat = (command: "insertUnorderedList" | "insertOrderedList") => {
    focusEditor();
    document.execCommand(command);
    emit();
  };

  const insertLink = () => {
    const url = window.prompt("URL del enlace");
    if (!url) return;
    focusEditor();
    wrapSelection("a", { href: url, target: "_blank", rel: "noopener noreferrer" });
    emit();
  };

  const insertEmoji = (emoji: string) => {
    focusEditor();
    insertTextAtCursor(emoji);
    emit();
  };

  // Pegado con formato (tarea "pegar texto con formato"): intercepta el
  // portapapeles ANTES de que el navegador inserte su propio HTML crudo (que
  // traería el cruft de Word/Docs sin sanear, ver `cleanPastedNode`).
  // `text/html` tiene prioridad (preserva negrita/cursiva/enlaces/listas
  // reales); sin ella, `text/plain` con sintaxis Markdown evidente se
  // convierte a los mismos tags, y cualquier otro texto plano cae al mismo
  // comportamiento de siempre (una línea por `<div>`, sin tocar el paste
  // simple). Si el portapapeles no trae NINGUNO de los dos (ej. solo una
  // imagen) se deja pasar el comportamiento nativo del navegador —esta app
  // no maneja pegar imágenes en el bloque de texto, ni antes de esta tarea.
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const html = clipboard.getData("text/html");
    const text = clipboard.getData("text/plain");
    if (!html && !text) return;
    event.preventDefault();
    focusEditor();
    const fragmentHtml = html ? sanitizePastedHtml(html) : plainTextOrMarkdownToHtml(text);
    if (!fragmentHtml) return;
    insertHtmlAtCursor(fragmentHtml);
    emit();
  };

  // NOTA (auditoría "controles universales"): `toggleWeight`/
  // `setHeadingFormat`/`setHeadingVariant` (peso de bloque, conversión a
  // heading, variante de heading) se retiraron junto con sus 3 botones de la
  // toolbar (ver comentario junto a `RichTextEditorProps` y el `return` de
  // este componente) — un heading ya NO se puede crear/editar desde aquí,
  // solo detectarse si ya existía en una pieza vieja (ver `blockFormat`/
  // `cursorInHeading`). `weight`/`onWeightChange` siguen viviendo como props
  // pasivas (preview + serialización de piezas ya publicadas, ver comentario
  // junto a `RichTextEditorProps`).

  // Alineación POR PÁRRAFO (tarea 4, ver nota extensa junto a
  // `BLOCK_LEVEL_TAGS` arriba): en vez de aplicar `align` a todo el bloque,
  // busca el elemento de bloque (p/div/h2/h3/h4) donde vive el cursor y le
  // pone/quita el atributo HTML `align` (nunca `style`). Si el cursor está en
  // texto suelto sin ningún elemento de bloque propio todavía (bloque
  // recién creado, una sola línea sin <p>/<div>), no hay nada que aislar:
  // cae al comportamiento legado de bloque completo (`onAlignChange`) para
  // no perder la función en ese caso límite.
  const alignCurrentParagraph = (value: TextBlockAlign) => {
    focusEditor();
    const el = ref.current;
    const selection = window.getSelection();
    if (!el || !selection || selection.rangeCount === 0) return;
    const blockEl = getBlockAncestor(selection.getRangeAt(0).commonAncestorContainer, el);
    if (!blockEl) {
      onAlignChange(value);
      return;
    }
    if (value === "left") blockEl.removeAttribute("align");
    else blockEl.setAttribute("align", value);
    setParagraphAlign(value);
    emit();
  };

  // BUG CONFIRMADO (auditoría, clase 3 — "opciones que se rompen o no hacen
  // nada en el visor final"): `splitTextBlockHtml` aplana un heading a texto
  // plano vía `node.textContent` (ver ese comentario) — cualquier
  // negrita/cursiva/subrayado/tachado/enlace aplicado DENTRO de un h2/h3/h4
  // se ve bien en el editor pero desaparece silenciosamente al publicar (el
  // heading YA se ve fuerte con su propio peso tipográfico, así que "Negrita"
  // ahí no solo no sobrevive: no comunica nada distinto tampoco). No es
  // corregible sin reescribir el heading a HTML enriquecido (abre los
  // GOTCHAs de Markdown-dentro-de-heading que ese mismo comentario decidió
  // evitar), así que se deshabilitan estos controles mientras el cursor está
  // en un heading, en vez de dejar una opción visible que se pierde en
  // silencio.
  const cursorInHeading = blockFormat !== "p";
  const inlineFormatTooltip = (label: string) =>
    cursorInHeading ? `${label} (no disponible en títulos)` : label;

  return (
    <Column fillWidth gap="8" radius="m" border="neutral-alpha-weak" padding="8" background="page">
      {/* Barra única: alineación y tamaño de texto aplican al PÁRRAFO del
          cursor (ver `alignCurrentParagraph`/`setHeadingFormat`), peso "Aa"
          sigue aplicando al bloque completo, y B/I/U/S/enlace/emoji son
          TOGGLES reales sobre el texto seleccionado vía execCommand (ver
          `toggleInlineFormat`). Los toggles de bloque de negrita/cursiva se
          retiraron por duplicar la B/I inline (misma funcionalidad visible,
          dos controles). */}
      <Row gap="4" vertical="center" wrap overflowX="auto">
        {ALIGN_OPTIONS.map((option) => (
          <IconButton
            key={option.value}
            icon={option.icon}
            tooltip={`Alinear párrafo: ${option.label}`}
            variant={paragraphAlign === option.value ? "primary" : "tertiary"}
            size="s"
            onClick={() => alignCurrentParagraph(option.value)}
            disabled={disabled}
          />
        ))}
        <Line vert background="neutral-alpha-weak" height="20" />
        {/* FEATURE (controles universales, auditoría "herramienta de texto
            amigable"): reemplaza los 3 controles poco reconocibles (Tipo de
            texto/Estilo de encabezado/Peso del bloque, ver comentario junto a
            `RichTextEditorProps`) por Fuente/Tamaño/Color — mismo mental
            model que cualquier procesador de texto (Word/Docs), aplican al
            BLOQUE completo (mismo nivel que antes `color`/`family`, ver
            `onFontChange`/`onPtChange`/`onHexColorChange`). Deshabilitados
            con el cursor en un heading legacy por el mismo motivo que ya
            aplicaba a color/familia: un heading nunca recibe estos overrides
            de bloque (ver `getHeadingPreviewClassName`/`blockToMarkdown`, van
            por su propia ruta JSX/ATX sin `font`/`pt`/`color`). */}
        <DropdownWrapper
          isOpen={fontMenuOpen}
          onOpenChange={(open) => setFontMenuOpen(open && !(disabled || cursorInHeading))}
          placement="bottom-start"
          trigger={
            <ToolbarDropdownTrigger
              tooltip={inlineFormatTooltip(`Fuente: ${font ? font : "Predeterminada"}`)}
              active={!!font}
              disabled={disabled || cursorInHeading}
            >
              {/* Preview inmediato: el trigger muestra "Aa" en la fuente
                  activa (con `style.fontFamily` real — no hay token Once UI
                  para un nombre de fuente libre, ver GOTCHA `color.tokens`,
                  esto es contenido editable del USUARIO, no decoración de
                  layout), más el nombre corto de la fuente CUANDO cabe (≤6
                  caracteres: "Arial"/"Lato"/"Roboto"/"Oswald") — nombres
                  largos ("Playfair Display") solo muestran "Aa" para no
                  romper la fila única (ver auditoría de la barra). */}
              <Text variant="label-strong-s" style={{ fontFamily: resolveFontStack(font) }}>
                Aa
              </Text>
              {font && font.length <= 6 && (
                <Text variant="label-default-s" onBackground="neutral-weak" truncate>
                  {font}
                </Text>
              )}
            </ToolbarDropdownTrigger>
          }
          dropdown={
            <Column
              minWidth={12}
              padding="4"
              gap="2"
              style={{ maxHeight: "16rem", overflowY: "auto" }}
            >
              <Option
                label="Predeterminada"
                value="default"
                selected={!font}
                onClick={() => {
                  onFontChange(undefined);
                  setFontMenuOpen(false);
                }}
              />
              {FONT_LIBRARY.map((entry) => (
                <Option
                  key={entry.name}
                  label={<span style={{ fontFamily: entry.cssValue }}>{entry.name}</span>}
                  value={entry.name}
                  selected={font === entry.name}
                  onClick={() => {
                    onFontChange(entry.name);
                    setFontMenuOpen(false);
                  }}
                />
              ))}
            </Column>
          }
        />
        {/* Tamaño por puntaje: trigger compacto con el valor actual + caret
            (mismo patrón que Fuente, ver `ToolbarDropdownTrigger`) — el
            `NumberInput` real de Once UI (ai/components/NumberInput.json)
            vive DENTRO del dropdown, junto con los presets curados de
            `TEXT_SIZE_PRESETS` (ver src/lib/fontLibrary.ts) como `Option`
            de acceso rápido.
            GOTCHA VERIFICADO (Playwright, valor custom "a veces" no se
            aplicaba): `DropdownWrapper` con `handleArrowNavigation` (default
            `true`) envuelve el contenido en `ArrowNavigation`
            (dist/hooks/useArrowNavigation.js), que escucha `keydown` en TODO
            el dropdown-portal —no solo en los `Option`— y su caso `'Enter'`
            dispara `onSelect(focusedIndex)` incondicionalmente cuando
            `focusedIndex >= 0` (autoFocus deja `focusedIndex=0` apenas abre,
            resaltando el primer preset). Con presets Y un `NumberInput`
            sueltos en el mismo dropdown, presionar Enter DENTRO del
            `NumberInput` para confirmar un valor custom quedaba interceptado
            por ese listener y seleccionaba el primer preset ("10 pt") en vez
            de aplicar lo tecleado — reproducido en pantalla: valor tecleado
            "36", Enter, el trigger terminaba mostrando "10". Se desactiva
            `handleArrowNavigation` en ESTE dropdown (mixto Option+Input) —
            los clicks en `Option` siguen funcionando igual (su `onClick`
            propio no depende de `ArrowNavigation`), y Enter/flechas dentro
            del `NumberInput` quedan libres para su comportamiento nativo. Los
            otros 2 dropdowns (Fuente, solo `Option`; Color, sin ningún
            `Option`) no tocan esta prop: no mezclan input libre con lista
            navegable. */}
        <DropdownWrapper
          isOpen={sizeMenuOpen}
          onOpenChange={(open) => setSizeMenuOpen(open && !(disabled || cursorInHeading))}
          placement="bottom-start"
          handleArrowNavigation={false}
          trigger={
            <ToolbarDropdownTrigger
              tooltip={inlineFormatTooltip(`Tamaño: ${pt ?? DEFAULT_TEXT_PT}pt`)}
              active={pt !== undefined}
              disabled={disabled || cursorInHeading}
            >
              <Text variant="label-strong-s" onBackground="neutral-strong">
                {pt ?? DEFAULT_TEXT_PT}
              </Text>
            </ToolbarDropdownTrigger>
          }
          dropdown={
            <Column
              minWidth={10}
              padding="4"
              gap="2"
              style={{ maxHeight: "16rem", overflowY: "auto" }}
            >
              {TEXT_SIZE_PRESETS.map((preset) => (
                <Option
                  key={preset}
                  label={`${preset} pt`}
                  value={String(preset)}
                  selected={pt === preset}
                  onClick={() => {
                    onPtChange(preset);
                    setSizeMenuOpen(false);
                  }}
                />
              ))}
              <Line background="neutral-alpha-weak" />
              <Row paddingX="4" paddingY="4" gap="8" vertical="center">
                <Text variant="label-default-s" onBackground="neutral-weak">
                  Personalizado
                </Text>
                <NumberInput
                  id={sizeInputId}
                  value={pt ?? DEFAULT_TEXT_PT}
                  onChange={(value) => onPtChange(value)}
                  min={8}
                  max={96}
                  step={1}
                />
              </Row>
            </Column>
          }
        />
        {/* Color libre: trigger es un swatch circular (~20px) con el color
            actual — icono "eyeDropper" cuando no hay override (ver
            docs.once-ui.com/once-ui/utilities/icon, IconName incluye
            "eyeDropper"). El `ColorInput` real de Once UI (ai/components/
            ColorInput.json), con su propio botón de reset nativo, y un
            botón "Color del tema" (equivalente semántico) viven DENTRO del
            dropdown. AVISO (documentado también en mdx.tsx y en el reporte
            de la tarea): un hex fijo NO se adapta a modo claro/oscuro —
            decisión consciente del usuario al elegir un color libre en vez
            de dejarlo en "Predeterminado". */}
        <DropdownWrapper
          isOpen={colorMenuOpen}
          onOpenChange={(open) => setColorMenuOpen(open && !(disabled || cursorInHeading))}
          placement="bottom-start"
          trigger={
            <ToolbarDropdownTrigger
              tooltip={inlineFormatTooltip(`Color: ${hexColor ?? "Predeterminado"}`)}
              active={!!hexColor}
              disabled={disabled || cursorInHeading}
            >
              {hexColor ? (
                <Row
                  width="20"
                  height="20"
                  radius="full"
                  border="neutral-alpha-medium"
                  style={{ backgroundColor: hexColor }}
                />
              ) : (
                <Row width="20" height="20" radius="full" border="neutral-alpha-medium" center>
                  <Icon name="eyeDropper" size="xs" onBackground="neutral-weak" />
                </Row>
              )}
            </ToolbarDropdownTrigger>
          }
          dropdown={
            <Column minWidth={12} padding="8" gap="8">
              <ColorInput
                id={colorInputId}
                value={hexColor ?? ""}
                onChange={(e) => onHexColorChange(e.target.value || undefined)}
              />
              <Button
                variant="tertiary"
                size="s"
                label="Color del tema"
                prefixIcon="refresh"
                fillWidth
                onClick={() => {
                  onHexColorChange(undefined);
                  setColorMenuOpen(false);
                }}
              />
            </Column>
          }
        />
        <Line vert background="neutral-alpha-weak" height="20" />
        <IconButton
          icon="bold"
          tooltip={inlineFormatTooltip("Negrita")}
          variant={activeFormats.bold ? "primary" : "tertiary"}
          size="s"
          onClick={() => toggleInlineFormat("bold")}
          disabled={disabled || cursorInHeading}
        />
        <IconButton
          icon="italic"
          tooltip={inlineFormatTooltip("Cursiva")}
          variant={activeFormats.italic ? "primary" : "tertiary"}
          size="s"
          onClick={() => toggleInlineFormat("italic")}
          disabled={disabled || cursorInHeading}
        />
        <IconButton
          icon="underline"
          tooltip={inlineFormatTooltip("Subrayado")}
          variant={activeFormats.underline ? "primary" : "tertiary"}
          size="s"
          onClick={() => toggleInlineFormat("underline")}
          disabled={disabled || cursorInHeading}
        />
        <IconButton
          icon="strikethrough"
          tooltip={inlineFormatTooltip("Tachado")}
          variant={activeFormats.strikeThrough ? "primary" : "tertiary"}
          size="s"
          onClick={() => toggleInlineFormat("strikeThrough")}
          disabled={disabled || cursorInHeading}
        />
        <Line vert background="neutral-alpha-weak" height="20" />
        <IconButton
          icon="listBullets"
          tooltip={inlineFormatTooltip("Lista con viñetas")}
          variant={activeFormats.unorderedList ? "primary" : "tertiary"}
          size="s"
          onClick={() => toggleListFormat("insertUnorderedList")}
          disabled={disabled || cursorInHeading}
        />
        <IconButton
          icon="listNumbers"
          tooltip={inlineFormatTooltip("Lista numerada")}
          variant={activeFormats.orderedList ? "primary" : "tertiary"}
          size="s"
          onClick={() => toggleListFormat("insertOrderedList")}
          disabled={disabled || cursorInHeading}
        />
        <Line vert background="neutral-alpha-weak" height="20" />
        <IconButton
          icon="link"
          tooltip={inlineFormatTooltip("Insertar enlace")}
          variant="tertiary"
          size="s"
          onClick={insertLink}
          disabled={disabled || cursorInHeading}
        />
        <EmojiPickerDropdown
          onSelect={insertEmoji}
          trigger={
            <IconButton
              icon="emoji"
              tooltip="Insertar emoji"
              variant="tertiary"
              size="s"
              disabled={disabled}
            />
          }
        />
      </Row>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        tabIndex={0}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        // `className` reproduce el estilo real del párrafo publicado (ver
        // `getParagraphPreviewClassName`, fix del bug de preview de
        // Color/Familia/Peso, legacy); `style` cubre lo que esas clases NO
        // pueden expresar: alineación de bloque completo (fallback legado,
        // ver `alignCurrentParagraph`), cursiva (bloque sin control en la UI,
        // ver GOTCHA junto a `onItalicChange` — se conserva por
        // retrocompatibilidad con piezas viejas), y los 3 controles nuevos
        // Fuente/Tamaño/Color (`font`/`pt`/`hexColor`, ver
        // `resolveFontStack`/`ptToPx` — valores LIBRES sin token Once UI
        // equivalente, mismo criterio de "estilo inline solo en el
        // contentEditable, ahí no hay pipeline" del objetivo de la tarea).
        // `style` inline SIEMPRE gana sobre las clases de
        // `getParagraphPreviewClassName` (mayor especificidad), así que
        // font/pt/hexColor se ven de inmediato aunque `family`/`color`
        // legacy también estén presentes en un bloque viejo. Los headings
        // internos se sacan de los 3 vía `syncHeadingPreviewStyles` (nunca
        // los heredan en el visor tampoco).
        className={getParagraphPreviewClassName(weight, color, family)}
        style={{
          minHeight: "6rem",
          outline: "none",
          lineHeight: 1.6,
          textAlign: align,
          fontStyle: italic ? "italic" : undefined,
          fontFamily: resolveFontStack(font),
          fontSize: pt !== undefined ? `${ptToPx(pt)}px` : undefined,
          color: hexColor || undefined,
        }}
      />
    </Column>
  );
}

const CAROUSEL_ASPECT_RATIO_OPTIONS = [
  { label: "16 / 9 (panorámico)", value: "16 / 9" },
  { label: "4 / 3 (clásico)", value: "4 / 3" },
  { label: "1 / 1 (cuadrado)", value: "1 / 1" },
];

// Estilo de presentación (ver MdxCarouselVariant en mdx-carousel.tsx): es la
// decisión que manda sobre las demás, por eso va primera en la barra y como
// SegmentedControl (3 opciones, un clic) en vez de un tercer Select (dos
// clics) — mismo patrón que "Asistido/Pro" y el tipo de portada más abajo en
// CreateProjectModal.tsx. `refreshCw` (flecha circular) para "Anillo 3D": no
// hay un icono de anillo/órbita en la librería (ver src/resources/icons.ts)
// y esta es la más cercana a transmitir una rotación 3D sin añadir un icono
// nuevo (vetado).
const CAROUSEL_VARIANT_OPTIONS: {
  value: MdxCarouselVariant;
  label: string;
  prefixIcon: "carouselSlides" | "photoStack" | "refreshCw";
}[] = [
  { value: "default", label: "Clásico", prefixIcon: "carouselSlides" },
  { value: "coverflow", label: "Coverflow", prefixIcon: "photoStack" },
  { value: "ring", label: "Anillo 3D", prefixIcon: "refreshCw" },
];

const CAROUSEL_SLIDE_KIND_ICON: Record<CarouselSlide["kind"], string> = {
  image: "images",
  youtube: "link",
  file: "film",
};

const CAROUSEL_SLIDE_KIND_LABEL: Record<CarouselSlide["kind"], string> = {
  image: "Imagen",
  youtube: "YouTube",
  file: "Video",
};

interface CarouselSlideThumbnailProps {
  slide: CarouselSlide;
  index: number;
  total: number;
  disabled?: boolean;
  expanded: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onToggleExpand: () => void;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}

// Miniatura 1:1 de la cuadrícula (tarea "rediseñar la lista de slides"): un
// `<button>` NATIVO cubre toda la caja para el toggle de edición (clic o
// Enter/Space abren/cierran el panel de abajo, ver `MediaCarouselBlockEditor`
// — gratis por ser un `<button>` real, sin reinventar el manejo de teclado de
// un `Row`/`Column` con `onClick`) y los 3 controles (quitar / mover antes /
// mover después) son sus HERMANOS, no sus hijos: dos elementos interactivos
// anidados (`<button>` dentro de `<button>`) es HTML inválido y confunde a
// lectores de pantalla, así que van superpuestos por posición absoluta en el
// mismo `Column`, no dentro del botón de la imagen. Al estar más adelante en
// el DOM pintan ENCIMA en las esquinas que ocupan, así que un click ahí
// siempre aterriza en el control pequeño, nunca en el botón grande de debajo
// (hit-testing por posición, no hace falta `stopPropagation`).
//
// Arrastre nativo (HTML5 `draggable`, NUNCA framer-motion `Reorder` — ver
// CreateProjectModal.tsx líneas ~1072-1081 y el mismo patrón en el handle
// `dragHandle` de `ContentBlockCard` más abajo) vive en el `Column`
// CONTENEDOR (ancestro del botón de imagen), no en el botón: un `<button>`
// no es una fuente de arrastre nativa (a diferencia de `<img>`/`<a href>`),
// así que iniciar el gesto con el puntero sobre la imagen sigue arrastrando
// al `Column` ancestro con `draggable` — el mismo comportamiento de "icono
// de escritorio" (clic corto selecciona, clic+arrastre mueve) sin
// necesitar un handle dedicado como el del lienzo (ahí SÍ hace falta: el
// bloque completo tiene inputs/texto editable debajo del handle con los que
// un arrastre por toda la superficie competiría; aquí la miniatura no
// contiene edición inline, solo un toggle). Los `onDrag*` de este
// contenedor SIEMPRE cortan la propagación (`stopPropagation`): son un DnD
// interno a esta cuadrícula, aislado del `dragPayload`/dropzone del lienzo
// (CreateProjectModal.tsx) que escucha en los ancestros de esta tarjeta de
// bloque.
//
// Accesibilidad (restricción "c" de la tarea): el arrastre NUNCA es la única
// vía para reordenar. `onMoveLeft`/`onMoveRight` son los mismos
// `chevronLeft`/`chevronRight` de siempre (antes arriba/abajo en la lista
// vertical; ahora izquierda/derecha porque la cuadrícula ya no es una
// columna) — visibles y enfocables SIEMPRE en la propia miniatura, no solo
// dentro del panel de edición expandido, así que quien navegue por teclado
// reordena sin tocar el mouse.
function CarouselSlideThumbnail({
  slide,
  index,
  total,
  disabled,
  expanded,
  dragging,
  dropTarget,
  onToggleExpand,
  onRemove,
  onMoveLeft,
  onMoveRight,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: CarouselSlideThumbnailProps) {
  const youtubeId = slide.kind === "youtube" ? extractYouTubeId(slide.url) : null;

  return (
    <Column
      position="relative"
      radius="m"
      overflow="hidden"
      border={dropTarget ? "brand-medium" : expanded ? "brand-alpha-medium" : "neutral-alpha-weak"}
      background="neutral-alpha-weak"
      opacity={dragging ? 50 : 100}
      style={{ aspectRatio: "1 / 1" }}
      draggable={!disabled}
      onDragStart={(event) => {
        event.stopPropagation();
        onDragStart(event);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDragOver(event);
      }}
      onDragLeave={onDragLeave}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDrop(event);
      }}
      onDragEnd={(event) => {
        event.stopPropagation();
        onDragEnd();
      }}
    >
      <button
        type="button"
        onClick={onToggleExpand}
        disabled={disabled}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Cerrar edición de" : "Editar"} slide ${index + 1}, ${CAROUSEL_SLIDE_KIND_LABEL[slide.kind]}`}
        style={{
          position: "absolute",
          inset: 0,
          padding: 0,
          border: "none",
          background: "none",
          cursor: disabled ? "not-allowed" : "grab",
        }}
      >
        {slide.kind === "image" && slide.url ? (
          <Media
            src={slide.url}
            alt={slide.alt}
            fill
            objectFit="cover"
            style={{ position: "absolute", inset: 0 }}
          />
        ) : youtubeId ? (
          // <img> plano, no next/image: mismo motivo que CarouselVideoSlide
          // en mdx-carousel.tsx (evitar registrar img.youtube.com en
          // images.remotePatterns solo para esta miniatura).
          // eslint-disable-next-line @next/next/no-img-element -- miniatura estática externa, no optimizable por next/image sin registrar el host.
          // biome-ignore lint/performance/noImgElement: mismo motivo — host externo no registrado en images.remotePatterns.
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Row fill horizontal="center" vertical="center">
            <Icon
              name={CAROUSEL_SLIDE_KIND_ICON[slide.kind]}
              size="l"
              onBackground="neutral-weak"
            />
          </Row>
        )}
      </button>
      <IconButton
        icon="xCircle"
        variant="danger"
        size="s"
        tooltip="Quitar slide"
        onClick={onRemove}
        disabled={disabled}
        style={{ position: "absolute", top: "0.25rem", right: "0.25rem" }}
      />
      <Row
        position="absolute"
        horizontal="between"
        style={{ bottom: "0.25rem", left: "0.25rem", right: "0.25rem" }}
      >
        <IconButton
          icon="chevronLeft"
          variant="secondary"
          size="s"
          tooltip="Mover antes"
          onClick={onMoveLeft}
          disabled={disabled || index === 0}
        />
        <IconButton
          icon="chevronRight"
          variant="secondary"
          size="s"
          tooltip="Mover después"
          onClick={onMoveRight}
          disabled={disabled || index === total - 1}
        />
      </Row>
    </Column>
  );
}

interface CarouselAddSlideTileProps {
  disabled?: boolean;
  canAddVideo: boolean;
  onAdd: (kind: CarouselSlide["kind"]) => void;
}

// El "+" de la cuadrícula (tarea "rediseñar la lista de slides", restricción
// "e"): mismo patrón `DropdownWrapper` + `Option` que `BlockTypePicker`
// (CreateProjectModal.tsx ~línea 481) para el "+" del lienzo — incluida la
// razón por la que el dropdown-portal no cierra el modal (clase
// ".dropdown-portal" en la excepción de click-outside del `WideDialog`, ver
// comentario junto a `BlockTypePicker`). YouTube/Video (archivo) se
// deshabilitan aquí, no con un `disabled` a nivel de toda la tarjeta, para
// poder seguir agregando imágenes con coverflow/anillo (tarea "desactivar
// los vídeos en coverflow y anillo").
function CarouselAddSlideTile({ disabled, canAddVideo, onAdd }: CarouselAddSlideTileProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownWrapper
      fillWidth
      isOpen={open}
      onOpenChange={setOpen}
      placement="top-start"
      trigger={
        <button
          type="button"
          disabled={disabled}
          aria-label="Agregar slide"
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "1 / 1",
            padding: 0,
            border: "none",
            background: "none",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <Row
            fill
            radius="m"
            border="neutral-alpha-medium"
            borderStyle="dashed"
            horizontal="center"
            vertical="center"
          >
            <Icon name="plus" size="m" onBackground="neutral-weak" />
          </Row>
        </button>
      }
      dropdown={
        <Column minWidth={12} padding="4" gap="2">
          <Option
            label="Imagen"
            value="image"
            hasPrefix={<Icon name="images" size="s" onBackground="neutral-weak" />}
            onClick={() => {
              onAdd("image");
              setOpen(false);
            }}
          />
          <Option
            label="YouTube"
            value="youtube"
            disabled={!canAddVideo}
            description={canAddVideo ? undefined : "Solo en estilo Clásico"}
            hasPrefix={<Icon name="link" size="s" onBackground="neutral-weak" />}
            onClick={() => {
              if (!canAddVideo) return;
              onAdd("youtube");
              setOpen(false);
            }}
          />
          <Option
            label="Video (archivo)"
            value="file"
            disabled={!canAddVideo}
            description={canAddVideo ? undefined : "Solo en estilo Clásico"}
            hasPrefix={<Icon name="film" size="s" onBackground="neutral-weak" />}
            onClick={() => {
              if (!canAddVideo) return;
              onAdd("file");
              setOpen(false);
            }}
          />
        </Column>
      }
    />
  );
}

interface MediaCarouselBlockEditorProps {
  block: Extract<ContentBlock, { type: "mediaCarousel" }>;
  onChange: (next: ContentBlock) => void;
  disabled?: boolean;
}

// Editor del bloque "Carousel" (tarea "Carousel nativo Once UI", ver GOTCHA
// extenso junto a `CarouselSlide`/blockToMarkdown case "mediaCarousel"):
// lista reordenable de slides mixtos (imagen / YouTube / video subido) +
// controles de indicador/proporción, con una vista previa en vivo que usa
// LOS MISMOS componentes reales del visor publicado (`MdxCarousel`/
// `CarouselVideoSlide`, ver mdx-carousel.tsx) para que "lo que ves en el
// editor" sea "lo que se publica", igual criterio que carousel/masonry/
// logoCloud más abajo.
function MediaCarouselBlockEditor({ block, onChange, disabled }: MediaCarouselBlockEditorProps) {
  const updateSlides = (slides: CarouselSlide[]) => onChange({ ...block, slides });
  // Error de subida a Supabase Storage (lib/storageUpload.ts) de cualquier
  // slide de imagen — mismo criterio de un solo mensaje compartido que
  // ContentBlockCard.uploadError (ver ahí). Los slides "file" (video) usan
  // VideoFileDropzone, que ya maneja su propio error inline.
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Qué slide tiene su panel de edición (alt / link de YouTube / subida de
  // video) abierto DEBAJO de la cuadrícula — tarea "rediseñar la lista de
  // slides", restricción "b": la cuadrícula queda compacta por defecto (solo
  // miniaturas) y clic en una de ellas despliega, una a la vez, lo que la
  // miniatura sola no puede mostrar. Un solo id (no un Set) porque solo tiene
  // sentido editar un slide a la vez — abrir uno cierra cualquier otro.
  const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);
  // Arrastre interno de la cuadrícula (HTML5 nativo, ver GOTCHA junto a
  // `CarouselSlideThumbnail`): id de origen y, mientras el puntero está
  // encima, id de destino (para el borde de "vas a soltar aquí").
  const [dragSlideId, setDragSlideId] = useState<string | null>(null);
  const [dragOverSlideId, setDragOverSlideId] = useState<string | null>(null);

  const addSlide = (kind: CarouselSlide["kind"]) => {
    const slide: CarouselSlide =
      kind === "image"
        ? { id: newId(), kind: "image", url: "", alt: "" }
        : kind === "youtube"
          ? { id: newId(), kind: "youtube", url: "" }
          : { id: newId(), kind: "file", url: "" };
    updateSlides([...block.slides, slide]);
    setExpandedSlideId(slide.id);
  };

  const moveSlide = (id: string, direction: "up" | "down") => {
    const index = block.slides.findIndex((s) => s.id === id);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= block.slides.length) return;
    const next = [...block.slides];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    updateSlides(next);
  };

  const reorderSlide = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const fromIndex = block.slides.findIndex((s) => s.id === sourceId);
    const toIndex = block.slides.findIndex((s) => s.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...block.slides];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    updateSlides(next);
  };

  const removeSlide = (id: string) => {
    updateSlides(block.slides.filter((s) => s.id !== id));
    if (expandedSlideId === id) setExpandedSlideId(null);
  };

  // Mismo filtro que blockToMarkdown case "mediaCarousel": la vista previa
  // en vivo solo muestra slides ya "completos" (mismo criterio que decide
  // qué sobrevive al guardar).
  const previewSlides = block.slides.filter((s) => {
    if (s.kind === "image") return Boolean(s.url);
    if (s.kind === "youtube") return Boolean(extractYouTubeId(s.url));
    return Boolean(s.url);
  });

  const carouselVariant = block.carouselVariant ?? "default";
  // Coverflow/anillo NO distinguen una lámina "activa" de las demás (ver
  // GOTCHA junto a `CarouselVideoSlide` en mdx-carousel.tsx): TODAS las
  // tarjetas se montan a un tamaño similar —el anillo incluso monta cada
  // slide DOS veces, cara frontal e interior— así que el video no consigue
  // la miniatura estática con ícono de play que sí tiene en el clásico.
  // Tarea "desactivar los vídeos en coverflow y anillo": ambos estilos
  // pierden la opción de AGREGAR video (el "+" de la cuadrícula deshabilita
  // esas dos opciones, ver `CarouselAddSlideTile`), pero los que ya existían
  // no se destruyen al cambiar de estilo — se conservan y se avisa.
  const canAddVideo = carouselVariant === "default";
  const hasVideoSlides = block.slides.some((s) => s.kind !== "image");

  const expandedSlide = block.slides.find((s) => s.id === expandedSlideId) ?? null;
  const expandedIndex = expandedSlide
    ? block.slides.findIndex((s) => s.id === expandedSlide.id)
    : -1;

  return (
    <Column gap="16">
      <Row gap="8" wrap>
        <SegmentedControl
          selected={carouselVariant}
          onToggle={(value) =>
            onChange({ ...block, carouselVariant: value as MdxCarouselVariant })
          }
          buttons={CAROUSEL_VARIANT_OPTIONS.map((option) => ({ ...option, disabled }))}
          fillWidth={false}
        />
        <Select
          id={`block-${block.id}-aspect-ratio`}
          label="Proporción"
          options={CAROUSEL_ASPECT_RATIO_OPTIONS}
          value={block.aspectRatio}
          onSelect={(value) => onChange({ ...block, aspectRatio: value })}
          disabled={disabled}
          style={{ width: "12rem" }}
        />
      </Row>

      {uploadError && <Feedback variant="danger" description={uploadError} />}

      {!canAddVideo && hasVideoSlides && (
        <Feedback
          variant="warning"
          description="En Coverflow y Anillo no hay una lámina «activa» separada de las demás: todos los slides se montan al mismo tiempo (el Anillo incluso los duplica en su cara interior), así que un video puede verse como un reproductor real repetido en vez de una miniatura con ícono de play — y el resultado cambia según el tamaño de pantalla. No se borraron: cambia a Clásico si quieres que se vean como video."
        />
      )}

      {/* La cuadrícula SIEMPRE se dibuja, incluso sin slides: el "+" (último
          `Grid` item) es también el punto de entrada para el PRIMER slide —
          antes había que abrir uno de los 3 botones "Agregar…" para eso. */}
      <Grid columns={4} s={{ columns: 3 }} gap="8">
        {block.slides.map((slide, index) => (
          <CarouselSlideThumbnail
            key={slide.id}
            slide={slide}
            index={index}
            total={block.slides.length}
            disabled={disabled}
            expanded={expandedSlideId === slide.id}
            dragging={dragSlideId === slide.id}
            dropTarget={
              dragOverSlideId === slide.id && dragSlideId !== null && dragSlideId !== slide.id
            }
            onToggleExpand={() =>
              setExpandedSlideId((current) => (current === slide.id ? null : slide.id))
            }
            onRemove={() => removeSlide(slide.id)}
            onMoveLeft={() => moveSlide(slide.id, "up")}
            onMoveRight={() => moveSlide(slide.id, "down")}
            onDragStart={(event) => {
              setDragSlideId(slide.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", slide.id);
            }}
            onDragOver={() => {
              if (!dragSlideId) return;
              setDragOverSlideId(slide.id);
            }}
            onDragLeave={() =>
              setDragOverSlideId((current) => (current === slide.id ? null : current))
            }
            onDrop={() => {
              if (dragSlideId) reorderSlide(dragSlideId, slide.id);
              setDragSlideId(null);
              setDragOverSlideId(null);
            }}
            onDragEnd={() => {
              setDragSlideId(null);
              setDragOverSlideId(null);
            }}
          />
        ))}
        <CarouselAddSlideTile disabled={disabled} canAddVideo={canAddVideo} onAdd={addSlide} />
      </Grid>

      {expandedSlide && (
        <Column gap="12" radius="m" border="brand-alpha-medium" padding="12">
          <Row fillWidth horizontal="between" vertical="center">
            <Row gap="8" vertical="center">
              <Icon
                name={CAROUSEL_SLIDE_KIND_ICON[expandedSlide.kind]}
                size="s"
                onBackground="neutral-weak"
              />
              <Text variant="label-default-s" onBackground="neutral-weak">
                Slide {expandedIndex + 1} · {CAROUSEL_SLIDE_KIND_LABEL[expandedSlide.kind]}
              </Text>
            </Row>
            <IconButton
              icon="chevronUp"
              variant="tertiary"
              size="s"
              tooltip="Cerrar edición"
              onClick={() => setExpandedSlideId(null)}
            />
          </Row>
          {expandedSlide.kind === "image" && (
            <Column gap="12">
              <Column style={{ maxWidth: "10rem" }}>
                <MediaUpload
                  aspectRatio="1"
                  accept="image/*"
                  compress
                  resizeMaxWidth={1600}
                  resizeMaxHeight={1600}
                  initialPreviewImage={expandedSlide.url || null}
                  emptyState="Subir imagen"
                  radius="m"
                  onFileUpload={async (file) => {
                    try {
                      setUploadError(null);
                      const url = await uploadMediaFile(file);
                      updateSlides(
                        block.slides.map((s) => (s.id === expandedSlide.id ? { ...s, url } : s)),
                      );
                    } catch (err) {
                      setUploadError(
                        err instanceof Error ? err.message : "No se pudo subir la imagen.",
                      );
                    }
                  }}
                />
              </Column>
              {/* Texto alternativo: YA se serializaba en el markdown
                  (`<Media alt="...">`, ver blockToMarkdown case
                  "mediaCarousel") pero el editor de antes de este rediseño
                  nunca traía un campo para escribirlo — todo slide de imagen
                  guardaba `alt: ""`. Se agrega aquí (no existía que "perder"
                  realmente, pero la tarea es explícita: el alt no es
                  negociable por accesibilidad). */}
              <Input
                id={`block-${block.id}-${expandedSlide.id}-alt`}
                label="Texto alternativo"
                placeholder="Describe la imagen para lectores de pantalla"
                value={expandedSlide.alt}
                onChange={(e) =>
                  updateSlides(
                    block.slides.map((s) =>
                      s.id === expandedSlide.id ? { ...s, alt: e.target.value } : s,
                    ),
                  )
                }
                disabled={disabled}
              />
            </Column>
          )}
          {expandedSlide.kind === "youtube" && (
            <Input
              id={`block-${block.id}-${expandedSlide.id}-youtube`}
              label="Link de YouTube"
              placeholder="https://www.youtube.com/watch?v=…"
              value={expandedSlide.url}
              onChange={(e) =>
                updateSlides(
                  block.slides.map((s) =>
                    s.id === expandedSlide.id ? { ...s, url: e.target.value } : s,
                  ),
                )
              }
              disabled={disabled}
              error={Boolean(expandedSlide.url.trim()) && !extractYouTubeId(expandedSlide.url)}
              errorMessage={
                expandedSlide.url.trim() && !extractYouTubeId(expandedSlide.url)
                  ? "No se reconoce el link como un video de YouTube válido."
                  : undefined
              }
            />
          )}
          {expandedSlide.kind === "file" && (
            <VideoFileDropzone
              value={expandedSlide.url}
              onChange={(url) =>
                updateSlides(
                  block.slides.map((s) => (s.id === expandedSlide.id ? { ...s, url } : s)),
                )
              }
              disabled={disabled}
              aspectRatio="16 / 9"
            />
          )}
        </Column>
      )}

      {previewSlides.length > 0 && (
        <MdxCarousel
          indicator={block.indicator}
          aspectRatio={block.aspectRatio}
          variant={carouselVariant}
          controls
        >
          {previewSlides.map((slide) =>
            slide.kind === "image" ? (
              <Media key={slide.id} src={slide.url} alt={slide.alt} />
            ) : slide.kind === "youtube" ? (
              <CarouselVideoSlide
                key={slide.id}
                kind="youtube"
                youtubeId={extractYouTubeId(slide.url) ?? ""}
              />
            ) : (
              <CarouselVideoSlide key={slide.id} kind="file" src={slide.url} />
            ),
          )}
        </MdxCarousel>
      )}
    </Column>
  );
}

interface ContentBlockCardProps {
  block: ContentBlock;
  onChange: (block: ContentBlock) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  disabled?: boolean;
  // Reordenamiento por arrastre (ver CreateProjectModal): el estado de "qué
  // bloque se arrastra" y el cómputo del índice de inserción viven en el
  // padre (dueño del array de bloques); esta tarjeta solo dispara el gesto
  // desde su handle dedicado, nunca desde el cuerpo completo — así no
  // compite con los inputs/textarea/contentEditable/MediaUpload internos.
  isDragging?: boolean;
  onDragHandleStart: (event: DragEvent<HTMLButtonElement>) => void;
  onDragHandleEnd: () => void;
}

export function ContentBlockCard({
  block,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  disabled,
  isDragging,
  onDragHandleStart,
  onDragHandleEnd,
}: ContentBlockCardProps) {
  // Colapso puramente de UI: vive en este componente (keyed por block.id vía
  // el `key` que le pone el padre), nunca se escribe en `block` ni entra a
  // blocksToMarkdown/blockToMarkdown.
  const [collapsed, setCollapsed] = useState(false);

  // Error de subida a Supabase Storage (lib/storageUpload.ts), compartido
  // por TODOS los puntos de subida de esta tarjeta (imagen, tira de fotos,
  // nube de logos, cuadrícula, carousel): una tarjeta solo edita un tipo de
  // bloque a la vez, así que un mensaje único basta sin necesitar un estado
  // por tile individual. VideoFileDropzone maneja su propio error inline,
  // no pasa por aquí.
  const [uploadError, setUploadError] = useState<string | null>(null);

  // El bloque "divisor" (tarea 7, auditoría de herramientas) es el único
  // sin nada que colapsar (una sola línea, sin campos de edición): se le
  // quita el chevron de colapso y se le da un fondo de contraste
  // (`neutral-alpha-weak`, recurso nativo del sistema) para diferenciarlo
  // del resto de las tarjetas de bloque (`background="page"`).
  const isDivider = block.type === "divider";

  return (
    <Column
      fillWidth
      gap="12"
      padding="16"
      radius="m"
      border="neutral-alpha-weak"
      background={isDivider ? "neutral-alpha-weak" : "page"}
      opacity={isDragging ? 50 : 100}
    >
      <Row fillWidth horizontal="between" vertical="center">
        <Row gap="4" vertical="center">
          {!isDivider && (
            <IconButton
              icon={collapsed ? "chevronRight" : "chevronDown"}
              variant="tertiary"
              size="s"
              tooltip={collapsed ? "Expandir sección" : "Colapsar sección"}
              onClick={() => setCollapsed((current) => !current)}
              disabled={disabled}
            />
          )}
          <IconButton
            icon="dragHandle"
            variant="tertiary"
            size="s"
            tooltip="Arrastrar para reordenar"
            disabled={disabled}
            draggable={!disabled}
            onDragStart={onDragHandleStart}
            onDragEnd={onDragHandleEnd}
            style={{ cursor: disabled ? "not-allowed" : "grab" }}
          />
          <Icon name={BLOCK_ICON[block.type]} size="s" onBackground="neutral-weak" />
          <Text variant="label-strong-s" onBackground="neutral-weak">
            {BLOCK_LABEL[block.type]}
          </Text>
        </Row>
        <Row gap="4" vertical="center">
          <IconButton
            icon="chevronUp"
            variant="tertiary"
            size="s"
            tooltip="Mover arriba"
            onClick={onMoveUp}
            disabled={disabled || !canMoveUp}
          />
          <IconButton
            icon="chevronDown"
            variant="tertiary"
            size="s"
            tooltip="Mover abajo"
            onClick={onMoveDown}
            disabled={disabled || !canMoveDown}
          />
          <IconButton
            icon="trash"
            variant="tertiary"
            size="s"
            tooltip="Quitar sección"
            onClick={onRemove}
            disabled={disabled}
          />
        </Row>
      </Row>

      {uploadError && <Feedback variant="danger" description={uploadError} />}

      {!collapsed && block.type === "text" && (
        <RichTextEditor
          html={block.html}
          align={block.align ?? "left"}
          weight={block.weight ?? "default"}
          italic={block.italic ?? false}
          color={block.color ?? "default"}
          family={block.family ?? "default"}
          font={block.font}
          pt={block.pt}
          hexColor={block.hexColor}
          onChange={(next) => onChange({ ...block, html: next })}
          onAlignChange={(align) => onChange({ ...block, align })}
          onItalicChange={(italic) => onChange({ ...block, italic })}
          onFontChange={(font) => onChange({ ...block, font })}
          onPtChange={(pt) => onChange({ ...block, pt })}
          onHexColorChange={(hexColor) => onChange({ ...block, hexColor })}
          disabled={disabled}
        />
      )}

      {!collapsed && block.type === "image" && (
        // El input de "Texto alternativo" se retiró del editor (tarea 3,
        // auditoría de herramientas): no se visualiza en el render final
        // (createImage en mdx.tsx pasa `alt` al <Media>, pero Once UI no lo
        // muestra en pantalla — solo lo usa el navegador/lectores de
        // pantalla). `block.alt` sigue existiendo en el tipo/estado y
        // blockToMarkdown lo sigue serializando tal cual (ver case "image"),
        // así que una pieza vieja con alt ya escrito no lo pierde; los
        // bloques nuevos simplemente serializan con "" (default de
        // `createBlock`).
        <Column gap="8">
          <MediaUpload
            aspectRatio="16 / 9"
            accept="image/*"
            compress
            resizeMaxWidth={1600}
            resizeMaxHeight={1600}
            initialPreviewImage={block.url || null}
            emptyState="Subir imagen"
            onFileUpload={async (file) => {
              try {
                setUploadError(null);
                onChange({ ...block, url: await uploadMediaFile(file) });
              } catch (err) {
                setUploadError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
              }
            }}
          />
        </Column>
      )}

      {!collapsed && block.type === "carousel" && (
        // Rediseño compacto (tarea 5, auditoría de herramientas): el
        // `Carousel` de preview a tamaño completo (con un slide-tile
        // gigante de `MediaUpload` al final, no interactivo hasta hacer
        // click dentro del carrusel) se sustituye por el MISMO patrón ya
        // funcional de logoCloud/masonry — fila de tiles pequeños (72px,
        // `width`/`height` numéricos = rem reales, ver `parseDimension` en
        // el harness: 4.5 → "4.5rem" = 72px) con `MediaUpload` real
        // (mecanismo de subida ya probado) + botón de basura por imagen, y
        // un tile "+" al final. El render del visor (Scroller de `Media`,
        // ver blockToMarkdown case "carousel") no cambia.
        <Row gap="8" wrap>
          {block.images.map((image) => (
            <Column key={image.id} gap="4" width={4.5}>
              <MediaUpload
                aspectRatio="1"
                accept="image/*"
                compress
                resizeMaxWidth={1600}
                resizeMaxHeight={1600}
                initialPreviewImage={image.url || null}
                emptyState=""
                radius="m"
                onFileUpload={async (file) => {
                  try {
                    setUploadError(null);
                    const url = await uploadMediaFile(file);
                    onChange({
                      ...block,
                      images: block.images.map((i) => (i.id === image.id ? { ...i, url } : i)),
                    });
                  } catch (err) {
                    setUploadError(
                      err instanceof Error ? err.message : "No se pudo subir la imagen.",
                    );
                  }
                }}
              />
              <IconButton
                icon="trash"
                variant="tertiary"
                size="s"
                tooltip="Quitar imagen"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...block, images: block.images.filter((i) => i.id !== image.id) })
                }
              />
            </Column>
          ))}
          {/* Ver GOTCHA junto al tile "Agregar" de avatarGroup/logoCloud/
              masonry: `key` atado a la longitud del array fuerza un remount
              limpio del MediaUpload en cada add/remove (evita el bug de
              reconciliación de React por posición). */}
          <Column key={`add-${block.images.length}`} width={4.5}>
            <MediaUpload
              aspectRatio="1"
              accept="image/*"
              compress
              resizeMaxWidth={1600}
              resizeMaxHeight={1600}
              emptyState="Agregar"
              radius="m"
              onFileUpload={async (file) => {
                try {
                  setUploadError(null);
                  const url = await uploadMediaFile(file);
                  onChange({
                    ...block,
                    images: [...block.images, { id: newId(), url, alt: "" }],
                  });
                } catch (err) {
                  setUploadError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
                }
              }}
            />
          </Column>
        </Row>
      )}

      {!collapsed && block.type === "embed" && (
        <Column gap="8">
          <Select
            id={`block-${block.id}-language`}
            label="Lenguaje"
            options={CODE_LANGUAGE_OPTIONS}
            value={block.language}
            onSelect={(value) => onChange({ ...block, language: value })}
            disabled={disabled}
            style={{ width: "12rem" }}
          />
          <Textarea
            id={`block-${block.id}-code`}
            label="Código"
            variant="ghost"
            lines="auto"
            resize="none"
            style={{ fontFamily: "var(--font-code)" }}
            value={block.code}
            onChange={(e) => onChange({ ...block, code: e.target.value })}
            disabled={disabled}
          />
        </Column>
      )}

      {!collapsed && block.type === "link" && (
        <Column gap="8">
          <Input
            id={`block-${block.id}-label`}
            label="Texto del enlace"
            value={block.label}
            onChange={(e) => onChange({ ...block, label: e.target.value })}
            disabled={disabled}
          />
          <Input
            id={`block-${block.id}-url`}
            label="URL"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            disabled={disabled}
          />
        </Column>
      )}

      {!collapsed && block.type === "video" && (
        // FEATURE (tarea "video por archivo"): dos modos, mismo criterio de
        // SegmentedControl que la portada (ver CreateProjectModal). `source`
        // por defecto "url" (retrocompatible: bloques guardados antes de
        // esta tarea no tienen el campo, ver createBlock/tipo ContentBlock)
        // — el operador `??` cubre ese caso sin migrar Markdown viejo.
        <Column gap="12">
          <SegmentedControl
            fillWidth
            selected={block.source ?? "url"}
            onToggle={(value) => onChange({ ...block, source: value as "url" | "file" })}
            buttons={[
              { value: "url", label: "YouTube", prefixIcon: "link", disabled },
              { value: "file", label: "Subir archivo", prefixIcon: "film", disabled },
            ]}
          />
          {(block.source ?? "url") === "file" ? (
            <VideoFileDropzone
              value={block.fileUrl ?? ""}
              onChange={(fileUrl) => onChange({ ...block, fileUrl })}
              disabled={disabled}
              aspectRatio="16 / 9"
            />
          ) : (
            <Column gap="8">
              <Input
                id={`block-${block.id}-url`}
                label="Link de YouTube"
                placeholder="https://www.youtube.com/watch?v=…"
                value={block.url}
                onChange={(e) => onChange({ ...block, url: e.target.value })}
                disabled={disabled}
              />
              {(() => {
                const youtubeId = extractYouTubeId(block.url);
                if (youtubeId) {
                  return (
                    <Column fillWidth radius="m" overflow="hidden" style={{ aspectRatio: "16 / 9" }}>
                      <iframe
                        width="100%"
                        height="100%"
                        src={`https://www.youtube.com/embed/${youtubeId}`}
                        title="Video de YouTube"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ border: 0 }}
                      />
                    </Column>
                  );
                }
                if (block.url.trim() !== "") {
                  return (
                    <Feedback
                      variant="danger"
                      description="No se reconoce el link como un video de YouTube válido."
                    />
                  );
                }
                return null;
              })()}
            </Column>
          )}
        </Column>
      )}

      {!collapsed && block.type === "mediaCarousel" && (
        <MediaCarouselBlockEditor block={block} onChange={onChange} disabled={disabled} />
      )}

      {!collapsed && block.type === "divider" && (
        <Row fillWidth vertical="center">
          <Line background="neutral-alpha-medium" fillWidth />
        </Row>
      )}

      {!collapsed && block.type === "section" && (
        // Único campo editable del bloque (ver comentario junto al type
        // "section"): un Input de una sola línea, mismo patrón que
        // "Texto del enlace"/"URL" del bloque "link" — sin RichTextEditor ni
        // formato: el título sale plano por su ruta ATX (`## título`).
        <Input
          id={`block-${block.id}-title`}
          placeholder="Título de la sección"
          value={block.title}
          onChange={(e) => onChange({ ...block, title: e.target.value })}
          disabled={disabled}
        />
      )}

      {!collapsed && block.type === "tag" && (
        <Column gap="12">
          <Row gap="8" wrap>
            <Select
              id={`block-${block.id}-variant`}
              label="Variante"
              options={TAG_VARIANT_OPTIONS}
              value={block.variant}
              onSelect={(value) => onChange({ ...block, variant: value as TagVariant })}
              disabled={disabled}
              style={{ width: "10rem" }}
            />
            <Select
              id={`block-${block.id}-size`}
              label="Tamaño"
              options={TAG_SIZE_OPTIONS}
              value={block.size}
              onSelect={(value) => onChange({ ...block, size: value as TagSize })}
              disabled={disabled}
              style={{ width: "8rem" }}
            />
          </Row>
          <Input
            id={`block-${block.id}-label`}
            label="Texto"
            value={block.label}
            onChange={(e) => onChange({ ...block, label: e.target.value })}
            disabled={disabled}
          />
          {block.label.trim() !== "" && (
            <Row>
              <Tag variant={block.variant} size={block.size} label={block.label} />
            </Row>
          )}
        </Column>
      )}

      {!collapsed && block.type === "categoryTags" && (
        <Column gap="16">
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Selecciona las categorías del proyecto. Se guardan como etiquetas estáticas en la pieza
            publicada.
          </Text>
          {PROJECT_VERTICALS.map((vertical) => (
            <Column key={vertical} gap="8">
              <Text variant="label-strong-s" onBackground="neutral-weak">
                {vertical}
              </Text>
              <Row gap="8" wrap>
                {PROJECT_SUBCATEGORIES[vertical].map((subcategory) => {
                  const isSelected = block.selected.includes(subcategory);
                  return (
                    <Chip
                      key={subcategory}
                      label={subcategory}
                      selected={isSelected}
                      // `Chip` (ver ai/components/Chip.json) no expone un prop
                      // `disabled` propio: se emula quitando el handler.
                      onClick={
                        disabled
                          ? undefined
                          : () =>
                              onChange({
                                ...block,
                                selected: isSelected
                                  ? block.selected.filter((s) => s !== subcategory)
                                  : [...block.selected, subcategory],
                              })
                      }
                    />
                  );
                })}
              </Row>
            </Column>
          ))}
          {block.selected.length > 0 && (
            <Row gap="8" wrap>
              {block.selected.map((label) => (
                <Tag key={label} variant="brand" size="m" label={label} />
              ))}
            </Row>
          )}
        </Column>
      )}

      {!collapsed && block.type === "badge" && (
        <Column gap="8">
          <Input
            id={`block-${block.id}-title`}
            label="Título"
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            disabled={disabled}
          />
          <Input
            id={`block-${block.id}-href`}
            label="Link (opcional)"
            value={block.href}
            onChange={(e) => onChange({ ...block, href: e.target.value })}
            disabled={disabled}
          />
          {block.title.trim() !== "" && (
            <Row>
              <Badge title={block.title} href={block.href.trim() || undefined} />
            </Row>
          )}
        </Column>
      )}

      {!collapsed && block.type === "status" && (
        <Column gap="8">
          <Select
            id={`block-${block.id}-color`}
            label="Color"
            options={STATUS_COLOR_OPTIONS}
            value={block.color}
            onSelect={(value) => onChange({ ...block, color: value as StatusColor })}
            disabled={disabled}
            style={{ width: "10rem" }}
          />
          <Input
            id={`block-${block.id}-text`}
            label="Texto"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            disabled={disabled}
          />
          {block.text.trim() !== "" && (
            <Row gap="8" vertical="center">
              <StatusIndicator color={block.color} />
              <Text variant="body-default-m" onBackground="neutral-medium">
                {block.text}
              </Text>
            </Row>
          )}
        </Column>
      )}

      {!collapsed && block.type === "progress" && (
        <Column gap="12">
          <Row gap="8" wrap>
            <Input
              id={`block-${block.id}-value`}
              label="Valor"
              type="number"
              value={String(block.value)}
              onChange={(e) => onChange({ ...block, value: Number(e.target.value) || 0 })}
              disabled={disabled}
            />
            <Input
              id={`block-${block.id}-min`}
              label="Mínimo"
              type="number"
              value={String(block.min)}
              onChange={(e) => onChange({ ...block, min: Number(e.target.value) || 0 })}
              disabled={disabled}
            />
            <Input
              id={`block-${block.id}-max`}
              label="Máximo"
              type="number"
              value={String(block.max)}
              onChange={(e) => onChange({ ...block, max: Number(e.target.value) || 0 })}
              disabled={disabled}
            />
          </Row>
          <Row gap="8" vertical="center">
            <Switch
              isChecked={block.showLabel}
              onToggle={() => onChange({ ...block, showLabel: !block.showLabel })}
              ariaLabel="Mostrar etiqueta de porcentaje"
              disabled={disabled}
            />
            <Text variant="body-default-s" onBackground="neutral-weak">
              Mostrar etiqueta
            </Text>
          </Row>
          <ProgressBar
            value={block.value}
            min={block.min}
            max={block.max}
            label={block.showLabel}
          />
        </Column>
      )}

      {!collapsed && block.type === "avatarGroup" && (
        <Column gap="12">
          {block.avatars.length > 0 && (
            <Row gap="8" wrap>
              {block.avatars.map((avatar) => (
                <Row
                  key={avatar.id}
                  gap="8"
                  vertical="center"
                  radius="full"
                  border="neutral-alpha-weak"
                  paddingLeft="8"
                  paddingRight="4"
                  paddingY="4"
                  background="surface"
                >
                  {avatar.url ? (
                    <Avatar src={avatar.url} size="xs" />
                  ) : (
                    <Avatar value={avatar.initials || "?"} size="xs" />
                  )}
                  <Text variant="label-default-s" onBackground="neutral-strong">
                    {avatar.name || avatar.username || avatar.initials || "Freelancer"}
                  </Text>
                  <IconButton
                    icon="close"
                    variant="tertiary"
                    size="s"
                    tooltip="Quitar colaborador"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...block,
                        avatars: block.avatars.filter((a) => a.id !== avatar.id),
                      })
                    }
                  />
                </Row>
              ))}
            </Row>
          )}
          {block.avatars.length < MAX_COLLABORATORS ? (
            <CollaboratorSearch
              disabled={disabled}
              excludeIds={block.avatars.map((a) => a.id)}
              onAdd={(freelancer) =>
                onChange({ ...block, avatars: [...block.avatars, freelancerToAvatar(freelancer)] })
              }
            />
          ) : (
            <Text variant="body-default-xs" onBackground="neutral-weak">
              Máximo {MAX_COLLABORATORS} colaboradores por sección.
            </Text>
          )}
          {block.avatars.filter((a) => a.url || a.initials).length > 0 && (
            <AvatarGroup
              size="m"
              avatars={block.avatars
                .filter((a) => a.url || a.initials)
                .map((a) => (a.url ? { src: a.url } : { value: a.initials }))}
            />
          )}
        </Column>
      )}

      {!collapsed && block.type === "logoCloud" && (
        <Column gap="12">
          <Input
            id={`block-${block.id}-columns`}
            label="Columnas"
            type="number"
            value={String(block.columns)}
            onChange={(e) => onChange({ ...block, columns: Number(e.target.value) || 1 })}
            disabled={disabled}
          />
          <Row gap="12" wrap>
            {block.logos.map((logo) => (
              <Column key={logo.id} gap="8" style={{ width: "8rem" }}>
                <MediaUpload
                  aspectRatio="1"
                  accept="image/*"
                  compress
                  resizeMaxWidth={800}
                  resizeMaxHeight={800}
                  initialPreviewImage={logo.url || null}
                  emptyState="Logo"
                  onFileUpload={async (file) => {
                    try {
                      setUploadError(null);
                      const url = await uploadMediaFile(file);
                      onChange({
                        ...block,
                        logos: block.logos.map((l) => (l.id === logo.id ? { ...l, url } : l)),
                      });
                    } catch (err) {
                      setUploadError(
                        err instanceof Error ? err.message : "No se pudo subir el logo.",
                      );
                    }
                  }}
                />
                <IconButton
                  icon="trash"
                  variant="tertiary"
                  size="s"
                  tooltip="Quitar logo"
                  disabled={disabled}
                  onClick={() =>
                    onChange({ ...block, logos: block.logos.filter((l) => l.id !== logo.id) })
                  }
                />
              </Column>
            ))}
            {/* Ver GOTCHA junto al tile "Agregar" de avatarGroup: mismo bug de
                reconciliación de React (tile sin `key` reutilizado por
                posición al crecer el array), causa raíz confirmada del "logo
                duplicado" reportado. `key` atado a la longitud del array
                fuerza un remount limpio del MediaUpload en cada add/remove. */}
            <Column key={`add-${block.logos.length}`} gap="8" style={{ width: "8rem" }}>
              <MediaUpload
                aspectRatio="1"
                accept="image/*"
                compress
                resizeMaxWidth={800}
                resizeMaxHeight={800}
                emptyState="Agregar"
                onFileUpload={async (file) => {
                  try {
                    setUploadError(null);
                    const url = await uploadMediaFile(file);
                    onChange({ ...block, logos: [...block.logos, { id: newId(), url }] });
                  } catch (err) {
                    setUploadError(err instanceof Error ? err.message : "No se pudo subir el logo.");
                  }
                }}
              />
            </Column>
          </Row>
          {block.logos.filter((l) => l.url).length > 0 && (
            <LogoCloud
              columns={toGridSize(block.columns)}
              logos={block.logos.filter((l) => l.url).map((l) => ({ icon: l.url }))}
            />
          )}
        </Column>
      )}

      {!collapsed && block.type === "scroller" && (
        <Column gap="12">
          <Column gap="8">
            {block.items.map((item, index) => (
              <Row key={item.id} gap="8" vertical="center">
                <Input
                  id={`block-${block.id}-${item.id}-text`}
                  placeholder={`Elemento ${index + 1}`}
                  value={item.text}
                  onChange={(e) =>
                    onChange({
                      ...block,
                      items: block.items.map((i) =>
                        i.id === item.id ? { ...i, text: e.target.value } : i,
                      ),
                    })
                  }
                  disabled={disabled}
                />
                <IconButton
                  icon="trash"
                  variant="tertiary"
                  size="s"
                  tooltip="Quitar elemento"
                  disabled={disabled}
                  onClick={() =>
                    onChange({ ...block, items: block.items.filter((i) => i.id !== item.id) })
                  }
                />
              </Row>
            ))}
            <Row>
              <IconButton
                icon="plus"
                variant="secondary"
                size="s"
                tooltip="Agregar elemento"
                disabled={disabled}
                onClick={() =>
                  onChange({ ...block, items: [...block.items, { id: newId(), text: "" }] })
                }
              />
            </Row>
          </Column>
          {block.items.filter((i) => i.text.trim()).length > 0 && (
            <Scroller direction="row" fadeColor="page">
              {block.items
                .filter((i) => i.text.trim())
                .map((i) => (
                  <Tag key={i.id} variant="neutral" label={i.text} />
                ))}
            </Scroller>
          )}
        </Column>
      )}

      {!collapsed && block.type === "masonry" && (
        <Column gap="12">
          <Input
            id={`block-${block.id}-columns`}
            label="Columnas"
            type="number"
            value={String(block.columns)}
            onChange={(e) => onChange({ ...block, columns: Number(e.target.value) || 1 })}
            disabled={disabled}
          />
          {/* Solo miniaturas (tarea 6, auditoría de herramientas): mismo
              patrón compacto del carrusel (ver bloque "carousel" arriba) —
              tiles de 96px (`width`/`height` numéricos = rem reales, 6 →
              "6rem" = 96px) en vez de las previews grandes de antes; sin
              input de alt suelto por imagen, mismo criterio que el
              carrusel. El render del visor (`MasonryGrid` real, ver
              blockToMarkdown case "masonry") no cambia. */}
          <Row gap="8" wrap>
            {block.images.map((image) => (
              <Column key={image.id} gap="4" width={6}>
                <MediaUpload
                  aspectRatio="1"
                  accept="image/*"
                  compress
                  resizeMaxWidth={1600}
                  resizeMaxHeight={1600}
                  initialPreviewImage={image.url || null}
                  emptyState="Foto"
                  radius="m"
                  onFileUpload={async (file) => {
                    try {
                      setUploadError(null);
                      const url = await uploadMediaFile(file);
                      onChange({
                        ...block,
                        images: block.images.map((i) => (i.id === image.id ? { ...i, url } : i)),
                      });
                    } catch (err) {
                      setUploadError(
                        err instanceof Error ? err.message : "No se pudo subir la imagen.",
                      );
                    }
                  }}
                />
                <IconButton
                  icon="trash"
                  variant="tertiary"
                  size="s"
                  tooltip="Quitar imagen"
                  disabled={disabled}
                  onClick={() =>
                    onChange({
                      ...block,
                      images: block.images.filter((i) => i.id !== image.id),
                    })
                  }
                />
              </Column>
            ))}
            {/* Ver GOTCHA junto al tile "Agregar" de avatarGroup: mismo bug de
                reconciliación de React, causa raíz confirmada del "logo
                duplicado" reportado. `key` atado a la longitud del array
                fuerza un remount limpio del MediaUpload en cada add/remove. */}
            <Column key={`add-${block.images.length}`} width={6}>
              <MediaUpload
                aspectRatio="1"
                accept="image/*"
                compress
                resizeMaxWidth={1600}
                resizeMaxHeight={1600}
                emptyState="Agregar"
                radius="m"
                onFileUpload={async (file) => {
                  try {
                    setUploadError(null);
                    const url = await uploadMediaFile(file);
                    onChange({
                      ...block,
                      images: [...block.images, { id: newId(), url, alt: "" }],
                    });
                  } catch (err) {
                    setUploadError(
                      err instanceof Error ? err.message : "No se pudo subir la imagen.",
                    );
                  }
                }}
              />
            </Column>
          </Row>
          {block.images.filter((i) => i.url).length > 0 && (
            <MasonryGrid columns={block.columns}>
              {block.images
                .filter((i) => i.url)
                .map((i) => (
                  <Media key={i.id} src={i.url} alt={i.alt} radius="m" />
                ))}
            </MasonryGrid>
          )}
        </Column>
      )}
    </Column>
  );
}
