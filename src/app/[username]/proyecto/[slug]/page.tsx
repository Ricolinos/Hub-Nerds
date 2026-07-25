import { auth } from "@clerk/nextjs/server";
import {
  Avatar,
  Badge,
  Column,
  Heading,
  HeadingNav,
  Line,
  Media,
  Meta,
  Row,
  Schema,
  SmartLink,
  Tag,
  Text,
} from "@once-ui-system/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { PieceAttachment } from "@/app/actions/portfolioPieces";
import { CustomMDX, ScrollToHash } from "@/components";
import { AppearanceScope } from "@/components/profile/AppearanceScope";
import { getCaseStudy, slugifyTitle } from "@/lib/caseStudies";
import { isPlayableVideoUrl, isVideoDataUrl, resolveCoverSrc } from "@/lib/coverMedia";
import { categoryExploreHref, softwareTagVariant } from "@/lib/pieceCategories";
import { prisma } from "@/lib/prisma";
import { baseURL } from "@/resources";
import { formatDate } from "@/utils/formatDate";

// Cabecera del visor (tarea "rediseño del editor", parte 2): fecha →
// categoría (Badge clickeable a /explorar) → subcategorías (Tags, tope 5 +
// "+X más") → software (Tags de color, más discreto) → título → usuario.
// Piezas viejas sin subcategories/software (arreglo vacío, ver
// utils/utils.ts y loadCaseStudy) simplemente no muestran esas filas — sin
// huecos, cada fila es condicional a tener contenido real.
const MAX_VISIBLE_SUBCATEGORIES = 5;

interface CaseStudyPageProps {
  params: Promise<{ username: string; slug: string }>;
}

// Resuelve autor y caso de estudio respetando visibilidad: si la pieza en BD
// está en borrador, solo el dueño puede verla. cache() dedupe entre
// generateMetadata y la página.
//
// Dos fuentes de contenido, mismo shape de salida ({post, author}):
// 1. BD (piece.markdownContent): piezas creadas desde el editor propio.
// 2. Archivo .mdx en src/content/portfolio (legado, fixtures de seed).
// La BD tiene prioridad; el archivo es fallback para piezas antiguas que
// nunca tuvieron fila con markdownContent.
const loadCaseStudy = cache(async (username: string, slug: string) => {
  const author = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      // Apariencia del perfil del dueño (marca/acento/neutro): el visor de
      // proyecto también repinta su fondo con la paleta guardada, mismo
      // patrón que /[username] (ver ProfileView.tsx / AppearanceScope.tsx).
      profileBrand: true,
      profileAccent: true,
      profileNeutral: true,
      portfolio: {
        select: {
          title: true,
          description: true,
          category: true,
          subcategories: true,
          software: true,
          coverUrl: true,
          gallery: true,
          attachments: true,
          markdownContent: true,
          releaseDate: true,
          createdAt: true,
          isPublic: true,
        },
      },
    },
  });
  if (!author) return null;

  const piece = author.portfolio.find((p) => slugifyTitle(p.title) === slug);

  if (piece && !piece.isPublic) {
    const { userId } = await auth();
    if (userId !== author.id) return null;
  }

  if (piece?.markdownContent) {
    const gallery = Array.isArray(piece.gallery) ? (piece.gallery as string[]) : [];
    // coverUrl puede traer el prefijo "video:" (portada de video por URL,
    // ver lib/coverMedia): se resuelve a la URL real ANTES de exponerla como
    // `image`/`images[0]`, que es lo que consumen tanto el hero (<Media>,
    // más abajo) como el <Schema>/generateMetadata de esta misma página.
    // isPlayableVideoUrl (aplicado en generateMetadata) detecta el video
    // sobre esta misma URL YA resuelta, sin depender de un campo extra en
    // `post.metadata` — evita que el shape diverja del branch legado (MDX
    // en archivo) más abajo, que nunca tiene portada de video.
    const coverSrc = piece.coverUrl ? resolveCoverSrc(piece.coverUrl) : "";
    const post = {
      slug,
      metadata: {
        title: piece.title,
        publishedAt: (piece.releaseDate ?? piece.createdAt).toISOString(),
        // Descripción breve opcional (PortfolioPiece.description, máx. 140
        // caracteres): dobla como `summary` para el header del visor (ver
        // JSX abajo), el fallback de OG/description (generateMetadata) y
        // `Schema.description` — mismo campo que ya usan los .mdx legado en
        // su frontmatter (ver lib/caseStudies.ts/getPosts).
        summary: piece.description ?? "",
        image: coverSrc,
        images: coverSrc ? [coverSrc, ...gallery] : gallery,
        tag: piece.category,
        subcategories: piece.subcategories,
        software: piece.software,
        team: [],
      },
      content: piece.markdownContent,
    };
    // FEATURE (Modo Pro): adjuntos con nombre del proyecto (ver
    // PortfolioPiece.attachments) — el MDX los referencia por `name`, nunca
    // por `url`. Piezas legadas en archivo (branch de abajo) no tienen fila
    // en BD, así que nunca traen adjuntos.
    const attachments = Array.isArray(piece.attachments)
      ? (piece.attachments as unknown as PieceAttachment[])
      : [];
    return { post, author, attachments };
  }

  const post = getCaseStudy(username, slug);
  if (!post) return null;

  return { post, author, attachments: [] as PieceAttachment[] };
});

export async function generateMetadata({ params }: CaseStudyPageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const result = await loadCaseStudy(username, slug);
  if (!result) return {};
  const { post, author } = result;
  const authorName = author.name ?? username;

  // Piezas creadas desde el editor propio sin descripción breve traen
  // summary vacío (ver loadCaseStudy): sin este fallback el og:description
  // queda vacío y muchos clientes de link preview (WhatsApp, Twitter/X)
  // directamente omiten la tarjeta si no hay descripción.
  const description = post.metadata.summary?.trim()
    ? post.metadata.summary
    : `Proyecto de ${authorName} (@${username}) en Hub-Nerds`;

  // coverUrl puede ser una data: URL (piezas viejas, antes de moverse a
  // Supabase Storage): Meta.generate solo distingue http(s) vs relativa, así
  // que una data: URL termina concatenada tras baseURL y produce una imagen
  // rota fuera del sitio. Data URL no sirve para OG → usa el generador.
  // Tampoco sirve una portada de VIDEO (YouTube/.mp4, ver lib/coverMedia):
  // ningún cliente de link preview renderiza un <video>/iframe como
  // og:image, así que cae al mismo generador que data: URLs.
  const image =
    post.metadata.image &&
    !post.metadata.image.startsWith("data:") &&
    !isPlayableVideoUrl(post.metadata.image)
      ? post.metadata.image
      : `/api/og/generate?title=${encodeURIComponent(post.metadata.title)}`;

  return Meta.generate({
    title: post.metadata.title,
    description,
    baseURL: baseURL,
    image,
    path: `/${username}/proyecto/${slug}`,
  });
}

export default async function FreelancerCaseStudy({ params }: CaseStudyPageProps) {
  const { username, slug } = await params;

  const result = await loadCaseStudy(username, slug);
  if (!result) {
    notFound();
  }
  const { post, author, attachments } = result;

  const category = post.metadata.tag?.trim();
  const subcategories = (post.metadata.subcategories ?? []).filter((s) => s.trim());
  const software = (post.metadata.software ?? []).filter((s) => s.trim());
  const visibleSubcategories = subcategories.slice(0, MAX_VISIBLE_SUBCATEGORIES);
  const hiddenSubcategoriesCount = subcategories.length - visibleSubcategories.length;

  return (
    <AppearanceScope
      appearance={{
        brand: author.profileBrand,
        accent: author.profileAccent,
        neutral: author.profileNeutral,
      }}
    >
    {/* HeadingNav (Módulo Once UI, tarea "HeadingNav"): mismo patrón de
        layout que ya usa src/app/blog/[slug]/page.tsx — un `Row` spacer
        (balancea el ancho del riel de la derecha para que el contenido
        central quede centrado de verdad) + el contenido + la columna fija
        sticky con `HeadingNav`, oculta en breakpoints angostos (`m={{ hide:
        true }}`, ver rules.compact.md "Responsive: breakpoint props"). El
        propio módulo (`useHeadingLinks`) lee los headings vía
        `document.querySelectorAll("h2,h3,h4,h5,h6")` en el DOM ya
        renderizado — funciona igual con piezas de BD (bloque "Nueva sección"
        → `## título`) y con los .mdx legado en archivo, sin distinguir la
        fuente. */}
    <Row fillWidth>
      <Row maxWidth={12} m={{ hide: true }} />
      <Row fillWidth horizontal="center">
    <Column as="section" maxWidth="m" horizontal="center" gap="l">
      <Schema
        as="blogPosting"
        baseURL={baseURL}
        path={`/${username}/proyecto/${slug}`}
        title={post.metadata.title}
        description={post.metadata.summary}
        datePublished={post.metadata.publishedAt}
        dateModified={post.metadata.publishedAt}
        image={
          post.metadata.image && !isPlayableVideoUrl(post.metadata.image)
            ? post.metadata.image
            : `/api/og/generate?title=${encodeURIComponent(post.metadata.title)}`
        }
        author={{
          name: author.name ?? username,
          url: `${baseURL}/${username}`,
          image: author.imageUrl ? `${baseURL}${author.imageUrl}` : undefined,
        }}
      />
      <Column maxWidth="s" gap="16" horizontal="center" align="center">
        <SmartLink href={`/${username}`}>
          <Text variant="label-strong-m">Proyectos</Text>
        </SmartLink>
        <Text variant="body-default-xs" onBackground="neutral-weak">
          {post.metadata.publishedAt && formatDate(post.metadata.publishedAt)}
        </Text>
        {category && <Badge title={category} href={categoryExploreHref(category)} />}
        {visibleSubcategories.length > 0 && (
          <Row gap="8" wrap horizontal="center">
            {visibleSubcategories.map((subcategory) => (
              <Tag key={subcategory} size="m" variant="neutral" label={subcategory} />
            ))}
            {hiddenSubcategoriesCount > 0 && (
              <Tag size="m" variant="brand" label={`+${hiddenSubcategoriesCount} más`} />
            )}
          </Row>
        )}
        {software.length > 0 && (
          <Row gap="8" wrap horizontal="center">
            {software.map((name) => (
              <Tag key={name} size="s" variant={softwareTagVariant(name)} label={name} />
            ))}
          </Row>
        )}
        <Heading variant="display-strong-m">{post.metadata.title}</Heading>
        {post.metadata.summary?.trim() && (
          <Text
            variant="body-default-m"
            onBackground="neutral-weak"
            align="center"
            wrap="balance"
          >
            {post.metadata.summary}
          </Text>
        )}
      </Column>
      <Row marginBottom="32" horizontal="center">
        <Row gap="12" vertical="center">
          <Avatar src={author.imageUrl ?? undefined} size="s" />
          <SmartLink href={`/${username}`}>
            <Text variant="label-default-m" onBackground="brand-weak">
              {author.name ?? username}
            </Text>
          </SmartLink>
        </Row>
      </Row>
      {post.metadata.images.length > 0 &&
        (isVideoDataUrl(post.metadata.images[0]) ? (
          // GOTCHA (ver lib/coverMedia.ts, isVideoDataUrl): `Media` detecta
          // video por EXTENSIÓN de archivo en la URL — un data URL de mp4
          // subido ("data:video/mp4;base64,...") nunca la trae, así que
          // `Media` lo trataría como imagen rota. <video> nativo (muted/
          // loop/autoPlay, como el resto de las portadas-video del sitio)
          // en vez de <Media> solo para este caso.
          <Column radius="m" overflow="hidden" style={{ aspectRatio: "16 / 9" }}>
            <video
              src={post.metadata.images[0]}
              muted
              loop
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            >
              <track kind="captions" />
            </video>
          </Column>
        ) : (
          <Media
            priority
            aspectRatio="16 / 9"
            radius="m"
            alt={post.metadata.title}
            src={post.metadata.images[0]}
          />
        ))}
      {/* `gap` separa los bloques de nivel superior que arma el editor
          (texto/imagen/carousel/tag/badge/status/progress/avatares/logos/
          tira/masonry). Varios de esos bloques se serializan a JSX "pelón"
          (Tag, Badge, StatusIndicator, ProgressBar, Scroller, MasonryGrid,
          Row/Column crudos) sin margen propio —a diferencia de p/headings/
          img, que ya traen su propio marginTop/marginBottom en los
          overrides de mdx.tsx—, así que sin este gap quedan pegados entre
          sí. Verificado en pantalla que un `gap` aquí no rompe el
          contenido legado (los .mdx viejos ya traían su propio margen,
          simplemente ganan un poco más de aire) y evita depender de que el
          usuario agregue un bloque "Divisor" a mano entre cada sección. */}
      <Column style={{ margin: "auto" }} as="article" maxWidth="xs" gap="16">
        <CustomMDX source={post.content} attachments={attachments} />
      </Column>
      <Column fillWidth horizontal="center" marginTop="40" gap="24">
        <Line maxWidth="40" />
        <SmartLink href={`/${username}`}>
          <Text variant="label-strong-m">Ver más proyectos de {author.name ?? username}</Text>
        </SmartLink>
      </Column>
      <ScrollToHash />
    </Column>
      </Row>
      <Column
        maxWidth={12}
        paddingLeft="40"
        fitHeight
        position="sticky"
        top="80"
        gap="16"
        m={{ hide: true }}
      >
        <HeadingNav fitHeight />
      </Column>
    </Row>
    </AppearanceScope>
  );
}
