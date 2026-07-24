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
import { useMemo, useState } from "react";
import { SearchBarShell } from "@/components/explore/SearchBarShell";
import { VideoCover } from "@/components/shared/VideoCover";
import { coverKindOf, extractYouTubeId, resolveCoverSrc } from "@/lib/coverMedia";

const SUGGESTED_SEARCHES = ["Diseño Gráfico", "Animación", "Branding"];

const FEED_TABS = ["Para ti", "Descubrir", "Proyectos"];

const ORDER_OPTIONS = ["Más valorados", "Más recientes", "Más vistos"] as const;

export type ShowcasePiece = {
  id: string;
  title: string;
  // Descripción breve opcional (PortfolioPiece.description, máx. 140
  // caracteres); null cuando el Partner no la llenó.
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

function ShowcaseCard({ project }: { project: ShowcasePiece }) {
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

  const card = (
    <Card fillWidth direction="column" gap="12" padding="12" radius="l" border="neutral-alpha-weak">
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
      <Column fillWidth gap="8" paddingX="4" paddingBottom="4">
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
        <Row fillWidth horizontal="between" vertical="center">
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
            <Row gap="4" vertical="center">
              <Icon name="sparkle" size="xs" onBackground="neutral-weak" />
              <Text variant="label-default-s" onBackground="neutral-weak">
                {formatMetric(project.likes)}
              </Text>
            </Row>
          </Row>
        </Row>
      </Column>
    </Card>
  );

  if (!project.href) return card;

  return (
    <SmartLink href={project.href} unstyled style={{ width: "100%" }}>
      {card}
    </SmartLink>
  );
}

export function HomeShowcase({ pieces }: { pieces: ShowcasePiece[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [feedTab, setFeedTab] = useState(FEED_TABS[0]);
  const [order, setOrder] = useState<string>(ORDER_OPTIONS[0]);
  const [location, setLocation] = useState(ALL_LOCATIONS);

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
    // background="page" (opaco, no "surface"): esta sección tiene controles
    // densos (buscador, tabs, filtros) que necesitan legibilidad garantizada
    // sobre el video de fondo del home, no solo un tinte translúcido.
    <Column fillWidth gap="0" background="page" radius="l" paddingX="24">
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
            <ShowcaseCard key={project.id} project={project} />
          ))}
        </Grid>
      </RevealFx>
    </Column>
  );
}
