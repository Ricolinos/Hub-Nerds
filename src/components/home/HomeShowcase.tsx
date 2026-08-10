"use client";

import {
  Animation,
  Avatar,
  Card,
  Column,
  DropdownWrapper,
  Grid,
  Icon,
  Media,
  Option,
  RevealFx,
  Row,
  SegmentedControl,
  SmartLink,
  Tag,
  Text,
} from "@once-ui-system/core";
import { useEffect, useMemo, useState } from "react";
import { getLikeState } from "@/app/actions/likes";
import { SearchBarShell } from "@/components/explore/SearchBarShell";
import { useLikeToggle } from "@/components/profile/useLikeToggle";
import { VideoCover } from "@/components/shared/VideoCover";
import { coverKindOf, extractYouTubeId, resolveCoverSrc } from "@/lib/coverMedia";

const SUGGESTED_SEARCHES = ["Diseño Gráfico", "Animación", "Branding"];

const FEED_TABS = ["Para ti", "Descubrir", "Proyectos"];

const ORDER_OPTIONS = ["Más valorados", "Más recientes", "Más vistos"] as const;

export type ShowcasePiece = {
  id: string;
  // Dueño de la pieza (PortfolioPiece.userId): permite comparar contra el
  // visitante actual y ocultar el toggle de like en piezas propias (regla
  // que ya aplica el server action, ver actions/likes.ts).
  userId: string;
  title: string;
  // Descripción breve opcional (PortfolioPiece.description, máx. 140
  // caracteres); null cuando el Freelancer no la llenó.
  description: string | null;
  designer: string;
  avatarUrl: string | null;
  location: string | null;
  tag: string;
  image: string;
  likes: number;
  views: number;
  // Ruta al caso de estudio MDX (/<username>/proyecto/<slug>) cuando existe
  href?: string;
};

const ALL_LOCATIONS = "Todas las ubicaciones";
const ALL_CATEGORIES = "Todas las categorías";

function formatMetric(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${value}`;
}

function CategoryDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownWrapper
      isOpen={open}
      onOpenChange={setOpen}
      trigger={
        <Row vertical="center" gap="4" paddingX="4" cursor="pointer">
          <Text variant="label-default-s" onBackground="neutral-strong">
            {value}
          </Text>
          <Icon name="chevronDown" size="xs" onBackground="neutral-weak" />
        </Row>
      }
      dropdown={
        <Column minWidth={10} padding="4" gap="2">
          {options.map((option) => (
            <Option
              key={option}
              label={option}
              value={option}
              selected={value === option}
              onClick={(selected) => {
                onChange(selected);
                setOpen(false);
              }}
            />
          ))}
        </Column>
      }
    />
  );
}

function OrderDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownWrapper
      isOpen={open}
      onOpenChange={setOpen}
      trigger={
        <Row vertical="center" gap="4" paddingX="4" cursor="pointer">
          <Text variant="label-default-s" onBackground="neutral-strong">
            {value}
          </Text>
          <Icon name="chevronDown" size="xs" onBackground="neutral-weak" />
        </Row>
      }
      dropdown={
        <Column minWidth={10} padding="4" gap="2">
          {ORDER_OPTIONS.map((option) => (
            <Option
              key={option}
              label={option}
              value={option}
              selected={value === option}
              onClick={(selected) => {
                onChange(selected);
                setOpen(false);
              }}
            />
          ))}
        </Column>
      }
    />
  );
}

function LocationDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownWrapper
      isOpen={open}
      onOpenChange={setOpen}
      trigger={
        <Row vertical="center" gap="4" paddingX="4" cursor="pointer">
          <Text variant="label-default-s" onBackground="neutral-strong">
            {value}
          </Text>
          <Icon name="chevronDown" size="xs" onBackground="neutral-weak" />
        </Row>
      }
      dropdown={
        <Column minWidth={12} padding="4" gap="2">
          {options.map((option) => (
            <Option
              key={option}
              label={option}
              value={option}
              selected={value === option}
              onClick={(selected) => {
                onChange(selected);
                setOpen(false);
              }}
            />
          ))}
        </Column>
      }
    />
  );
}

// Réplica compacta (icono + contador, sin chrome de Button) del LikeButton
// del case study: mismo heart/heartSolid homologado con ExploreFeed, mismos
// 3 estados (dueño ve solo el número, anónimo linkea a /sign-in, logueado
// togglea). Vive fuera del SmartLink de la tarjeta (ver ShowcaseCard abajo)
// para no anidar un control interactivo dentro de otro <a>.
function LikeMetric({
  pieceId,
  initialLikes,
  initialLiked,
  isOwner,
  isSignedIn,
}: {
  pieceId: string;
  initialLikes: number;
  initialLiked: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
}) {
  const { liked, likes, isPending, toggle } = useLikeToggle({
    pieceId,
    initialLikes,
    initialLiked,
  });

  if (isOwner) {
    return (
      <Row gap="4" vertical="center">
        <Icon name="heart" size="xs" onBackground="neutral-weak" />
        <Text variant="label-default-s" onBackground="neutral-weak">
          {formatMetric(likes)}
        </Text>
      </Row>
    );
  }

  if (!isSignedIn) {
    return (
      <SmartLink href="/sign-in" unstyled style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <Icon name="heart" size="xs" onBackground="neutral-weak" />
        <Text variant="label-default-s" onBackground="neutral-weak">
          {formatMetric(likes)}
        </Text>
      </SmartLink>
    );
  }

  return (
    <Row
      gap="4"
      vertical="center"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isPending) toggle();
      }}
      style={{ cursor: isPending ? "default" : "pointer" }}
    >
      <Icon
        name={liked ? "heartSolid" : "heart"}
        size="xs"
        onBackground={liked ? "brand-strong" : "neutral-weak"}
      />
      <Text variant="label-default-s" onBackground={liked ? "brand-strong" : "neutral-weak"}>
        {formatMetric(likes)}
      </Text>
    </Row>
  );
}

function ShowcaseCard({
  project,
  likedByViewer,
  isOwner,
  isSignedIn,
}: {
  project: ShowcasePiece;
  likedByViewer: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
}) {
  const avatarProps = project.avatarUrl
    ? { src: project.avatarUrl }
    : { value: (project.designer[0] ?? "P").toUpperCase() };
  // La categoría puede venir como lista larga ("Branding, Motion Graphics, Graphic
  // Design"). El título tiene prioridad: el Tag solo muestra la primera categoría +
  // un contador, con el listado completo disponible como tooltip nativo.
  const tagCategories = project.tag.split(",").map((c) => c.trim()).filter(Boolean);
  const tagLabel =
    tagCategories.length > 1 ? `${tagCategories[0]} +${tagCategories.length - 1}` : project.tag;

  // Portada de video (link de YouTube o archivo .mp4/data URL, ver
  // lib/coverMedia): reproduce de verdad, silenciosa y en loop (ver
  // componente compartido VideoCover). GIF sí llega tal cual a <Media>
  // (data URL de imagen, se anima solo).
  const isVideoCover = coverKindOf(project.image) === "video";
  const coverSrc = resolveCoverSrc(project.image);
  const youtubeId = isVideoCover ? extractYouTubeId(coverSrc) : null;

  // Solo la portada + título/tag/descripción viven dentro del SmartLink: el
  // like es un control interactivo propio (Row con onClick) y anidarlo
  // dentro de un <a> es HTML inválido (mismo tipo de bug que el de los
  // enlaces anidados en el MDX, ver stripNestedAnchorTags en mdx-shared.tsx)
  // — se resuelve dejándolo fuera del link, como ya hacía ExploreFeed.
  const linkableContent = (
    <>
      <Column fillWidth radius="m" overflow="hidden">
        {isVideoCover ? (
          <VideoCover youtubeId={youtubeId} src={coverSrc} alt={project.title} aspectRatio="4 / 3" />
        ) : (
          <Animation triggerType="hover" scale={1.03} fade={1} reverse easing="ease" fillWidth>
            <Media
              src={coverSrc}
              alt={project.title}
              aspectRatio="4 / 3"
              sizes="(max-width: 768px) 100vw, 25vw"
            />
          </Animation>
        )}
      </Column>
      <Column fillWidth gap="8" paddingX="4">
        <Row fillWidth horizontal="between" vertical="start" gap="8">
          <Row minWidth={0} flex={1}>
            <Text variant="heading-strong-s" onBackground="neutral-strong" wrap="balance" truncate>
              {project.title}
            </Text>
          </Row>
          <Tag size="s" label={tagLabel} title={project.tag} variant="neutral" />
        </Row>
        {project.description && (
          <Text
            variant="body-default-s"
            onBackground="neutral-weak"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {project.description}
          </Text>
        )}
      </Column>
    </>
  );

  return (
    <Card fillWidth direction="column" gap="12" padding="12" radius="l" border="neutral-alpha-weak">
      {project.href ? (
        // display:contents: el <a> no participa del layout flex de Card
        // (gap="12" entre portada y bloque de texto sigue intacto), solo
        // envuelve el DOM para que todo ese bloque navegue al click.
        <SmartLink href={project.href} unstyled style={{ display: "contents" }}>
          {linkableContent}
        </SmartLink>
      ) : (
        linkableContent
      )}
      <Row fillWidth horizontal="between" vertical="center" paddingX="4" paddingBottom="4">
        <Row gap="8" vertical="center">
          <Avatar {...avatarProps} size="s" />
          <Text variant="label-default-s" onBackground="neutral-weak">
            {project.designer}
          </Text>
        </Row>
        <Row gap="12" vertical="center">
          <Row gap="4" vertical="center">
            <Icon name="eye" size="xs" onBackground="neutral-weak" />
            <Text variant="label-default-s" onBackground="neutral-weak">
              {formatMetric(project.views)}
            </Text>
          </Row>
          <LikeMetric
            pieceId={project.id}
            initialLikes={project.likes}
            initialLiked={likedByViewer}
            isOwner={isOwner}
            isSignedIn={isSignedIn}
          />
        </Row>
      </Row>
    </Card>
  );
}

export function HomeShowcase({ pieces }: { pieces: ShowcasePiece[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [feedTab, setFeedTab] = useState(FEED_TABS[0]);
  const [order, setOrder] = useState<string>(ORDER_OPTIONS[0]);
  const [location, setLocation] = useState(ALL_LOCATIONS);

  // La home se sirve estática (revalidate=300, ver app/page.tsx) para no
  // pagar un roundtrip a Supabase por visita: NO puede depender de auth() en
  // el server sin perder ese cacheo. El estado de like del visitante se
  // resuelve aparte, en el cliente, después del montaje — mismo espíritu que
  // RegisterView (registra la vista sin bloquear el render). Antes de que
  // resuelva, toda tarjeta se ve como anónima/sin like (nunca como "likeada
  // a medias").
  const [viewerState, setViewerState] = useState<{ likedIds: Set<string>; viewerId: string | null }>(
    { likedIds: new Set(), viewerId: null },
  );

  useEffect(() => {
    let cancelled = false;
    getLikeState(pieces.map((p) => p.id)).then((result) => {
      if (cancelled) return;
      setViewerState({ likedIds: new Set(result.likedIds), viewerId: result.viewerId });
    });
    return () => {
      cancelled = true;
    };
  }, [pieces]);

  const categoryOptions = useMemo(
    () => [ALL_CATEGORIES, ...new Set(pieces.map((p) => p.tag))],
    [pieces],
  );
  const locationOptions = useMemo(
    () => [ALL_LOCATIONS, ...new Set(pieces.map((p) => p.location).filter((l): l is string => Boolean(l)))],
    [pieces],
  );

  const projects = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = pieces.filter((project) => {
      const matchesSearch =
        !query ||
        project.title.toLowerCase().includes(query) ||
        project.designer.toLowerCase().includes(query) ||
        project.tag.toLowerCase().includes(query);
      const matchesCategory = category === ALL_CATEGORIES || project.tag === category;
      const matchesLocation = location === ALL_LOCATIONS || project.location === location;
      return matchesSearch && matchesCategory && matchesLocation;
    });

    const sorted = [...filtered];
    if (order === "Más valorados") {
      sorted.sort((a, b) => b.likes - a.likes);
    } else if (order === "Más vistos") {
      sorted.sort((a, b) => b.views - a.views);
    }

    return sorted;
  }, [pieces, search, category, order, location]);

  return (
    <Column fillWidth gap="0">
      <RevealFx fillWidth>
        <Column fillWidth horizontal="center" align="center" paddingY="40" gap="24">
          <Row fillWidth horizontal="center">
            <SearchBarShell
              leading={<CategoryDropdown value={category} options={categoryOptions} onChange={setCategory} />}
              query={search}
              onQueryChange={setSearch}
              placeholder="Buscar proyectos, diseñadores, estilos…"
              ariaLabel="Buscar en el home"
            />
          </Row>
          <Row gap="12" horizontal="center" wrap>
            {SUGGESTED_SEARCHES.map((suggestion) => (
              <Tag key={suggestion} variant="neutral" label={suggestion} />
            ))}
          </Row>
        </Column>
      </RevealFx>

      <RevealFx fillWidth delay={0.1}>
        <Row
          fillWidth
          gap="16"
          horizontal="between"
          vertical="center"
          paddingY="16"
          borderBottom="neutral-alpha-weak"
          s={{ direction: "column", horizontal: "start" }}
        >
          <SegmentedControl
            selected={feedTab}
            onToggle={setFeedTab}
            buttons={FEED_TABS.map((tab) => ({ value: tab, label: tab }))}
          />
          <Row gap="24" vertical="center">
            <OrderDropdown value={order} onChange={setOrder} />
            <LocationDropdown value={location} options={locationOptions} onChange={setLocation} />
          </Row>
        </Row>
      </RevealFx>

      <RevealFx fillWidth delay={0.2}>
        <Grid
          columns={4}
          l={{ columns: 3 }}
          m={{ columns: 2 }}
          s={{ columns: 1 }}
          gap="24"
          paddingY="32"
          fillWidth
        >
          {projects.map((project) => (
            <ShowcaseCard
              key={project.id}
              project={project}
              likedByViewer={viewerState.likedIds.has(project.id)}
              isOwner={viewerState.viewerId !== null && project.userId === viewerState.viewerId}
              isSignedIn={viewerState.viewerId !== null}
            />
          ))}
        </Grid>
      </RevealFx>
    </Column>
  );
}
