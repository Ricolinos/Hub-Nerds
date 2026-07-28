"use client";

import { Carousel, Column, Icon, Media, Row } from "@once-ui-system/core";
// Bloque "Carousel" del editor (ver ContentBlocks.tsx, BLOCK_TYPES →
// "mediaCarousel"): usa el `Carousel` NATIVO de Once UI (ya "use client" en
// el propio paquete, ver dist/components/Carousel.js) en vez de una
// librería nueva (la Ruta A con swiper.js se descartó — ver git history y
// el reporte de la tarea "Carousel nativo Once UI"). `Carousel.items` es un
// array — imposible como prop JSX serializada (blockJS de next-mdx-remote/
// rsc la elimina, ver GOTCHA extenso en ContentBlocks.tsx junto a
// `escapeAttr`) — así que este wrapper la CONSTRUYE en runtime a partir de
// los `children` literales (que sí sobreviven, con sus props string), mismo
// patrón que ya usa el resto del mapa de `components` de mdx.tsx.
//
// Slide de imagen: cualquier hijo con un prop `src` string (`<Media>`,
// `<img>`) se traduce a `{ slide: src, alt }` — Carousel lo renderiza con su
// propio `Media` interno (next/image, srcSet, etc), tanto en el visor grande
// como en la miniatura del indicator="thumbnail": ambos son `<Image>`
// estáticos, sin ningún problema de interactividad.
// Slide de video (YouTube o archivo subido): se pasa como `<CarouselVideoSlide
// .../>` (ver más abajo) en vez de un string — Carousel acepta
// `slide: string | ReactNode` (ver Carousel.d.ts) y por eso NO se resuelve
// aquí a un string plano.
import React from "react";
import { CoverflowCarousel, type CoverflowSlide } from "@/components/originkit/CoverflowCarousel";
import { RoundCarousel, type RoundSlide } from "@/components/originkit/RoundCarousel";

interface MdxCarouselSlideProps {
  src?: string;
  alt?: string;
}

// Estilo de presentación del bloque. "default" es el `Carousel` de Once UI de
// siempre (una foto a la vez, indicador de miniaturas); "coverflow" apila las
// vecinas a los lados con el efecto de portadas (ver
// originkit/CoverflowCarousel.tsx). Se serializa como prop string desde el
// editor —nunca con llaves— porque blockJS elimina cualquier `prop={...}`
// (ver el GOTCHA de `escapeAttr` en ContentBlocks.tsx).
export type MdxCarouselVariant = "default" | "coverflow" | "ring";

interface MdxCarouselProps extends Omit<React.ComponentProps<typeof Carousel>, "items"> {
  children: React.ReactNode;
  variant?: MdxCarouselVariant;
}

// GOTCHA CRÍTICO (limitación conocida de la Ruta A/B original, resuelta
// aquí): dist/components/Carousel.js renderiza el MISMO `item.slide` (si no
// es un string) en DOS lugares del árbol simultáneamente cuando
// `indicator="thumbnail"` — el visor grande (slide activo, dentro de
// RevealFx) Y la miniatura de cada ítem dentro de su `Scroller` (ver el
// mapeo `items.map` para `indicator === "thumbnail"` en ese archivo). Un
// iframe de YouTube o un <video> "vivo" ahí duplicado significa DOS
// reproductores reales en pantalla, y el de la miniatura —al ser un iframe/
// video, que siempre captura sus propios eventos de puntero— nunca deja
// pasar el click hasta el `onItemClick` del Scroller: la miniatura de video
// queda "muerta" al click. No se puede tocar Carousel.js (dist del paquete,
// fuera de este repo), así que la solución vive en el propio slide: cada
// aparición del MISMO elemento JSX se monta como una instancia de React
// INDEPENDIENTE (con su propio estado — son dos posiciones distintas del
// árbol), así que `CarouselVideoSlide` mide su PROPIO contenedor al montar
// y decide en qué contexto está: la miniatura (thumbnail.height por defecto
// "80" ≈ 80px + padding interno de Carousel, ver Carousel.js) siempre es
// mucho más baja que el visor grande (aspectRatio del bloque sobre el ancho
// real del artículo, cientos de px) — ver VIDEO_SLIDE_THUMBNAIL_MAX_PX.
// Mientras el slide de video es la miniatura (o antes de la primera
// medición, para no parpadear un iframe/video real en el primer frame),
// muestra una imagen estática + ícono de play; solo el slide activo
// (contenedor grande) monta el reproductor real.
const VIDEO_SLIDE_THUMBNAIL_MAX_PX = 140;

interface CarouselVideoSlideProps {
  kind: "youtube" | "file";
  youtubeId?: string;
  src?: string;
  alt?: string;
}

export function CarouselVideoSlide({ kind, youtubeId, src, alt }: CarouselVideoSlideProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isThumbnail, setIsThumbnail] = React.useState<boolean | null>(null);

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () =>
      setIsThumbnail(el.getBoundingClientRect().height <= VIDEO_SLIDE_THUMBNAIL_MAX_PX);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const youtubeThumbnailSrc =
    kind === "youtube" && youtubeId
      ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
      : null;

  // `isThumbnail !== false` cubre tanto "ya medido, SÍ es miniatura" como
  // "todavía no se midió" (null): evitar el flash de un reproductor real
  // en el primer frame es más importante que evitar un frame de póster de
  // más en el slide activo.
  const showStatic = isThumbnail !== false;

  // GOTCHA CRÍTICO (bug "video de YouTube en carousel no reproduce click"):
  // `Carousel` (dist/components/Carousel.js, fuera de este repo) pinta, DESPUÉS
  // del slide activo y como hermano suyo dentro del mismo `RevealFx`, un `Row`
  // (className `styles.controls`) con `position:"absolute" fill` que cubre TODA
  // el área del slide para las franjas de click prev/next — sin
  // `pointer-events:none` en su SCSS (ver Carousel.module.scss: solo hay
  // `.left`/`.right` de 12 unidades de ancho, pero el contenedor `.controls`
  // en sí ocupa el 100%). Ambos (el `Flex` que envuelve este slide y ese `Row`
  // de controles) son elementos `position` con `z-index:auto`: en ese bucket
  // el orden de pintado es por orden en el árbol, así que el `Row` posterior
  // pinta ENCIMA — capturando cualquier click en el CENTRO del slide (el botón
  // de play del iframe de YouTube o los controles nativos de un <video>),
  // aunque visualmente ahí no haya ningún control de Carousel. No se puede
  // tocar Carousel.js (dist del paquete). La solución vive acá: solo en el
  // slide GRANDE activo (no en la miniatura, donde no aplica) se sube este
  // contenedor a `zIndex={1}` — un z-index explícito > 0 pinta DESPUÉS de los
  // hermanos `z-index:auto` sin importar su orden en el DOM (mismo stacking
  // context, ya que ni RevealFx ni el `Flex` intermedio de Carousel aíslan uno
  // nuevo), dejando el iframe/video real por ENCIMA del `Row` de controles.
  // Las franjas de click prev/next siguen funcionando en los bordes del
  // slide porque siguen siendo las MISMAS franjas de 12 unidades de Carousel,
  // ahora simplemente debajo del video en el centro (donde antes tampoco
  // había ningún control visible). Verificado en pantalla contra la pieza
  // real de Ricolinos y una pieza de prueba de freelancer_demo.
  const isActiveVideoPlayer = isThumbnail === false;

  return (
    <Column
      ref={containerRef}
      fill
      overflow="hidden"
      position="relative"
      zIndex={isActiveVideoPlayer ? 1 : undefined}
      background="neutral-alpha-weak"
    >
      {showStatic ? (
        <>
          {youtubeThumbnailSrc ? (
            // <img> plano (no next/image): evita agregar img.youtube.com a
            // images.remotePatterns (next.config.mjs) solo para una
            // miniatura de carrusel.
            // eslint-disable-next-line @next/next/no-img-element -- miniatura estática externa, no optimizable por next/image sin registrar el host.
            <img
              src={youtubeThumbnailSrc}
              alt={alt || ""}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
          <Row position="absolute" fill horizontal="center" vertical="center">
            <Row
              radius="full"
              background="neutral-alpha-strong"
              padding="12"
              horizontal="center"
              vertical="center"
            >
              <Icon name="play" size="m" onBackground="neutral-strong" />
            </Row>
          </Row>
        </>
      ) : kind === "youtube" && youtubeId ? (
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
          title={alt || "Video de YouTube"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ border: 0 }}
        />
      ) : src ? (
        // Mismo GOTCHA que la portada/bloque "video" del cuerpo (ver
        // lib/coverMedia.ts, isVideoDataUrl): `Media` no reconoce
        // "data:video/..." como video, así que el archivo subido usa
        // <video> nativo directo. `controls` sin `autoPlay` (a diferencia
        // de la portada, que SÍ autoplay-mutea de fondo): dentro del cuerpo
        // del artículo un video es contenido a demanda, no decorativo.
        // eslint-disable-next-line jsx-a11y/media-has-caption -- video de portafolio sin pista de subtítulos disponible.
        <video
          src={src}
          controls
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
    </Column>
  );
}

function toCarouselItem(
  child: React.ReactNode,
): { slide: string | React.ReactNode; alt?: string } | null {
  if (!React.isValidElement(child)) return null;
  // Slide de video: SIEMPRE como ReactNode (nunca como string), incluso la
  // variante "file" —que sí trae un `src` string— para no perder la
  // protección de miniatura estática de `CarouselVideoSlide` (ver GOTCHA
  // arriba). Comparar por referencia de función (`child.type`) es seguro
  // acá: MDX resuelve el tag `<CarouselVideoSlide>` contra el mismo import
  // registrado en el mapa de `components` de mdx.tsx.
  if (child.type === CarouselVideoSlide) {
    const props = child.props as CarouselVideoSlideProps;
    return { slide: child, alt: props.alt };
  }
  const props = child.props as MdxCarouselSlideProps;
  if (typeof props.src === "string" && props.src.length > 0) {
    return { slide: props.src, alt: props.alt };
  }
  return { slide: child };
}

// GOTCHA de Once UI `Media` (dist/components/Media.js): el wrapper es SIEMPRE
// `fillWidth`, y su ALTURA sale del `aspectRatio` (truco de padding). Con
// `fill` la librería pone `aspectRatio: undefined`, así que el wrapper queda de
// altura 0 y el <img> —que sí se pinta, con su srcSet correcto— no tiene nada
// que llenar: la tarjeta sale VACÍA. El `inset: 0` absoluto le da las dos
// dimensiones desde la tarjeta que lo contiene, que es quien manda el tamaño
// en las dos variantes de Originkit.
function toFilledNode(slide: string | React.ReactNode, alt: string | undefined): React.ReactNode {
  if (typeof slide !== "string") return slide;
  return (
    <Media
      src={slide}
      alt={alt ?? ""}
      fill
      objectFit="cover"
      style={{ position: "absolute", inset: 0 }}
    />
  );
}

export function MdxCarousel({ children, variant = "default", ...rest }: MdxCarouselProps) {
  const items = React.Children.toArray(children)
    .map(toCarouselItem)
    .filter((item): item is { slide: string | React.ReactNode; alt?: string } => item !== null);

  if (items.length === 0) return null;

  // Las dos variantes de Originkit NO consumen `Carousel.items`: cada tarjeta
  // es su propia caja y el slide llega ya como nodo. Los slides de imagen (que
  // `toCarouselItem` resolvió a un string) se envuelven en `Media` de Once UI
  // —no un <img> crudo ni un background-image como upstream— para conservar
  // next/image y el mismo recorte que el resto del visor.
  if (variant === "coverflow") {
    const slides: CoverflowSlide[] = items.map((item, index) => ({
      key: `${index}`,
      alt: item.alt,
      content: toFilledNode(item.slide, item.alt),
    }));
    return (
      <CoverflowCarousel
        slides={slides}
        aspectRatio={typeof rest.aspectRatio === "string" ? rest.aspectRatio : undefined}
      />
    );
  }

  if (variant === "ring") {
    const slides: RoundSlide[] = items.map((item, index) => ({
      key: `${index}`,
      content: toFilledNode(item.slide, item.alt),
    }));
    return (
      <RoundCarousel
        slides={slides}
        aspectRatio={typeof rest.aspectRatio === "string" ? rest.aspectRatio : undefined}
      />
    );
  }

  return <Carousel items={items} {...rest} />;
}
