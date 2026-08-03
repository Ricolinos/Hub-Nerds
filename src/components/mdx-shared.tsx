// Módulo CLIENT-SAFE compartido entre el visor público (mdx.tsx, RSC vía
// next-mdx-remote/rsc) y la previsualización flotante del editor
// (PreviewOverlay.tsx, cliente vía next-mdx-remote/serialize + <MDXRemote>).
// Contiene los MISMOS sanitizadores y el MISMO mapa de `components` que
// mdx.tsx usaba antes de esta tarea (tarea "rendimiento del editor +
// previsualizar") — CERO cambio de comportamiento para el visor público, que
// sigue importándolos desde aquí. La única razón del split es que este
// archivo NO puede importar `next-mdx-remote/rsc` (Server Component-only):
// si lo hiciera, cualquier módulo cliente que lo importe (el overlay) fallaría
// al build.
import React, { ReactNode } from "react";
import { slugify as transliterate } from "transliteration";

import type { PieceAttachment } from "@/app/actions/portfolioPieces";
import { ptToPx, resolveFontStack } from "@/lib/fontLibrary";
// Bloque "Carousel" del editor (ver ContentBlocks.tsx, type "mediaCarousel"):
// wrapper sobre el `Carousel` nativo de Once UI — ver comentarios extensos
// en mdx-carousel.tsx (incluye el fix de miniatura estática para slides de
// video, que evita el iframe/video "vivo" duplicado en el Scroller de
// thumbnails).
import { CarouselVideoSlide, MdxCarousel } from "@/components/mdx-carousel";
import { Collaborators, CollaboratorPerson } from "@/components/mdx-collaborators";

import {
  Heading,
  HeadingLink,
  Text,
  InlineCode,
  CodeBlock,
  TextProps,
  MediaProps,
  Accordion,
  AccordionGroup,
  Table,
  Feedback,
  Button,
  Card,
  Grid,
  Row,
  Column,
  Icon,
  Media,
  SmartLink,
  List,
  ListItem,
  Line,
  Carousel,
  Avatar,
  Tag,
  Badge,
  StatusIndicator,
  ProgressBar,
  Scroller,
  MasonryGrid,
} from "@once-ui-system/core";
// El CompareImage de Once UI no se registra: en next-mdx-remote/rsc no
// muestra ninguna de las dos imágenes sin importar la forma de
// leftContent/rightContent (verificado en pantalla), aunque en TSX puro
// (fuera de MDX) sí funciona. El editor serializa el bloque "compare" como
// un side-by-side con Media (ver ContentBlocks.tsx) — pero antes de ese
// ajuste algunas piezas ya publicadas quedaron con <CompareImage
// leftContent=... rightContent=...> literal en su Markdown guardado en BD.
// Este shim registra ese nombre con un side-by-side equivalente que acepta
// las formas de leftContent/rightContent que se llegaron a probar (string,
// objeto {src,alt}, o un elemento <Media/> como expresión), para que ese
// contenido legado siga renderizando en vez de tronar.
type LegacyCompareSide = string | { src?: string | ReactNode; alt?: string } | ReactNode;

function resolveLegacyCompareSide(
  content: LegacyCompareSide,
): { src: string; alt?: string } | null {
  if (!content) return null;
  if (typeof content === "string") return { src: content };
  if (React.isValidElement(content)) {
    const props = content.props as { src?: string; alt?: string };
    return props.src ? { src: props.src, alt: props.alt } : null;
  }
  if (typeof content === "object" && "src" in content) {
    const { src, alt } = content as { src?: string | ReactNode; alt?: string };
    if (typeof src === "string") return { src, alt };
    if (React.isValidElement(src)) {
      const nested = src.props as { src?: string; alt?: string };
      return nested.src ? { src: nested.src, alt: alt ?? nested.alt } : null;
    }
  }
  return null;
}

function LegacyCompareImage({
  leftContent,
  rightContent,
}: {
  leftContent?: LegacyCompareSide;
  rightContent?: LegacyCompareSide;
  aspectRatio?: string;
}) {
  const left = resolveLegacyCompareSide(leftContent);
  const right = resolveLegacyCompareSide(rightContent);
  if (!left && !right) return null;

  return (
    <Row gap="16" fillWidth marginTop="8" marginBottom="16">
      {left && (
        <Column flex={1} gap="8">
          <Text variant="label-strong-s" onBackground="neutral-weak">
            Antes
          </Text>
          <Media src={left.src} alt={left.alt ?? "Antes"} aspectRatio="4 / 3" radius="m" />
        </Column>
      )}
      {right && (
        <Column flex={1} gap="8">
          <Text variant="label-strong-s" onBackground="neutral-weak">
            Después
          </Text>
          <Media src={right.src} alt={right.alt ?? "Después"} aspectRatio="4 / 3" radius="m" />
        </Column>
      )}
    </Row>
  );
}

// GOTCHA (descubierto al auditar bloques logoCloud/masonry en piezas
// publicadas): `Media` (Once UI, ver dist/components/Media.js) solo aplica
// un `width`/`height` propio cuando el valor coincide EXACTO con uno de sus
// tokens ("0","1","2","4","8","12","16","20","24","32","40","48","56","64",
// "80","104","128","160", o un sufijo %/vh/dvh/vw/calc(), ver parseDimension
// en dist/components/ServerFlex.js). Cualquier otro string —incluido un
// número "libre" como "6"— se descarta en silencio (undefined), y como
// `Media` fuerza `fillWidth: true` en su Column interno SIN EXCEPCIÓN, la
// imagen termina ocupando el 100% del contenedor padre en vez del tamaño
// pedido: eso es lo que verificado en pantalla infla los logos de
// `logoCloud` (y cualquier `masonry`/`carousel` con medidas fuera de esa
// lista) a tiles gigantes apilados. Además, si `aspectRatio` se queda en su
// default `"original"`, `Media` IGNORA el prop `height` sin importar su
// valor (ver el ternario de `height` en Media.js). Este wrapper, registrado
// como `Media` en el mapa de components de MDX, corrige ambos huecos sin
// tocar el paquete: convierte cualquier string numérico "libre" en un
// `number` real (que si acepta Once UI, vía `${value}rem` en
// parseDimension), y si eso deja un `height` numérico sin `aspectRatio`
// explícito, deriva un `aspectRatio` real (ej. "6 / 4") a partir de esos
// mismos width/height para activar la ruta de `Media` que sí respeta una
// caja de tamaño fijo, en vez de la ruta "original" que la ignora.
//
// Se descartó a propósito usar `aspectRatio=""` + forzar `fill` (el prop
// booleano de `Media` que activa el fill-mode de `next/image`): verificado
// en pantalla que ese combo rompe el sizing por completo. `Media.js`
// construye el `style` del `<Image>` interno con `width: aspectRatio ?
// "100%" : undefined` — con `aspectRatio=""` (falsy) da `width: undefined`
// explícito—, y Next (`get-img-props.js`) arma el style final con
// `Object.assign({position:absolute,width:'100%',height:'100%',...}, ...,
// style)`: un `width`/`height` EXPLÍCITAMENTE `undefined` en ese último
// objeto SOBRESCRIBE el `width:'100%'`/`height:'100%'` que Next necesita
// para el fill-mode (Object.assign copia la clave aunque su valor sea
// undefined), dejando el `<img>` sin ancho ni alto en absoluto. La ruta de
// aspectRatio real (no vacío) evita ese bug: dispara el fill=false normal
// de `Media` (mismo camino que ya usan carousel/video), donde el `<img>`
// recibe `width:100%;height:100%;aspect-ratio:<real>` vía `style` y esos
// porcentajes SÍ resuelven bien porque el Column contenedor ya tiene un
// ancho definido (el `width` de abajo) y una altura definida por su propio
// `aspect-ratio` CSS.
//
// Aplica tanto a contenido nuevo como al Markdown ya guardado en BD (ej.
// `logoCloud`/`masonry` viejos con `width="6" height="4"` o sin ninguna
// medida), sin requerir volver a guardar la pieza.
const VALID_MEDIA_SIZE_TOKENS = new Set([
  "0",
  "1",
  "2",
  "4",
  "8",
  "12",
  "16",
  "20",
  "24",
  "32",
  "40",
  "48",
  "56",
  "64",
  "80",
  "104",
  "128",
  "160",
]);
const VALID_MEDIA_RESPONSIVE_TOKENS = new Set(["xs", "s", "m", "l", "xl"]);

function isRecognizedSizeToken(value: string): boolean {
  if (
    value.endsWith("%") ||
    value.endsWith("vh") ||
    value.endsWith("dvh") ||
    value.endsWith("vw") ||
    value.startsWith("calc(")
  ) {
    return true;
  }
  return VALID_MEDIA_SIZE_TOKENS.has(value) || VALID_MEDIA_RESPONSIVE_TOKENS.has(value);
}

// `width` sí acepta tokens/CSSUnit como string (ver MediaProps, heredado de
// Flex); solo se corrige si el valor NO es un token reconocido. `height` en
// cambio SOLO acepta `number` en el tipo real de Media (MediaProps.height),
// así que cualquier string —reconocido o no— se convierte a rem numérico:
// no existe una variante "token" de `height` en este componente.
function resolveMediaWidth(
  value: string | number | undefined,
): React.ComponentProps<typeof Media>["width"] {
  if (value === undefined || typeof value === "number") return value;
  if (isRecognizedSizeToken(value)) return value as React.ComponentProps<typeof Media>["width"];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

// `height` en el tipo real de Media (MediaProps.height) SOLO acepta
// `number`, así que cualquier string se convierte a rem numérico igual que
// `width` cuando no es un token reconocido.
function resolveMediaHeight(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return value;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

// Para derivar un aspectRatio real hace falta el valor NUMÉRICO puro de
// width/height (independiente de si `width` terminó siendo un token/CSSUnit
// para el prop final): un string como "6" pasa, un token como "24%" o
// "calc(...)" no tiene un numero de "unidades" comparable y se ignora.
function toPlainNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

interface MediaMdxProps extends Omit<React.ComponentProps<typeof Media>, "width" | "height"> {
  width?: string | number;
  height?: string | number;
}

// FEATURE (Modo Pro, adjuntos con nombre): un `src` que NO sea una URL real
// (http/https/data:) se interpreta como el NOMBRE de un adjunto de la pieza
// (ver PortfolioPiece.attachments/PieceAttachment) — el modo Pro sube sus
// archivos aparte (panel "Adjuntar archivos") y el Markdown/MDX los
// referencia por nombre en vez de pegar la URL cruda de Storage (evita
// exponerla y sobrevive a un re-upload/renombrado del archivo). Búsqueda
// case-insensitive, igual que la unicidad que valida el server
// (normalizeAttachments en actions/portfolioPieces.ts). `Media` (Once UI)
// ya autodetecta video vs imagen por la extensión real de la URL resuelta
// (ver dist/components/Media.js, isVideoUrl) — no hace falta un componente
// `Video` aparte ni distinguir `type` aquí, `<Media src="nombre" />` sirve
// para ambos casos.
function isExternalMediaSrc(src: string): boolean {
  return /^(https?:)?\/\//i.test(src) || src.startsWith("data:");
}

function resolveAttachmentSrc(
  src: string | undefined,
  attachments: PieceAttachment[],
): { resolvedSrc: string | undefined; notFoundName?: string } {
  if (!src) return { resolvedSrc: src };
  if (isExternalMediaSrc(src)) return { resolvedSrc: src };
  const key = src.trim().toLowerCase();
  const found = attachments.find((attachment) => attachment.name.toLowerCase() === key);
  if (found) return { resolvedSrc: found.url };
  return { resolvedSrc: undefined, notFoundName: src };
}

// Placeholder sobrio (no rompe la página, ver CustomMDX/compileMDX try-catch
// en mdx.tsx) cuando el Markdown referencia por nombre un adjunto que ya no
// existe (renombrado o eliminado desde el panel sin actualizar el texto).
function AttachmentNotFound({ name }: { name: string }) {
  return (
    <Feedback
      variant="warning"
      marginTop="8"
      marginBottom="16"
      title="Archivo no encontrado"
      description={`No se encontró un adjunto llamado "${name}" en este proyecto.`}
    />
  );
}

function createMediaElement(
  { width, height, aspectRatio, objectFit, src, ...rest }: MediaMdxProps,
  attachments: PieceAttachment[],
) {
  const resolvedWidth = resolveMediaWidth(width);
  const resolvedHeight = resolveMediaHeight(height);

  let resolvedAspectRatio = aspectRatio;
  let derivedFixedTile = false;
  if (resolvedAspectRatio === undefined) {
    const widthNumber = toPlainNumber(width);
    const heightNumber = toPlainNumber(height);
    if (widthNumber && heightNumber) {
      resolvedAspectRatio = `${widthNumber} / ${heightNumber}`;
      derivedFixedTile = true;
    }
  }
  // Un tile de tamaño fijo derivado aquí (ej. logos de `logoCloud`, sin
  // `aspectRatio` propio) es casi siempre un logo/ícono: verificado en
  // pantalla que el `objectFit` default de Media ("cover") recorta logos
  // con proporciones distintas al tile (ej. uno ancho, uno cuadrado, uno
  // alto) en vez de encogerlos completos. Se prefiere "contain" en ese
  // caso —logo entero visible, con márgenes si no coincide la proporción—
  // salvo que el propio Markdown ya pida un `objectFit` explícito.
  const resolvedObjectFit = objectFit ?? (derivedFixedTile ? "contain" : undefined);

  const { resolvedSrc, notFoundName } = resolveAttachmentSrc(src, attachments);
  if (notFoundName) return <AttachmentNotFound name={notFoundName} />;

  return (
    <Media
      width={resolvedWidth}
      height={resolvedHeight}
      aspectRatio={resolvedAspectRatio}
      objectFit={resolvedObjectFit}
      // `resolvedSrc` es `string | undefined` en el tipo (contempla el caso
      // "sin adjunto" → placeholder, ya devuelto arriba); si llega hasta acá
      // es porque `notFoundName` no se disparó, así que o bien es la URL/
      // nombre resuelto real, o el `src` original ya venía vacío (mismo
      // comportamiento silencioso que el código anterior a esta feature).
      src={resolvedSrc as string}
      {...rest}
    />
  );
}

// GOTCHA (misma auditoría): `MasonryGrid` solo define clases CSS para
// `columns` entre 1 y 12 (ver dist/components/MasonryGrid.module.scss); un
// valor fuera de ese rango —ej. "14", guardado en una pieza real— no
// coincide con ninguna clase `columns-N`, así que `classNames()` la omite
// en silencio y el contenedor queda en simple `display:block` SIN
// `column-count`, apilando cada imagen a ancho completo en vez de una
// cuadrícula. Se acota aquí en el render (afecta también Markdown ya
// guardado) igual que ya se acota `columns` de `LogoCloud` en el editor
// (`toGridSize`, ver ContentBlocks.tsx). También se acota al número real de
// imágenes: pedir más columnas que fotos (ej. "14" columnas para 4 fotos)
// no arma una cuadrícula razonable, deja columnas casi vacías y las
// existentes angostísimas — verificado en pantalla, una fila de tiras de
// ~46px de ancho en vez de una cuadrícula moderada.
function clampMasonryColumns(value: string | number | undefined, itemCount: number): number {
  const numeric = typeof value === "number" ? value : Number(value);
  const requested = Number.isFinite(numeric) ? Math.round(numeric) : 3;
  const boundedByRange = Math.min(12, Math.max(1, requested));
  return itemCount > 0 ? Math.min(boundedByRange, itemCount) : boundedByRange;
}

interface MasonryGridMdxProps extends Omit<React.ComponentProps<typeof MasonryGrid>, "columns"> {
  columns?: string | number;
}

function createMasonryGridElement({ columns, children, ...rest }: MasonryGridMdxProps) {
  const itemCount = React.Children.count(children);
  return (
    <MasonryGrid columns={clampMasonryColumns(columns, itemCount)} {...rest}>
      {children}
    </MasonryGrid>
  );
}

// GOTCHA (defecto logoCloud: "4 logos configurados, 5 espacios
// renderizados"): el `Row` que arma `logoCloud` en ContentBlocks.tsx no
// declara ancho propio, y el Column del artículo (`as="article"`) child
// stretch por default (align-items: stretch) lo estira al 100% del ancho
// del panel. Con 4 tiles de 96px + gap 24 (~456px) dentro de un Row de
// ~640px, sobra un hueco al final del tamaño aproximado de un tile más —
// verificado en pantalla con Playwright contra la pieza real
// (`prueba-de-las-chidas`): el DOM solo tiene 4 <Media> hijos, no hay una
// 5ª entrada ni una imagen rota, el hueco es puramente el remanente de
// ancho del Row estirado. Dentro de esta app, `wrap` en un `Row` serializado
// solo lo emite `logoCloud` (ver ContentBlocks.tsx); `avatarGroup`, `status`
// y `link` usan `Row` sin `wrap`. Este wrapper aplica `fitWidth` (encoge el
// Row a su contenido real) únicamente cuando `wrap` está presente y el
// propio Markdown no pidió explícitamente `fillWidth`/`fill`.
//
// Defecto de alineación (decisión explícita del usuario, con captura del
// visor): todo bloque NO textual debe quedar centrado en el panel del
// artículo; el texto normal se queda a la izquierda. `Row` es el contenedor
// real de logoCloud/avatarGroup/status/link — ninguno de esos declara
// `fillWidth`, así que su ancho real es el de su contenido (intrínseco) y,
// al vivir dentro del `Column as="article"` (align-items: stretch por
// default), quedan pegados a la izquierda en vez de centrados. Se envuelve
// el Row real (ya con su fitWidth resuelto) en un Row exterior que sí ocupa
// el 100% del panel (`fillWidth`) con `horizontal="center"`; si el Markdown
// ya pedía `fillWidth`/`fill` explícito (fuera de este editor) se omite el
// envoltorio: centrar algo que ya ocupa el 100% no cambia nada visualmente,
// pero evita anidar Rows sin necesidad. Sana también el Markdown ya
// guardado en BD sin requerir volver a guardarlo.
function createRowElement({
  wrap,
  fitWidth,
  fillWidth,
  fill,
  children,
  ...rest
}: React.ComponentProps<typeof Row>) {
  const resolvedFitWidth = wrap && !fillWidth && !fill ? (fitWidth ?? true) : fitWidth;
  const row = (
    <Row wrap={wrap} fitWidth={resolvedFitWidth} fillWidth={fillWidth} fill={fill} {...rest}>
      {children}
    </Row>
  );
  if (fillWidth || fill) return row;
  return (
    <Row fillWidth horizontal="center">
      {row}
    </Row>
  );
}

// NOTA (mismo defecto de alineación): `tag`/`badge` sueltos (bloques
// standalone) también deberían centrarse, pero a diferencia de
// logoCloud/avatarGroup/status/link, `Tag` es el MISMO componente que usa
// el bloque `scroller` (tira de tags) para sus chips internos — envolver
// `Tag`/`Badge` a nivel del mapa de components de MDX (como `Row`/`Media`)
// centraría también cada chip DENTRO del Scroller, rompiendo la tira
// horizontal. No hay forma de distinguir "Tag suelto" de "Tag dentro de un
// Scroller" desde este mapa (ambos llegan como el mismo tag JSX, sin
// contexto del padre), así que este caso se resuelve en la SERIALIZACIÓN
// (ContentBlocks.tsx envuelve el Tag/Badge/link sueltos en su propio `Row
// fillWidth horizontal="center"` al crearlos) en vez de a nivel de render.
// Esto sana automáticamente todo lo nuevo; el Markdown de piezas ya
// guardadas con un tag/badge/link suelto (sin ese Row) requiere volver a
// guardar la pieza para centrarse.

type CustomLinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

function CustomLink({ href, children, ...props }: CustomLinkProps) {
  if (href.startsWith("/")) {
    return (
      <SmartLink href={href} {...props}>
        {children}
      </SmartLink>
    );
  }

  if (href.startsWith("#")) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  );
}

function createImage(
  { alt, src, ...props }: MediaProps & { src: string },
  attachments: PieceAttachment[],
) {
  if (!src) {
    console.error("Media requires a valid 'src' property.");
    return null;
  }

  // Markdown `![alt](nombre)` puede referenciar un adjunto por nombre igual
  // que `<Media src="nombre" />` (ver resolveAttachmentSrc).
  const { resolvedSrc, notFoundName } = resolveAttachmentSrc(src, attachments);
  if (notFoundName) return <AttachmentNotFound name={notFoundName} />;

  return (
    <Media
      marginTop="8"
      marginBottom="16"
      enlarge
      radius="m"
      border="neutral-alpha-medium"
      sizes="(max-width: 960px) 100vw, 960px"
      alt={alt}
      // `src` truthy-checked arriba: si `notFoundName` no se disparó,
      // `resolvedSrc` siempre es la URL/nombre resuelto real.
      src={resolvedSrc as string}
      {...props}
    />
  );
}

function slugify(str: string): string {
  const strWithAnd = str.replace(/&/g, " and "); // Replace & with 'and'
  return transliterate(strWithAnd, {
    lowercase: true,
    separator: "-", // Replace spaces with -
  }).replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

function createHeading(as: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  const CustomHeading = ({
    children,
    ...props
  }: Omit<React.ComponentProps<typeof HeadingLink>, "as" | "id">) => {
    const slug = slugify(children as string);
    return (
      <HeadingLink marginTop="24" marginBottom="12" as={as} id={slug} {...props}>
        {children}
      </HeadingLink>
    );
  };

  CustomHeading.displayName = `${as}`;

  return CustomHeading;
}

// FEATURE (herramienta de texto amigable — controles universales "Fuente"/
// "Tamaño"/"Color", ver toolbar de ContentBlocks.tsx): ARQUITECTURA — el
// pipeline de next-mdx-remote/rsc elimina props JSX con llaves y atributos
// `style=` de HTML embebido crudo (ver `stripInlineStyleAttrs` más abajo),
// pero un prop STRING plano en un componente de nuestro propio mapa
// `components` SÍ sobrevive intacto (mismo mecanismo que ya usan `variant`/
// `onBackground`/`align` en `serializeTextSegment`, ver ContentBlocks.tsx).
// `serializeTextSegment` emite `font="Roboto"`/`pt="18"`/`color="#0c6367"`
// como props string reales del `<Text>` — este wrapper (registrado como
// `Text` en el mapa de `components` más abajo, en vez del `Text` crudo de
// Once UI) los intercepta y los traduce a `style` en el momento de
// renderizar, con la MISMA fórmula (`resolveFontStack`/`ptToPx`, ver
// src/lib/fontLibrary.ts) que ya usa el preview en vivo del contentEditable
// en ContentBlocks.tsx — necesario para que editor y visor publicado
// coincidan exactamente. RETROCOMPATIBILIDAD DURA: `variant`/`family`/
// `size`/`onBackground`/`weight` (props legacy) se reenvían tal cual al
// `Text` real sin tocarlos; una pieza publicada ANTES de esta tarea (sin
// `font`/`pt`/`color`) no pasa por ninguna rama nueva de este wrapper y
// renderiza IDÉNTICO. Cuando `font`/`pt`/`color` SÍ coexisten con props
// legacy (ej. `onBackground="brand-medium"` + `color="#ff5500"` en el mismo
// tag — no debería ocurrir desde este editor, pero por si acaso en Markdown
// escrito a mano), las nuevas ganan: `style` inline SIEMPRE tiene mayor
// especificidad que las clases CSS que generan `variant`/`onBackground` (ver
// Text.js del harness: `...style` se mezcla al FINAL de `combinedStyle`).
//
// AVISO (documentado también en el reporte de la tarea): un `color` hex fijo
// NO se adapta al modo claro/oscuro del tema — a diferencia de los tokens
// semánticos (`onBackground="neutral-medium"`, que Once UI resuelve distinto
// por tema), un hex es un valor absoluto. Es una decisión consciente del
// usuario al elegir un color libre en vez de "Predeterminado" (sin color =
// hereda el token de tema de siempre).
interface TextMdxProps extends React.ComponentProps<typeof Text> {
  font?: string;
  pt?: string | number;
  color?: string;
}

function resolveTextOverrideStyle(
  font: string | undefined,
  pt: string | number | undefined,
  color: string | undefined,
): React.CSSProperties | undefined {
  const resolved: React.CSSProperties = {};
  const fontStack = resolveFontStack(font);
  if (fontStack) resolved.fontFamily = fontStack;
  if (pt !== undefined) {
    const numericPt = typeof pt === "number" ? pt : Number(pt);
    if (Number.isFinite(numericPt) && numericPt > 0) {
      resolved.fontSize = `${ptToPx(numericPt)}px`;
    }
  }
  if (color) resolved.color = color;
  return Object.keys(resolved).length > 0 ? resolved : undefined;
}

function createTextElement({ font, pt, color, style, ...rest }: TextMdxProps) {
  const overrideStyle = resolveTextOverrideStyle(font, pt, color);
  const mergedStyle = overrideStyle ? { ...style, ...overrideStyle } : style;
  return <Text style={mergedStyle} {...rest} />;
}

function createParagraph({ children }: TextProps) {
  return (
    <Text
      style={{ lineHeight: "175%" }}
      variant="body-default-m"
      onBackground="neutral-medium"
      marginTop="8"
      marginBottom="12"
    >
      {children}
    </Text>
  );
}

function createInlineCode({ children }: { children: ReactNode }) {
  return <InlineCode>{children}</InlineCode>;
}

// GOTCHA (auditoría "proyecto-prueba-de-texto", comandos mostrados como
// pastilla InlineCode en vez del CodeBlock completo): un fenced block SIN
// tag de lenguaje (``` a secas, sin "bash"/"js"/etc en la misma línea) llega
// aquí con `props.children.props.className` UNDEFINED — remark/mdx solo
// agrega `language-xxx` cuando el fence trae un info string. La condición
// original exigía ese `className` para entrar a `CodeBlock` y, si faltaba,
// caía a un `<pre>` nativo envolviendo lo que sea que `components.code`
// (mapeado a `InlineCode` más abajo) ya haya devuelto para ese nodo —de ahí
// la pastilla dentro de una caja sin estilo, en vez de la barra completa del
// demo. El AST de un fenced block (con o sin lenguaje) SIEMPRE anida
// `pre > code`, así que basta con detectar esa forma (`children.props`
// existe) para enrutar a `CodeBlock` real; el `language`/`label` quedan en
// blanco solo cuando el usuario no especificó ninguno (Prism no resalta,
// pero la barra full-width + botón de copiar sí aparecen, igual que el
// demo). Esto sana también el Markdown YA guardado en BD (piezas
// publicadas antes de este fix) sin requerir volver a guardarlas.
function createCodeBlock(props: any) {
  // For pre tags that contain code blocks (con o sin lenguaje declarado)
  if (props.children && props.children.props) {
    const { className, children } = props.children.props;

    // Extract language from className (format: language-xxx), si existe
    const language = typeof className === "string" ? className.replace("language-", "") : "";
    const label = language ? language.charAt(0).toUpperCase() + language.slice(1) : "Code";

    return (
      <CodeBlock
        marginTop="8"
        marginBottom="16"
        codes={[
          {
            code: children,
            language,
            label,
          },
        ]}
        copyButton={true}
      />
    );
  }

  // Fallback real para `pre` sin un `code` anidado (no debería ocurrir con
  // Markdown estándar, pero evita romper si llegara HTML `<pre>` suelto).
  return <pre {...props} />;
}

// GOTCHA (auditoría "listas en la herramienta de texto"): `ul`/`ol` estaban
// registrados con la MISMA función, que nunca pasaba `as` a `List` — `List`
// por defecto renderiza `as="ul"` (ver dist/components/List.js), así que
// toda lista numerada ya guardada en Markdown (`1. item`) perdía su
// numeración y se veía como viñetas. Dos wrappers separados (uno por tag
// real que el AST de remark ya distingue) en vez de inferir el tipo desde
// `children`, que no trae esa información.
function createUnorderedList({ children }: { children: ReactNode }) {
  return <List as="ul">{children}</List>;
}

function createOrderedList({ children }: { children: ReactNode }) {
  return <List as="ol">{children}</List>;
}

function createListItem({ children }: { children: ReactNode }) {
  return (
    <ListItem marginTop="4" marginBottom="8" style={{ lineHeight: "175%" }}>
      {children}
    </ListItem>
  );
}

// GOTCHA (defecto divisor: línea corta y sin margen): `Line` ya se estira
// sola al 100% del ancho de su contenedor (ver Line.js: `fillWidth: !vert`
// por default), así que el `Row fillWidth horizontal="center"` que envolvía
// esto era innecesario. El bug real era el `maxWidth="40"` puesto sobre la
// propia `Line`: ese "40" no es un token de `maxWidth` responsivo (los
// únicos reconocidos son "xs"/"s"/"m"/"l"/"xl", ver ServerFlex.js), así que
// cae a `parseDimension` como spacing token estático → `var(--static-space-
// 40)` = 2.5rem = 40px — verificado en pantalla, por eso la línea medía
// <50px en vez de cubrir el panel. Quitar el `maxWidth` dejar que `Line`
// use su `fillWidth` nativo la estira a los ~448px reales del Column
// `article` (maxWidth="xs"). Para el margen: el `Column as="article"` ya
// trae `gap="16"` entre bloques; el pedido es sumar ~20px EXTRA arriba y
// abajo del divisor. `marginTop`/`marginBottom` en Flex no colapsan con el
// `gap` del padre (se suman), así que "20" (token estático = 20px exactos,
// ver tokens.css `--static-space-20: 1.25rem`) da el extra pedido sin
// tocar la escala del resto del artículo — medido en pantalla: 16 (gap) +
// 20 (margin) = 36px de separación real arriba y abajo del divisor.
function createHR() {
  return <Line fillWidth marginTop="20" marginBottom="20" />;
}

// FEATURE (Modo Pro, adjuntos con nombre): `img`/`Media` necesitan la lista
// de adjuntos de la pieza para resolver nombre→URL (ver
// resolveAttachmentSrc), así que el mapa de `components` pasó de objeto
// estático a fábrica — `CustomMDX` (mdx.tsx) y `PreviewOverlay` la invocan
// en cada render con los `attachments` que les llegan por prop (piezas sin
// Modo Pro/adjuntos pasan `[]`, y ambos wrappers se comportan IDÉNTICO al
// código anterior: cualquier `src` sigue siendo una URL real que nunca hace
// match contra `[]`).
export function buildComponents(attachments: PieceAttachment[]) {
  return {
  p: createParagraph as any,
  h1: createHeading("h1") as any,
  h2: createHeading("h2") as any,
  h3: createHeading("h3") as any,
  h4: createHeading("h4") as any,
  h5: createHeading("h5") as any,
  h6: createHeading("h6") as any,
  img: ((props: MediaProps & { src: string }) => createImage(props, attachments)) as any,
  a: CustomLink as any,
  code: createInlineCode as any,
  pre: createCodeBlock as any,
  ol: createOrderedList as any,
  ul: createUnorderedList as any,
  li: createListItem as any,
  hr: createHR as any,
  Heading,
  // `Text` crudo (mismo import de arriba) se reemplaza por el wrapper que
  // interpreta `font`/`pt`/`color` (ver `createTextElement`, controles
  // universales de la toolbar del bloque "text" en ContentBlocks.tsx);
  // `createParagraph`/`LegacyCompareImage` de este mismo archivo siguen
  // usando el `Text` crudo importado (no pasan por el mapa de `components`
  // de MDX, no reciben esos props nuevos).
  Text: createTextElement as any,
  CodeBlock,
  InlineCode,
  Accordion,
  AccordionGroup,
  Table,
  Feedback,
  Button,
  Card,
  Grid,
  Column,
  Icon,
  // `Media`, `Row` y `MasonryGrid` crudos (los mismos imports de arriba) se
  // reemplazan por los wrappers que corrigen los GOTCHAs de tamaño/layout
  // documentados arriba; `LegacyCompareImage` sigue usando el `Media`/`Row`
  // crudos importados (no pasa por el mapa de components de MDX, y ya
  // provee aspectRatio/tokens válidos o fillWidth explícito).
  Media: ((props: MediaMdxProps) => createMediaElement(props, attachments)) as any,
  Row: createRowElement as any,
  SmartLink,
  Carousel,
  CompareImage: LegacyCompareImage as any,
  Avatar,
  // `Tag`/`Badge` se centran en la SERIALIZACIÓN (ver nota arriba), no aquí:
  // se mantienen crudos porque `Tag` también es el chip que arma el bloque
  // `scroller` dentro de un `Scroller` (ya `fillWidth` por sí mismo, ver
  // Scroller.js) y no debe ganar un envoltorio de centrado individual.
  // `ProgressBar` tampoco necesita envoltorio: Once UI ya lo fuerza a
  // `fillWidth` internamente (ProgressBar.js). `StatusIndicator` solo se usa
  // dentro del Row de `status` (ya centrado vía `createRowElement`).
  Tag,
  Badge,
  StatusIndicator,
  ProgressBar,
  Scroller,
  MasonryGrid: createMasonryGridElement as any,
  MdxCarousel,
  CarouselVideoSlide,
  Collaborators,
  CollaboratorPerson,
  };
}

// GOTCHA (case study de "3 negocios ideas" 2026-07-10): el bloque "text" del
// editor (ver ContentBlocks.tsx) guarda el `innerHTML` crudo del
// contentEditable tal cual, sin sanitizar — cuando el usuario pega contenido
// desde Word/Google Docs, el navegador inserta HTML válido para el DOM pero
// con tags vacíos SIN autocerrar (ej. `<br>` en vez de `<br/>`), porque el
// parser HTML del navegador infiere ese cierre implícitamente. El parser de
// MDX (micromark, vía next-mdx-remote) NO hace esa inferencia: exige que todo
// tag vacío venga autocerrado, y si no, interpreta el siguiente `</tag>` que
// encuentra (ej. `</span>`) como cierre del tag vacío mal anidado y truena
// con "Unexpected closing tag". Normalizar aquí (en vez de solo al guardar)
// sana también el Markdown YA guardado en BD sin requerir reeditar/reguardar
// la pieza — mismo criterio que el resto de los wrappers de este archivo.
// Comparte esta pasada tanto `CustomMDX` (mdx.tsx, visor público) como
// `serializePreviewMdx` (actions/mdxPreview.ts, previsualización del editor).
const VOID_HTML_TAG_RE =
  /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)((?:\s+[^<>]*)?)>/gi;

export function selfCloseVoidHtmlTags(source: string): string {
  return source.replace(VOID_HTML_TAG_RE, (_match, tag: string, attrs: string) => {
    const cleanedAttrs = attrs.replace(/\/\s*$/, "").trim();
    return cleanedAttrs ? `<${tag} ${cleanedAttrs} />` : `<${tag} />`;
  });
}

// GOTCHA (mismo caso "prueba-1-again" 2026-07-10, segundo hallazgo tras
// autocerrar <br> arriba): el HTML pegado de Word/Docs también trae
// `style="a: b; c: d"` en tags como `<p>`/`<span>`/`<div>`. MDX compila HTML
// embebido literal (no generado por sintaxis Markdown pura) como JSX real,
// SIN pasarlo por el mapa de `components` de este archivo — verificado
// inspeccionando el output de `@mdx-js/mdx`: un `<p style="...">` escrito a
// mano se compila a `_jsx("p", { style: "...", ... })` (string literal
// "p"), no a `_jsx(_components.p, ...)`, así que un wrapper en `components`
// (como `p`/`span`/`div`) nunca se invoca para HTML tecleado/pegado por el
// usuario — solo aplica a lo que produce la sintaxis Markdown pura (#, listas,
// etc). Por eso este bug no se puede arreglar por componente: hay que
// limpiar el atributo en el propio texto MDX antes de compilar. Tampoco se
// puede reescribir a `style={{...}}` porque next-mdx-remote elimina TODO
// atributo JSX con llaves (ver remove-javascript-expressions.js, medida de
// seguridad contra inyección de JS) — el string simplemente se quita, que es
// exactamente lo que se busca aquí. El único lugar del código que emite
// `style=` en el Markdown guardado es el bloque "text" del editor (HTML
// crudo del contentEditable, ver ContentBlocks.tsx); ningún otro bloque lo
// usa, así que este strip es seguro de forma global.
export function stripInlineStyleAttrs(source: string): string {
  return source.replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*')/gi, "");
}

// HOTFIX (digest 2687567694, ruta pública /[username]/proyecto/[slug], 500 en
// producción): `next-mdx-remote` compila con micromark, que NO reconoce
// comentarios HTML (`<!-- ... -->`) como construcción válida de Markdown/MDX
// — truena con "Unexpected character '!' before name" apenas los ve. El HTML
// que Word/Google Docs insertan al pegar en el contentEditable del bloque
// "text" (ver ContentBlocks.tsx) casi siempre trae el artefacto
// `<!--StartFragment-->`/`<!--EndFragment-->` que esos editores usan para
// delimitar internamente el rango copiado — antes de este fix, ese
// `innerHTML` crudo se guardaba tal cual en `markdownContent` (mismo defecto
// de origen que ya arreglan `selfCloseVoidHtmlTags`/`stripInlineStyleAttrs`
// arriba para otros artefactos de Word/Docs) y tronaba el server component
// completo al renderizar. Igual que esos dos sanitizadores, este corre en
// CADA render: sana también piezas YA guardadas en BD con el comentario, sin
// requerir reeditar/reguardar.
//
// CUIDADO CON FENCES: a diferencia de `stripInlineStyleAttrs`/
// `selfCloseVoidHtmlTags` (que operan sobre el string completo sin distinguir
// fences — no se toca ese comportamiento preexistente aquí), este sanitizador
// SÍ debe ser consciente de bloques de código: un fence documentando
// `<!-- comentario -->` como CONTENIDO literal (ej. un demo de HTML) debe
// seguir mostrándose tal cual, no vaciarse. `splitByFences` separa el string
// en segmentos "fence" (el fence completo, delimitadores + contenido, INTACTO)
// y "text" (todo lo demás, donde sí aplica el strip) antes de procesar.
const FENCE_LINE_RE = /^ {0,3}(`{3,}|~{3,})/;

function splitByFences(source: string): { type: "text" | "fence"; content: string }[] {
  const lines = source.split("\n");
  const segments: { type: "text" | "fence"; content: string }[] = [];
  let current: string[] = [];
  let currentType: "text" | "fence" = "text";
  let fenceMarker: string | null = null;

  const flush = () => {
    if (current.length > 0) {
      segments.push({ type: currentType, content: current.join("\n") });
      current = [];
    }
  };

  for (const line of lines) {
    if (fenceMarker === null) {
      const open = FENCE_LINE_RE.exec(line);
      if (open) {
        flush();
        fenceMarker = open[1];
        currentType = "fence";
      } else {
        currentType = "text";
      }
      current.push(line);
    } else {
      current.push(line);
      const close = FENCE_LINE_RE.exec(line);
      // CommonMark exige que el fence de cierre use el mismo carácter
      // (backtick/virgulilla) y al menos la misma longitud que el de
      // apertura, y que la línea no tenga más que espacios después.
      if (
        close &&
        close[1][0] === fenceMarker[0] &&
        close[1].length >= fenceMarker.length &&
        line.trim() === close[1]
      ) {
        flush();
        fenceMarker = null;
        currentType = "text";
      }
    }
  }
  flush();
  return segments;
}

// Elimina comentarios HTML completos (incluyendo multilínea) de un segmento
// de texto. Un comentario SIN cierre (ej. contenido truncado, o el caso
// límite de un `<!--StartFragment-->` cuyo cierre real quedó fuera del
// fragmento pegado) se recorta desde ahí hasta el final del documento
// completo: el propio `truncated` en `stripHtmlComments` propaga ese corte a
// los segmentos siguientes (texto o fence) en vez de dejar un `<!--` colgante
// que seguiría rompiendo la compilación.
export function stripHtmlComments(source: string): string {
  const segments = splitByFences(source);
  let truncated = false;
  const result: string[] = [];

  for (const segment of segments) {
    if (truncated) continue;
    if (segment.type === "fence") {
      result.push(segment.content);
      continue;
    }
    let text = segment.content.replace(/<!--[\s\S]*?-->/g, "");
    const unterminatedIndex = text.indexOf("<!--");
    if (unterminatedIndex !== -1) {
      text = text.slice(0, unterminatedIndex);
      truncated = true;
    }
    result.push(text);
  }

  return result.join("\n");
}
