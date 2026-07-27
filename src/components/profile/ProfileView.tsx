"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Arrow,
  Avatar,
  BlobFx,
  Button,
  Card,
  Column,
  ContextMenu,
  Dialog,
  DropdownWrapper,
  Feedback,
  Flex,
  Grid,
  Heading,
  HoloFx,
  Icon,
  IconButton,
  Line,
  Media,
  Option,
  RevealFx,
  Row,
  SegmentedControl,
  SmartLink,
  Switch,
  Tag,
  Text,
  TiltFx,
} from "@once-ui-system/core";
import type { ProjectStatus } from "@/lib/projectStatus";
import type { CollabProjectData, FreelancerConnectionData, SharedResourceData } from "@/lib/collab";
import { coverKindOf, extractYouTubeId, resolveCoverSrc } from "@/lib/coverMedia";
import type { IconName } from "@/resources/icons";
import { respondContactRequest } from "@/app/actions/collab";
import { RoleTag } from "@/components/RoleTag";
import { VideoCover } from "@/components/shared/VideoCover";
import { AvatarUploadDialog } from "./ClientProfileEditDialogs";
import {
  FeaturedImageUploadDialog,
  FreelancerEditInfoDialog,
} from "./FreelancerProfileEditDialogs";
import type { ProfileAppearanceValue } from "./AppearancePanel";
import { AppearanceScope } from "./AppearanceScope";
import { NewCollabProjectDialog, type ConnectionOption } from "./ClientCollabDialogs";
import { ContactFreelancerDialog } from "./FreelancerCollabDialogs";
import styles from "./ProfileView.module.scss";
import { deletePortfolioPiece, setPieceVisibility } from "@/app/actions/portfolioPieces";
import { CreateProjectModal } from "./CreateProjectModal";

export interface FreelancerProject {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  currency: string;
  total: number | null;
  updatedAt: string; // ISO string
}

export interface FreelancerPiece {
  id: string;
  title: string;
  // Descripción breve opcional (PortfolioPiece.description, máx. 140
  // caracteres); null cuando el Freelancer no la llenó.
  description: string | null;
  category: string;
  // Nula en piezas creadas desde el editor de Markdown (sin portada)
  coverUrl: string | null;
  views: number;
  likes: number;
  isPublic: boolean;
  // ISO string; usado para ordenar por "más recientes"
  createdAt: string;
  // Ruta al caso de estudio MDX (/<username>/proyecto/<slug>) cuando existe
  href?: string;
}

interface ProfileViewProps {
  displayName: string;
  avatarUrl?: string;
  isOwnProfile: boolean;
  username: string;
  whatsapp?: string | null;
  email?: string | null;
  memberSince?: string; // ISO string
  isPublic?: boolean;
  shareWhatsapp?: boolean;
  // Contenido de la tarjeta de Freelancer en Explorar (editable por el propio Freelancer)
  featuredImageUrl?: string | null;
  cardQuote?: string | null;
  headline?: string | null;
  bio?: string | null;
  // Matriz de roles (Fase 4): rol principal destacado + hasta 2 secundarios.
  primaryRole?: string | null;
  secondaryRoles?: string[];
  // Personalización de apariencia del perfil (editable por el propio Freelancer
  // vía updateProfileAppearance); null = default de la marca del sitio.
  profileBrand?: string | null;
  profileAccent?: string | null;
  profileNeutral?: string | null;
  profileBorder?: string | null;
  projects: FreelancerProject[];
  pieces: FreelancerPiece[];
  // Id de usuario del dueño del perfil (el freelancer); usado para que un
  // viewer client pueda enviarle una solicitud de contacto.
  freelancerId?: string;
  // Perfil propio del freelancer: panel de colaboración con clients.
  pendingRequests?: FreelancerConnectionData[];
  freelancerConnections?: FreelancerConnectionData[];
  collabProjects?: CollabProjectData[];
  sharedResources?: SharedResourceData[];
  // Perfil ajeno visto por un client logueado.
  viewerCanContact?: boolean;
  viewerConnectionStatus?: "PENDING" | "ACCEPTED" | "REJECTED" | null;
  // ?editar=1 en la URL (ver [username]/page.tsx): abre automáticamente el
  // modal "Editar información de perfil" al montar — usado por el menú del
  // avatar del Header ("Editar Perfil").
  openEditOnMount?: boolean;
}

const IN_PROGRESS: ProjectStatus[] = ["draft", "sent", "active"];

const COLLAB_PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
};

const COLLAB_PROJECT_STATUS_VARIANTS: Record<string, "neutral" | "warning" | "success"> = {
  active: "warning",
  completed: "success",
  archived: "neutral",
};

const PROVIDER_LABELS: Record<string, string> = {
  drive: "Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  wetransfer: "WeTransfer",
  other: "Link",
};

const ALL_CATEGORIES = "Todos";

// Long-press táctil para el ContextMenu del panel administrativo de piezas.
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

const SORT_OPTIONS: Array<{
  value: "recent" | "popular";
  label: string;
  description: string;
  icon: IconName;
}> = [
  {
    value: "recent",
    label: "Más recientes",
    description: "Ordenar por fecha de publicación",
    icon: "calendar",
  },
  {
    value: "popular",
    label: "Más populares",
    description: "Ordenar por vistas y likes",
    icon: "heart",
  },
];

function waLink(whatsapp: string) {
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
}

function formatTotal(total: number | null, currency: string) {
  if (total === null) return "Por definir";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(total);
}

function formatMemberSince(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
}

function formatCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${value}`;
}

// Tarjeta de pieza publicada. Para visitantes toda la tarjeta enlaza al caso
// de estudio; para el dueño solo la portada enlaza, dejando el switch de
// visibilidad (público ↔ borrador) operable sin navegar. El dueño también
// puede clic-derecho (o mantener presionado en táctil) para editar/ocultar/
// eliminar vía ContextMenu.
function PieceCard({
  piece,
  isOwnProfile,
  onEdit,
  onRequestDelete,
}: {
  piece: FreelancerPiece;
  isOwnProfile: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
}) {
  const [isPublic, setIsPublic] = useState(piece.isPublic);
  const [saving, setSaving] = useState(false);

  const toggleVisibility = async () => {
    const next = !isPublic;
    setIsPublic(next);
    setSaving(true);
    try {
      await setPieceVisibility(piece.id, next);
    } catch {
      setIsPublic(!next);
    } finally {
      setSaving(false);
    }
  };

  // Detección robusta de pulsación prolongada táctil (el "contextmenu" nativo
  // no dispara de forma consistente en móvil/tablet): un timer ~500ms que se
  // cancela si el dedo se mueve más de ~10px, y que al cumplirse despacha un
  // evento "contextmenu" sintético en el punto del toque para reutilizar el
  // mismo listener del ContextMenu (clic derecho en desktop queda intacto).
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  const longPressFired = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isOwnProfile) return;
    const touch = event.touches[0];
    if (!touch) return;
    touchOrigin.current = { x: touch.clientX, y: touch.clientY };
    longPressFired.current = false;
    clearLongPressTimer();
    const target = event.currentTarget;
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      const origin = touchOrigin.current;
      target.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: origin?.x ?? 0,
          clientY: origin?.y ?? 0,
        }),
      );
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    const origin = touchOrigin.current;
    if (!touch || !origin) return;
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_THRESHOLD) {
      clearLongPressTimer();
    }
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    clearLongPressTimer();
    if (longPressFired.current) {
      // Evita que el tap que soltó el long-press dispare la navegación normal
      // (SmartLink de la portada) inmediatamente después de abrir el menú.
      event.preventDefault();
    }
  };

  // Portada de video (link de YouTube o archivo .mp4/data URL, ver
  // lib/coverMedia): reproduce de verdad, silenciosa y en loop (ver
  // componente compartido VideoCover). Sin portada en absoluto (piezas del
  // editor de Markdown) conserva el placeholder de documento.
  const coverKind = coverKindOf(piece.coverUrl);
  const coverSrc = resolveCoverSrc(piece.coverUrl);
  const youtubeId = coverKind === "video" ? extractYouTubeId(coverSrc) : null;
  const cover =
    coverKind === "video" ? (
      <VideoCover
        youtubeId={youtubeId}
        src={coverSrc}
        alt={piece.title}
        aspectRatio="4 / 3"
        background="neutral-alpha-weak"
      />
    ) : coverKind ? (
      <Column fillWidth radius="m" overflow="hidden" style={{ aspectRatio: "4 / 3" }}>
        <Media
          src={coverSrc}
          alt={piece.title}
          fill
          fillHeight
          objectFit="cover"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      </Column>
    ) : (
      <Column
        fillWidth
        radius="m"
        background="neutral-alpha-weak"
        style={{ aspectRatio: "4 / 3" }}
        horizontal="center"
        vertical="center"
      >
        <Icon name="document" size="l" onBackground="neutral-weak" />
      </Column>
    );

  const card = (
    <Card
      href={isOwnProfile ? undefined : piece.href}
      fillWidth
      minWidth={0}
      direction="column"
      gap="12"
      padding="12"
      radius="l"
      border="neutral-alpha-weak"
      transition="macro-medium"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={clearLongPressTimer}
      style={
        isOwnProfile
          ? {
              WebkitTouchCallout: "none",
              WebkitUserSelect: "none",
              userSelect: "none",
            }
          : undefined
      }
    >
      {isOwnProfile && piece.href ? (
        <SmartLink unstyled fillWidth href={piece.href}>
          {cover}
        </SmartLink>
      ) : (
        cover
      )}
      <Column fillWidth gap="8" paddingX="4" paddingBottom="4">
        <Row fillWidth horizontal="between" vertical="start" gap="8">
          <Text
            variant="heading-strong-s"
            onBackground="neutral-strong"
            wrap="balance"
            style={{
              minWidth: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {piece.title}
          </Text>
          <Tag size="s" label={piece.category} variant="neutral" />
        </Row>
        {piece.description && (
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
            {piece.description}
          </Text>
        )}
        <Row fillWidth horizontal="between" vertical="center" gap="12">
          <Row gap="12" vertical="center" minWidth={0}>
            <Row gap="4" vertical="center">
              <Icon name="eye" size="xs" onBackground="neutral-weak" />
              <Text variant="label-default-s" onBackground="neutral-weak">
                {formatCount(piece.views)}
              </Text>
            </Row>
            <Row gap="4" vertical="center">
              <Icon name="heart" size="xs" onBackground="neutral-weak" />
              <Text variant="label-default-s" onBackground="neutral-weak">
                {formatCount(piece.likes)}
              </Text>
            </Row>
          </Row>
          {isOwnProfile && (
            <Row gap="8" vertical="center" minWidth={0}>
              <Text variant="label-default-s" onBackground="neutral-weak" style={{ minWidth: 0 }}>
                {isPublic ? "Público" : "Borrador"}
              </Text>
              <Switch
                isChecked={isPublic}
                onToggle={toggleVisibility}
                loading={saving}
                ariaLabel={`Visibilidad de ${piece.title}`}
                style={{ flexShrink: 0 }}
              />
            </Row>
          )}
        </Row>
      </Column>
    </Card>
  );

  if (!isOwnProfile) return card;

  return (
    <ContextMenu
      fillWidth
      style={{ minWidth: 0 }}
      placement="bottom-start"
      onSelect={(value) => {
        if (value === "edit") onEdit();
        else if (value === "toggle") toggleVisibility();
        else if (value === "delete") onRequestDelete();
      }}
      dropdown={
        <Column minWidth={14} padding="4" gap="2">
          <Option
            label="Editar"
            value="edit"
            hasPrefix={<Icon name="edit" size="s" onBackground="neutral-weak" />}
          />
          <Option
            label={isPublic ? "Ocultar" : "Mostrar"}
            value="toggle"
            hasPrefix={
              <Icon name={isPublic ? "eyeOff" : "eye"} size="s" onBackground="neutral-weak" />
            }
          />
          <Option
            label="Eliminar"
            value="delete"
            danger
            hasPrefix={<Icon name="trash" size="s" onBackground="danger-strong" />}
          />
        </Column>
      }
    >
      {card}
    </ContextMenu>
  );
}

// Reordenamiento minimalista de piezas: un Arrow decorativo (sin fondo, "Simple
// usage") que resalta al hover del trigger y despliega, vía DropdownWrapper, un
// menú con las opciones de orden (icono + texto explicativo por opción).
function PiecesSortMenu({
  value,
  onChange,
}: {
  value: "recent" | "popular";
  onChange: (value: "recent" | "popular") => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((option) => option.value === value) ?? SORT_OPTIONS[0];

  return (
    <DropdownWrapper
      isOpen={open}
      onOpenChange={setOpen}
      minWidth={14}
      placement="bottom-end"
      trigger={
        <Row
          id="pieces-sort-trigger"
          gap="8"
          vertical="center"
          paddingX="4"
          style={{ cursor: "pointer" }}
        >
          <Text variant="label-default-s" onBackground="neutral-strong">
            {current.label}
          </Text>
          <Arrow trigger="#pieces-sort-trigger" scale={0.6} />
        </Row>
      }
      dropdown={
        <Column minWidth={14} padding="4" gap="2">
          {SORT_OPTIONS.map((option) => (
            <Option
              key={option.value}
              label={option.label}
              description={option.description}
              value={option.value}
              selected={option.value === value}
              hasPrefix={<Icon name={option.icon} size="s" onBackground="neutral-weak" />}
              onClick={(nextValue) => {
                onChange(nextValue as "recent" | "popular");
                setOpen(false);
              }}
            />
          ))}
        </Column>
      }
    />
  );
}

// Fila de un proyecto en colaboración con un client: estatus y tareas en
// revisión esperando la aprobación del client, con click al detalle.
function CollabProjectRow({ project }: { project: CollabProjectData }) {
  const router = useRouter();
  const pendingReview = project.tasks.filter((task) => task.status === "in_review").length;

  return (
    <Row
      fillWidth
      paddingX="16"
      paddingY="12"
      horizontal="between"
      vertical="center"
      gap="16"
      style={{ cursor: "pointer" }}
      onClick={() => router.push(`/proyectos/${project.id}`)}
    >
      <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
        <Icon name="folder" size="s" onBackground="neutral-weak" />
        <Text
          variant="label-default-s"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {project.title}
        </Text>
      </Row>
      <Row gap="8" vertical="center">
        {pendingReview > 0 && (
          <Tag size="s" variant="warning" label={`${pendingReview} esperando al client`} />
        )}
        <Tag
          size="s"
          variant={COLLAB_PROJECT_STATUS_VARIANTS[project.status] ?? "neutral"}
          label={COLLAB_PROJECT_STATUS_LABELS[project.status] ?? project.status}
        />
      </Row>
    </Row>
  );
}

// Solicitud de contacto pendiente de un client: aceptar o rechazar.
function PendingRequestRow({ request }: { request: FreelancerConnectionData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { client } = request;

  const respond = async (accept: boolean) => {
    setBusy(true);
    setError(null);
    const result = await respondContactRequest(request.id, accept);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  };

  return (
    <Column fillWidth gap="4">
      <Row fillWidth horizontal="between" vertical="center" gap="12">
        <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
          <Avatar
            size="s"
            {...(client.imageUrl
              ? { src: client.imageUrl }
              : { value: (client.name?.[0] ?? "C").toUpperCase() })}
          />
          <Column gap="2" style={{ minWidth: 0 }}>
            <Text
              variant="label-default-s"
              onBackground="neutral-strong"
              style={{ minWidth: 0, overflowWrap: "anywhere" }}
            >
              {client.name ?? client.username ?? "Client"}
            </Text>
            {request.message && (
              <Text
                variant="label-default-s"
                onBackground="neutral-weak"
                style={{ minWidth: 0, overflowWrap: "anywhere" }}
              >
                {request.message}
              </Text>
            )}
          </Column>
        </Row>
        <Row gap="4" vertical="center">
          <IconButton
            icon="check"
            size="s"
            variant="success"
            tooltip="Aceptar"
            tooltipPosition="top"
            loading={busy}
            disabled={busy}
            onClick={() => respond(true)}
          />
          <IconButton
            icon="xCircle"
            size="s"
            variant="danger"
            tooltip="Rechazar"
            tooltipPosition="top"
            loading={busy}
            disabled={busy}
            onClick={() => respond(false)}
          />
        </Row>
      </Row>
      {error && <Feedback variant="danger" description={error} />}
    </Column>
  );
}

// Recurso que un client compartió con este freelancer: solo lectura.
function SharedResourceRow({ resource }: { resource: SharedResourceData }) {
  return (
    <Row fillWidth horizontal="between" vertical="center" gap="12">
      <Column gap="2" style={{ minWidth: 0 }}>
        <Text
          variant="label-default-s"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {resource.label}
        </Text>
        <Text variant="label-default-s" onBackground="neutral-weak">
          {resource.owner.name ?? resource.owner.username ?? "Client"}
        </Text>
      </Column>
      <Row gap="8" vertical="center">
        <Tag size="s" variant="neutral" label={PROVIDER_LABELS[resource.provider] ?? "Link"} />
        <IconButton
          icon="arrowUpRightFromSquare"
          size="s"
          variant="tertiary"
          href={resource.url}
          target="_blank"
          rel="noopener noreferrer"
          tooltip="Abrir en nueva pestaña"
          tooltipPosition="top"
        />
      </Row>
    </Row>
  );
}

// Versión reducida (sin flip/cita) de la tarjeta de Freelancer de Explorar, usada
// como cabecera del perfil en vez de la portada de ancho completo. El avatar
// se superpone sobre su borde inferior (ver marginTop: -48px debajo) y queda
// fuera del TiltFx, así que permanece estático mientras la tarjeta se inclina.
// La imagen se cambia desde el modal "Editar información de perfil" →
// "Tarjeta de Freelancer" → "Cambiar imagen" (FreelancerEditInfoDialog).
function ProfileDesignerCard({
  featuredImageUrl,
  avatarUrl,
}: {
  featuredImageUrl?: string | null;
  avatarUrl?: string;
}) {
  const imageSrc = featuredImageUrl || avatarUrl || null;

  return (
    <TiltFx fillWidth radius="l">
      <Column
        fillWidth
        radius="l"
        overflow="hidden"
        background="neutral-alpha-weak"
        style={{ aspectRatio: "3 / 4" }}
      >
        {imageSrc ? (
          <HoloFx position="absolute" top="0" left="0" fill radius="l">
            <Media
              src={imageSrc}
              alt=""
              fill
              fillHeight
              objectFit="cover"
              sizes="(max-width: 768px) 100vw, 320px"
            />
          </HoloFx>
        ) : (
          <BlobFx seed={0} position="absolute" top="0" left="0" fill fillHeight opacity={40} />
        )}
      </Column>
    </TiltFx>
  );
}

export function ProfileView({
  displayName,
  avatarUrl,
  isOwnProfile,
  username,
  whatsapp,
  email,
  memberSince,
  isPublic = true,
  shareWhatsapp = false,
  featuredImageUrl,
  cardQuote,
  headline,
  bio,
  primaryRole,
  secondaryRoles = [],
  profileBrand,
  profileAccent,
  profileNeutral,
  profileBorder,
  projects,
  pieces,
  freelancerId,
  pendingRequests = [],
  freelancerConnections = [],
  collabProjects = [],
  sharedResources = [],
  viewerCanContact = false,
  viewerConnectionStatus = null,
  openEditOnMount = false,
}: ProfileViewProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<string>(ALL_CATEGORIES);
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");
  const [openDialog, setOpenDialog] = useState<
    "avatar" | "info" | "featured" | null
  >(null);

  // Apertura automática del modal de edición al llegar con ?editar=1 (menú
  // del avatar del Header → "Editar Perfil"). Solo al montar: un cambio
  // posterior de la prop (no debería ocurrir, la página no revalida sola)
  // no debe reabrir el modal si el dueño ya lo cerró.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe correr al montar.
  useEffect(() => {
    if (isOwnProfile && openEditOnMount) {
      setOpenDialog("info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editPieceId, setEditPieceId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<FreelancerPiece | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [collabDialogOpen, setCollabDialogOpen] = useState(false);

  // Apariencia del DUEÑO del perfil (marca/acento/neutro). Arranca en los
  // valores guardados en BD (props) y, cuando isOwnProfile, se sobre-escribe
  // en vivo con el preview del AppearancePanel mientras el Freelancer edita
  // (ver onPreviewAppearanceChange más abajo) — sin esperar a guardar. El
  // efecto re-sincroniza con las props cada vez que cambian (tras
  // router.refresh() al guardar, o al abrir el perfil de otro Freelancer).
  // profileBorder queda inerte a propósito (ver AppearancePanel.tsx): los
  // bordes de /explorar/freelancers no se personalizan.
  const savedAppearance: ProfileAppearanceValue = {
    brand: profileBrand ?? null,
    accent: profileAccent ?? null,
    neutral: profileNeutral ?? null,
  };
  const [appearance, setAppearance] = useState<ProfileAppearanceValue>(savedAppearance);
  useEffect(() => {
    setAppearance(savedAppearance);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileBrand, profileAccent, profileNeutral]);

  const collabProjectOptions: ConnectionOption[] = freelancerConnections.map((connection) => ({
    value: connection.id,
    label: connection.client.name ?? connection.client.username ?? "Client",
  }));

  const closeCreateModal = () => {
    setCreateOpen(false);
    setEditPieceId(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePortfolioPiece(deleteCandidate.id);
      setDeleteCandidate(null);
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar el proyecto.");
    } finally {
      setDeleting(false);
    }
  };

  const initials = (displayName[0] ?? "U").toUpperCase();
  const avatarProps = avatarUrl ? { src: avatarUrl } : { value: initials };

  const inProgress = projects.filter((p) => IN_PROGRESS.includes(p.status as ProjectStatus));
  const completed = projects.filter((p) => p.status === "completed");
  const clients = new Set(projects.map((p) => p.clientName).filter(Boolean));
  const billed = projects.reduce((sum, p) => sum + (p.total ?? 0), 0);

  const categories = [ALL_CATEGORIES, ...new Set(pieces.map((p) => p.category))];
  const visiblePieces =
    filter === ALL_CATEGORIES ? pieces : pieces.filter((p) => p.category === filter);
  const sortedPieces =
    sortBy === "popular"
      ? [...visiblePieces].sort((a, b) => b.likes - a.likes)
      : [...visiblePieces].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );

  const metrics = [
    { label: "En curso", value: String(inProgress.length) },
    { label: "Completados", value: String(completed.length) },
    { label: "Clients", value: String(clients.size) },
    // Monto facturado: solo visible para el dueño del perfil.
    ...(isOwnProfile
      ? [{ label: "Facturado", value: formatTotal(billed, projects[0]?.currency ?? "MXN") }]
      : []),
  ];

  return (
    <AppearanceScope appearance={appearance}>
    <RevealFx fillWidth horizontal="center" revealedByDefault>
      <Column
        fillWidth
        maxWidth="l"
        horizontal="center"
        paddingBottom="80"
      >
        <Column fillWidth paddingX="32" paddingTop="24" gap="0">

          {/* ── Layout de grilla: identidad + proyectos comparten el mismo track ── */}
          <Grid
            columns={4}
            m={{ columns: 3 }}
            s={{ columns: 1 }}
            gap="20"
            fillWidth
            transition="macro-medium"
          >

            {/* Columna izquierda — identidad, contacto y métricas */}
            <Column gap="24" fillWidth minWidth={0}>
              <Column gap="0" fillWidth>
                <ProfileDesignerCard
                  featuredImageUrl={featuredImageUrl}
                  avatarUrl={avatarUrl}
                />

                <Flex fillWidth horizontal="center" style={{ marginTop: "-48px" }}>
                  {isOwnProfile ? (
                    <button
                      type="button"
                      className={styles.avatarButton}
                      aria-label="Cambiar imagen de perfil"
                      onClick={() => setOpenDialog("avatar")}
                    >
                      <Avatar {...avatarProps} size="xl" />
                      <span className={styles.avatarEdit}>
                        <Icon name="edit" size="s" />
                      </span>
                    </button>
                  ) : (
                    <Avatar {...avatarProps} size="xl" />
                  )}
                </Flex>
              </Column>

              <Column gap="8" fillWidth horizontal="center">
                <Heading variant="heading-strong-l" align="center">
                  {displayName}
                </Heading>
                <Row fillWidth gap="8" vertical="center" horizontal="center">
                  <Text variant="body-default-m" onBackground="neutral-weak">
                    @{username}
                  </Text>
                </Row>
                {(primaryRole || secondaryRoles.length > 0) && (
                  <Row fillWidth gap="8" wrap horizontal="center" vertical="center">
                    {primaryRole && <RoleTag role={primaryRole} variant="primary" />}
                    {secondaryRoles.map((role) => (
                      <RoleTag key={role} role={role} variant="secondary" />
                    ))}
                  </Row>
                )}
                {memberSince && (
                  <Row fillWidth gap="8" vertical="center" horizontal="center">
                    <Icon name="calendar" size="s" onBackground="neutral-weak" />
                    <Text variant="body-default-m" onBackground="neutral-weak">
                      Freelancer desde {formatMemberSince(memberSince)}
                    </Text>
                  </Row>
                )}
                {isOwnProfile && email && (
                  <Row fillWidth gap="8" vertical="center" horizontal="center" style={{ minWidth: 0 }}>
                    <Icon name="email" size="s" onBackground="neutral-weak" />
                    {/* Ellipsis en vez de quiebre a media palabra ("hubnerds.co m") */}
                    <Text
                      variant="body-default-m"
                      onBackground="neutral-weak"
                      title={email}
                      style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                    >
                      {email}
                    </Text>
                  </Row>
                )}
              </Column>

              {isOwnProfile ? (
                <Column gap="8" fillWidth>
                  <Button fillWidth variant="primary" href="/dashboard/freelancer">
                    Ir a mi panel
                  </Button>
                  <Button fillWidth variant="secondary" onClick={() => setOpenDialog("info")}>
                    Editar información de perfil
                  </Button>
                </Column>
              ) : (
                <Column gap="8" fillWidth>
                  {whatsapp && (
                    <Button fillWidth variant="primary" href={waLink(whatsapp)} prefixIcon="whatsapp">
                      Contactar por WhatsApp
                    </Button>
                  )}
                  {viewerCanContact && viewerConnectionStatus === "ACCEPTED" && (
                    <Tag size="m" variant="success" label="Ya colaboran" />
                  )}
                  {viewerCanContact && viewerConnectionStatus === "PENDING" && (
                    <Button fillWidth variant="secondary" disabled prefixIcon="check">
                      Solicitud enviada
                    </Button>
                  )}
                  {viewerCanContact &&
                    (viewerConnectionStatus === null || viewerConnectionStatus === "REJECTED") && (
                      <Button
                        fillWidth
                        variant={whatsapp ? "secondary" : "primary"}
                        prefixIcon="userGroup"
                        onClick={() => setContactDialogOpen(true)}
                      >
                        Contactar
                      </Button>
                    )}
                </Column>
              )}

              <Flex
                background="neutral-alpha-weak"
                padding="16"
                radius="m"
                border="neutral-alpha-weak"
                direction="column"
                gap="12"
              >
                {metrics.map((metric) => (
                  <Row key={metric.label} fillWidth horizontal="between">
                    <Text variant="label-default-s" onBackground="neutral-weak" style={{ minWidth: 0 }}>
                      {metric.label}
                    </Text>
                    <Text variant="label-strong-s" style={{ minWidth: 0 }}>{metric.value}</Text>
                  </Row>
                ))}
              </Flex>

              {clients.size > 0 && (
                <Flex
                  background="neutral-alpha-weak"
                  padding="16"
                  radius="m"
                  border="neutral-alpha-weak"
                  direction="column"
                  gap="12"
                >
                  <Text variant="label-strong-s">Clients</Text>
                  <Column gap="12">
                    {[...clients].map((client) => (
                      <Row key={client} gap="12" vertical="center">
                        <Avatar value={(client as string)[0].toUpperCase()} size="s" radius="s" />
                        <Text
                          variant="label-default-s"
                          onBackground="neutral-strong"
                          style={{ minWidth: 0 }}
                        >
                          {client}
                        </Text>
                      </Row>
                    ))}
                  </Column>
                </Flex>
              )}

              {/* ── Colaboración con clients (solo perfil propio) ─────────── */}
              {isOwnProfile && pendingRequests.length > 0 && (
                <Column
                  background="neutral-alpha-weak"
                  border="neutral-alpha-weak"
                  padding="16"
                  radius="m"
                  gap="12"
                  fillWidth
                >
                  <Row gap="8" vertical="center">
                    <Icon name="userGroup" size="s" onBackground="neutral-weak" />
                    <Text variant="label-strong-s">Solicitudes de contacto</Text>
                  </Row>
                  {pendingRequests.map((request, index) => (
                    <Column key={request.id} fillWidth gap="12">
                      {index > 0 && <Line background="neutral-alpha-weak" />}
                      <PendingRequestRow request={request} />
                    </Column>
                  ))}
                </Column>
              )}

              {isOwnProfile && (
                <Column
                  background="neutral-alpha-weak"
                  border="neutral-alpha-weak"
                  padding="16"
                  radius="m"
                  gap="12"
                  fillWidth
                >
                  <Row fillWidth horizontal="between" vertical="center" gap="8">
                    <Row gap="8" vertical="center">
                      <Icon name="folder" size="s" onBackground="neutral-weak" />
                      <Text variant="label-strong-s">Proyectos con clients</Text>
                    </Row>
                    {freelancerConnections.length > 0 && (
                      <IconButton
                        icon="plus"
                        size="s"
                        variant="tertiary"
                        tooltip="Nuevo proyecto"
                        tooltipPosition="top"
                        onClick={() => setCollabDialogOpen(true)}
                      />
                    )}
                  </Row>
                  {collabProjects.length === 0 ? (
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Todavía no tienes proyectos conjuntos con clients.
                    </Text>
                  ) : (
                    <Column fillWidth border="neutral-alpha-medium" radius="m" overflow="hidden">
                      {collabProjects.map((project, index) => (
                        <Column key={project.id} fillWidth>
                          {index > 0 && <Line background="neutral-alpha-weak" />}
                          <CollabProjectRow project={project} />
                        </Column>
                      ))}
                    </Column>
                  )}
                </Column>
              )}

              {isOwnProfile && sharedResources.length > 0 && (
                <Column
                  background="neutral-alpha-weak"
                  border="neutral-alpha-weak"
                  padding="16"
                  radius="m"
                  gap="12"
                  fillWidth
                >
                  <Row gap="8" vertical="center">
                    <Icon name="download" size="s" onBackground="neutral-weak" />
                    <Text variant="label-strong-s">Recursos compartidos contigo</Text>
                  </Row>
                  <Column gap="12">
                    {sharedResources.map((resource) => (
                      <SharedResourceRow key={resource.id} resource={resource} />
                    ))}
                  </Column>
                </Column>
              )}
            </Column>

            {/* Columna derecha — showcase de proyectos reales */}
            <Column gap="24" fillWidth className={styles.projectsSpan}>
              <Row fillWidth gap="12" wrap horizontal="between" vertical="center">
                <SegmentedControl
                  selected={filter}
                  onToggle={setFilter}
                  buttons={categories.map((c) => ({ value: c, label: c }))}
                />
                <PiecesSortMenu value={sortBy} onChange={setSortBy} />
              </Row>

              {isOwnProfile && pieces.length > 0 && (
                <Flex background="brand-alpha-weak" padding="20" radius="m" fillWidth vertical="center" gap="16">
                  <Icon name="edit" size="m" onBackground="brand-strong" />
                  <Column gap="4">
                    <Text variant="heading-strong-s">Administra tus proyectos</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Haz clic derecho sobre una tarjeta (o mantén presionado en pantallas táctiles) para editarla, ocultarla o eliminarla.
                    </Text>
                  </Column>
                </Flex>
              )}

              {visiblePieces.length === 0 && !isOwnProfile ? (
                <Column fillWidth horizontal="center" gap="12" padding="48" border="neutral-alpha-medium" radius="l">
                  <Icon name="sparkles" size="l" onBackground="neutral-weak" />
                  <Text variant="body-default-m" onBackground="neutral-weak" align="center">
                    Sin piezas publicadas en esta vista.
                  </Text>
                </Column>
              ) : (
                <Grid
                  columns={3}
                  m={{ columns: 2 }}
                  s={{ columns: 1 }}
                  gap="20"
                  fillWidth
                  transition="macro-medium"
                >
                  {/* Tarjeta de acción "Publicar proyecto" */}
                  {isOwnProfile && (
                    <Flex
                      role="button"
                      tabIndex={0}
                      // Anclaje del tour de bienvenida (TOUR_STOPS.target).
                      data-tour="add-project"
                      onClick={() => setCreateOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setCreateOpen(true);
                      }}
                      fillWidth
                      minWidth={0}
                      border="neutral-medium"
                      radius="l"
                      style={{ borderStyle: "dashed", cursor: "pointer" }}
                      center
                      padding="32"
                      direction="column"
                      gap="12"
                    >
                      <Icon name="plus" size="l" onBackground="neutral-weak" />
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        Publicar proyecto
                      </Text>
                    </Flex>
                  )}

                  {sortedPieces.map((piece) => (
                    <PieceCard
                      key={piece.id}
                      piece={piece}
                      isOwnProfile={isOwnProfile}
                      onEdit={() => {
                        setEditPieceId(piece.id);
                        setCreateOpen(true);
                      }}
                      onRequestDelete={() => {
                        setDeleteError(null);
                        setDeleteCandidate(piece);
                      }}
                    />
                  ))}
                </Grid>
              )}
            </Column>

          </Grid>
        </Column>

        {isOwnProfile && (
          <>
            <AvatarUploadDialog
              isOpen={openDialog === "avatar"}
              onClose={() => setOpenDialog(null)}
              currentImageUrl={avatarUrl}
            />
            <FreelancerEditInfoDialog
              isOpen={openDialog === "info"}
              onClose={() => setOpenDialog(null)}
              initialIsPublic={isPublic}
              initialShareWhatsapp={shareWhatsapp}
              initial={{
                cardQuote: cardQuote ?? "",
                headline: headline ?? "",
                bio: bio ?? "",
              }}
              initialPrimaryRole={primaryRole}
              initialSecondaryRoles={secondaryRoles}
              initialAppearance={savedAppearance}
              onPreviewAppearanceChange={setAppearance}
              avatarUrl={avatarUrl}
              displayName={displayName}
              username={username}
              featuredImageUrl={featuredImageUrl}
              onOpenAvatar={() => setOpenDialog("avatar")}
              onOpenFeatured={() => setOpenDialog("featured")}
            />
            <FeaturedImageUploadDialog
              isOpen={openDialog === "featured"}
              onClose={() => setOpenDialog(null)}
              currentFeaturedUrl={featuredImageUrl}
            />
            <NewCollabProjectDialog
              isOpen={collabDialogOpen}
              onClose={() => setCollabDialogOpen(false)}
              options={collabProjectOptions}
            />
          </>
        )}

        {!isOwnProfile && viewerCanContact && freelancerId && (
          <ContactFreelancerDialog
            isOpen={contactDialogOpen}
            onClose={() => setContactDialogOpen(false)}
            freelancerId={freelancerId}
            freelancerName={displayName}
          />
        )}
      </Column>

      {isOwnProfile && (
        <>
          <CreateProjectModal isOpen={isCreateOpen} onClose={closeCreateModal} pieceId={editPieceId} />

          <Dialog
            isOpen={deleteCandidate !== null}
            onClose={() => !deleting && setDeleteCandidate(null)}
            title="¿Eliminar este proyecto?"
            footer={
              <Row fillWidth gap="8" horizontal="end">
                <Button
                  variant="secondary"
                  size="m"
                  onClick={() => setDeleteCandidate(null)}
                  disabled={deleting}
                >
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  size="m"
                  onClick={handleConfirmDelete}
                  loading={deleting}
                >
                  Sí, eliminar
                </Button>
              </Row>
            }
          >
            <Column gap="16" fillWidth>
              <Feedback
                variant="danger"
                icon
                description="Esta acción no se puede deshacer. El proyecto y todo su contenido se eliminarán permanentemente."
              />
              {deleteCandidate && (
                <Text variant="body-default-m">
                  Vas a eliminar <strong>{deleteCandidate.title}</strong>.
                </Text>
              )}
              {deleteError && <Feedback variant="danger" description={deleteError} />}
            </Column>
          </Dialog>
        </>
      )}
    </RevealFx>
    </AppearanceScope>
  );
}
