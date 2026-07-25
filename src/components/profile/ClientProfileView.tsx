"use client";

import {
  Avatar,
  Button,
  Card,
  Column,
  ContextMenu,
  Feedback,
  Heading,
  Icon,
  IconButton,
  Line,
  Option,
  RevealFx,
  Row,
  Tag,
  Text,
} from "@once-ui-system/core";
import { LinearGauge } from "@once-ui-system/core/modules";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useState } from "react";
import { sendContactRequest } from "@/app/actions/collab";
import {
  CollaboratorSearchModal,
  type CollaboratorSearchPerson,
} from "@/components/collab/CollaboratorSearchModal";
import { RESOURCE_CATEGORY_SLUGS } from "@/components/resources/categories";
import type {
  ClientConnectionData,
  ClientResourceData,
  CollabFreelancerSummary,
  CollabProjectData,
} from "@/lib/collab";
import {
  type ProjectStatus,
  projectStatusTag,
  TASK_STATUS_LABELS,
  TASK_STATUS_VARIANTS,
} from "@/lib/projectStatus";
import {
  AddClientResourceDialog,
  type ConnectionOption,
  DeleteClientResourceDialog,
  NewCollabProjectDialog,
  type ShareableFreelancer,
  ShareClientResourceDialog,
} from "./ClientCollabDialogs";
import {
  AvatarUploadDialog,
  EditInfoDialog,
  type EditProfileInitial,
  SecurityPrivacyDialog,
} from "./ClientProfileEditDialogs";
import styles from "./ClientProfileView.module.scss";

export interface ClientProject {
  id: string;
  title: string;
  status: string;
  currency: string;
  total: number | null;
  updatedAt: string; // ISO string
}

interface ClientProfileViewProps {
  displayName: string;
  avatarUrl?: string;
  isOwnProfile: boolean;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  whatsapp?: string | null;
  secondaryEmail?: string | null;
  address?: string | null;
  company?: string | null;
  brand?: string | null;
  motto?: string | null;
  contactPreference?: string | null;
  contactHours?: string | null;
  website?: string | null;
  industry?: string | null;
  projects: ClientProject[];
  connections?: ClientConnectionData[];
  collabProjects?: CollabProjectData[];
  resources?: ClientResourceData[];
  // Freelancers públicos aún sin Connection con este client, para el buscador
  // de "Buscar más talento" (CollaboratorSearchModal).
  discoverableFreelancers?: CollaboratorSearchPerson[];
  // ?editar=1 en la URL (ver [username]/page.tsx): abre automáticamente el
  // modal "Editar perfil" al montar — usado por el menú del avatar del
  // Header ("Editar Perfil").
  openEditOnMount?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  drive: "Drive",
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  wetransfer: "WeTransfer",
  other: "Link",
};

const IN_PROGRESS: ProjectStatus[] = ["draft", "sent", "active"];

function waLink(whatsapp: string) {
  return `https://wa.me/${whatsapp.replace(/\D/g, "")}`;
}

function formatTotal(total: number | null, currency: string) {
  if (total === null) return "Por definir";
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(total);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ProjectRow({
  project,
  designer,
}: {
  project: ClientProject;
  designer?: CollabFreelancerSummary;
}) {
  const statusTag = projectStatusTag(project.status);

  return (
    <Row fillWidth paddingX="20" paddingY="12" horizontal="between" vertical="center" gap="16">
      <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
        <Icon name="briefcase" size="s" onBackground="neutral-weak" />
        <Text
          variant="label-default-m"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {project.title}
        </Text>
      </Row>

      <Row gap="8" vertical="center">
        <Tag size="s" variant={statusTag.variant} label={statusTag.label} />
        <IconButton
          icon="infoCircle"
          size="s"
          variant="tertiary"
          tooltip={`Total: ${formatTotal(project.total, project.currency)} · Actualizado: ${formatDate(project.updatedAt)}`}
          tooltipPosition="top"
        />
        {designer?.whatsapp && (
          <IconButton
            icon="whatsapp"
            size="s"
            variant="tertiary"
            href={waLink(designer.whatsapp)}
            tooltip={`Contactar a ${designer.name ?? "tu diseñador"}`}
            tooltipPosition="top"
          />
        )}
      </Row>
    </Row>
  );
}

function ProjectGroup({
  title,
  variant,
  projects,
  designer,
}: {
  title: string;
  variant: "warning" | "success";
  projects: ClientProject[];
  designer?: CollabFreelancerSummary;
}) {
  if (projects.length === 0) return null;

  return (
    <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
      <Row
        fillWidth
        paddingX="20"
        paddingY="12"
        horizontal="between"
        vertical="center"
        background="neutral-alpha-weak"
      >
        <Row gap="8" vertical="center">
          <Tag size="s" variant={variant} label={title} />
        </Row>
        <Text variant="label-default-s" onBackground="neutral-weak">
          {projects.length} {projects.length === 1 ? "proyecto" : "proyectos"}
        </Text>
      </Row>
      {projects.map((project) => (
        <Column key={project.id} fillWidth>
          <Line background="neutral-alpha-weak" />
          <ProjectRow project={project} designer={designer} />
        </Column>
      ))}
    </Column>
  );
}

// Fila de una tarea activa (checklist) de un proyecto en colaboración,
// dentro del contenedor expandible de CollabProjectRow. El avance
// (LinearGauge) es de solo lectura aquí: la edición vive en el panel del
// freelancer (CollabProjectView/ProjectTaskRow, Fase 6b).
function TaskRow({ task }: { task: CollabProjectData["tasks"][number] }) {
  return (
    <Column fillWidth paddingX="16" paddingY="8" gap="8">
      <Row fillWidth horizontal="between" vertical="center" gap="12">
        <Text
          variant="label-default-s"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {task.title}
        </Text>
        <Tag
          size="s"
          variant={TASK_STATUS_VARIANTS[task.status] ?? "neutral"}
          label={TASK_STATUS_LABELS[task.status] ?? task.status}
        />
      </Row>
      <Row gap="8" vertical="center">
        <Column flex={1} height="24" style={{ minWidth: 60 }}>
          <LinearGauge
            value={task.progress}
            hue={task.progress >= 100 ? "success" : "neutral"}
            line={{ count: 20, length: 16 }}
          />
        </Column>
        <Text variant="label-default-s" onBackground="neutral-weak">
          {task.progress}%
        </Text>
      </Row>
    </Column>
  );
}

// Fila de un proyecto en colaboración (con freelancer ya aceptado): estatus
// homologado, tareas esperando aprobación del client, click para ir al
// detalle, y un botón para expandir/colapsar sus tareas activas sin salir
// del panel.
function CollabProjectRow({ project }: { project: CollabProjectData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const pendingReview = project.tasks.filter(
    (task) => task.status === "in_review" || task.status === "pending_approval",
  ).length;
  const statusTag = projectStatusTag(project.status);
  const activeTasks = project.tasks.filter(
    (task) => task.status !== "approved" && task.status !== "rejected",
  );

  return (
    <Column fillWidth>
      <Row
        fillWidth
        paddingX="20"
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
            variant="label-default-m"
            onBackground="neutral-strong"
            style={{ minWidth: 0, overflowWrap: "anywhere" }}
          >
            {project.title}
          </Text>
        </Row>

        <Row gap="8" vertical="center">
          {pendingReview > 0 && (
            <Tag size="s" variant="warning" label={`${pendingReview} por aprobar`} />
          )}
          <Tag size="s" variant={statusTag.variant} label={statusTag.label} />
          {project.tasks.length > 0 && (
            <IconButton
              icon={expanded ? "chevronUp" : "chevronDown"}
              size="s"
              variant="tertiary"
              tooltip={expanded ? "Ocultar tareas" : "Ver tareas"}
              tooltipPosition="top"
              onClick={(e: MouseEvent) => {
                e.stopPropagation();
                setExpanded((current) => !current);
              }}
            />
          )}
        </Row>
      </Row>

      {expanded && project.tasks.length > 0 && (
        <Column fillWidth paddingLeft={52} paddingRight="20" paddingBottom="8">
          {activeTasks.length === 0 ? (
            <Text variant="label-default-s" onBackground="neutral-weak">
              Sin tareas activas.
            </Text>
          ) : (
            <Column fillWidth border="neutral-alpha-weak" radius="m" overflow="hidden">
              {activeTasks.map((task, index) => (
                <Column key={task.id} fillWidth>
                  {index > 0 && <Line background="neutral-alpha-weak" />}
                  <TaskRow task={task} />
                </Column>
              ))}
            </Column>
          )}
        </Column>
      )}
    </Column>
  );
}

// Bloque unificado "Proyectos en curso" (Fase 3): fusiona los proyectos en
// colaboración (CollabProject, con tareas expandibles) y las cotizaciones
// del client todavía en curso (ProjectQuote) en un único contenedor.
function InProgressProjectsGroup({
  collabProjects,
  quoteProjects,
  designer,
}: {
  collabProjects: CollabProjectData[];
  quoteProjects: ClientProject[];
  designer?: CollabFreelancerSummary;
}) {
  const total = collabProjects.length + quoteProjects.length;
  if (total === 0) return null;

  return (
    <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
      <Row
        fillWidth
        paddingX="20"
        paddingY="12"
        horizontal="between"
        vertical="center"
        background="neutral-alpha-weak"
      >
        <Row gap="8" vertical="center">
          <Tag size="s" variant="brand" label="Proyectos en curso" />
        </Row>
        <Text variant="label-default-s" onBackground="neutral-weak">
          {total} {total === 1 ? "proyecto" : "proyectos"}
        </Text>
      </Row>
      {collabProjects.map((project) => (
        <Column key={project.id} fillWidth>
          <Line background="neutral-alpha-weak" />
          <CollabProjectRow project={project} />
        </Column>
      ))}
      {quoteProjects.map((project) => (
        <Column key={project.id} fillWidth>
          <Line background="neutral-alpha-weak" />
          <ProjectRow project={project} designer={designer} />
        </Column>
      ))}
    </Column>
  );
}

// Fila de un recurso propio del client ("Mis recursos"): abrir, compartir y
// eliminar. sharedWith se resume como cantidad de freelancers con acceso.
function ResourceRow({
  resource,
  onShare,
  onDelete,
}: {
  resource: ClientResourceData;
  onShare: () => void;
  onDelete: () => void;
}) {
  return (
    <Row fillWidth paddingX="20" paddingY="12" horizontal="between" vertical="center" gap="16" wrap>
      <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
        <Icon name="link" size="s" onBackground="neutral-weak" />
        <Text
          variant="label-default-m"
          onBackground="neutral-strong"
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {resource.label}
        </Text>
      </Row>

      <Row gap="8" vertical="center">
        <Tag size="s" variant="neutral" label={PROVIDER_LABELS[resource.provider] ?? "Link"} />
        {resource.sharedWith.length > 0 && (
          <Tag size="s" variant="info" label={`Compartido con ${resource.sharedWith.length}`} />
        )}
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
        <IconButton
          icon="userGroup"
          size="s"
          variant="tertiary"
          tooltip="Compartir con freelancers"
          tooltipPosition="top"
          onClick={onShare}
        />
        <IconButton
          icon="trash"
          size="s"
          variant="tertiary"
          tooltip="Eliminar recurso"
          tooltipPosition="top"
          onClick={onDelete}
        />
      </Row>
    </Row>
  );
}

export function ClientProfileView({
  displayName,
  avatarUrl,
  isOwnProfile,
  email,
  firstName,
  lastName,
  username,
  whatsapp,
  secondaryEmail,
  address,
  company,
  brand,
  motto,
  contactPreference,
  contactHours,
  website,
  industry,
  projects,
  connections = [],
  collabProjects = [],
  resources = [],
  discoverableFreelancers = [],
  openEditOnMount = false,
}: ClientProfileViewProps) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<"avatar" | "info" | "security" | null>(null);

  // Apertura automática del modal "Editar perfil" al llegar con ?editar=1
  // (menú del avatar del Header → "Editar Perfil"). Solo al montar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe correr al montar.
  useEffect(() => {
    if (isOwnProfile && openEditOnMount) {
      setOpenDialog("info");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [collabDialogOpen, setCollabDialogOpen] = useState(false);
  const [resourceDialog, setResourceDialog] = useState<"add" | null>(null);
  const [shareCandidate, setShareCandidate] = useState<ClientResourceData | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<ClientResourceData | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);

  const initials = (displayName[0] ?? "U").toUpperCase();
  const avatarProps = avatarUrl ? { src: avatarUrl } : { value: initials };

  const inProgress = projects.filter((p) => IN_PROGRESS.includes(p.status as ProjectStatus));
  // Notificaciones del client: tareas que los freelancers enviaron a su aprobación
  const notificationCount = collabProjects.reduce(
    (acc, project) => acc + project.tasks.filter((task) => task.status === "in_review").length,
    0,
  );
  const finished = projects.filter((p) => !IN_PROGRESS.includes(p.status as ProjectStatus));
  const acceptedConnections = connections.filter((c) => c.status === "ACCEPTED");
  const pendingConnections = connections.filter((c) => c.status === "PENDING");
  // Sin relación proyecto→diseñador en el schema todavía: se contacta al primer freelancer aceptado.
  const mainDesigner = acceptedConnections[0]?.freelancer;

  const collabProjectOptions: ConnectionOption[] = acceptedConnections.map((connection) => ({
    value: connection.id,
    label: connection.freelancer.name ?? connection.freelancer.username ?? "Freelancer",
  }));

  const shareableFreelancers: ShareableFreelancer[] = acceptedConnections.map((connection) => ({
    id: connection.freelancer.id,
    name: connection.freelancer.name,
    username: connection.freelancer.username,
    imageUrl: connection.freelancer.imageUrl,
  }));

  // "Buscar más talento": envía una solicitud de contacto directa al freelancer
  // elegido en el buscador, en vez de redirigir a /explorar/designerds.
  const handleContactFreelancer = async (freelancerId: string) => {
    setContactError(null);
    const result = await sendContactRequest(freelancerId);
    if (!result.ok) {
      setContactError(result.error);
      return;
    }
    router.refresh();
  };

  // Zona de identidad: con perfil propio se envuelve en ContextMenu (click o
  // click derecho) para cambiar imagen y editar información.
  const identity = (
    <Row gap="20" vertical="center">
      {isOwnProfile ? (
        // stopPropagation: el click del overlay no debe abrir además el ContextMenu
        <button
          type="button"
          className={styles.avatarButton}
          aria-label="Cambiar imagen de perfil"
          onClick={(e) => {
            e.stopPropagation();
            setOpenDialog("avatar");
          }}
        >
          <Avatar {...avatarProps} size="l" />
          <span className={styles.avatarEdit}>
            <Icon name="edit" size="s" />
          </span>
        </button>
      ) : (
        <Avatar {...avatarProps} size="l" />
      )}
      <Column gap="4" style={{ minWidth: 0 }}>
        <Heading variant="heading-strong-l">{displayName}</Heading>
        {isOwnProfile && email && (
          <Row gap="8" vertical="center" wrap style={{ minWidth: 0 }}>
            {/* Ellipsis en vez de quiebre a media palabra ("hubnerds.co m"); */}
            {/* el correo completo queda en el title al hover */}
            <Text
              variant="label-default-s"
              onBackground="neutral-weak"
              title={email}
              style={{
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {email}
            </Text>
          </Row>
        )}
        {(company || brand) && (
          <Text variant="label-default-s" onBackground="neutral-weak">
            {[company, brand].filter(Boolean).join(" · ")}
          </Text>
        )}
        {motto && (
          <Text
            variant="body-default-s"
            onBackground="neutral-weak"
            style={{ fontStyle: "italic" }}
          >
            “{motto}”
          </Text>
        )}
      </Column>
    </Row>
  );

  return (
    <RevealFx fillWidth horizontal="center" revealedByDefault>
      <Column fillWidth maxWidth="l" horizontal="center" paddingBottom="80">
        <Column fillWidth paddingX="32" paddingTop="40" gap="24">
          {/* ── Cabecera del panel ─────────────────────────────────────────── */}
          {(() => {
            const headerContent = identity;
            return (
              <Card fillWidth padding="24" radius="l" position="relative">
                {isOwnProfile ? (
                  // El menú cubre toda la cabecera, no solo la zona de identidad
                  <ContextMenu
                    fillWidth
                    placement="bottom-start"
                    onSelect={(value) => setOpenDialog(value as "avatar" | "info" | "security")}
                    // fillWidth del ContextMenu no estira su wrapper interno: sin
                    // width explícito el contenido no alcanza el borde derecho del card
                    style={{ cursor: "pointer", width: "100%" }}
                    dropdown={
                      <Column minWidth={14} padding="4" gap="2">
                        <Option
                          label="Cambiar imagen de perfil"
                          value="avatar"
                          hasPrefix={<Icon name="camera" size="s" onBackground="neutral-weak" />}
                        />
                        <Option
                          label="Editar perfil"
                          value="info"
                          hasPrefix={<Icon name="edit" size="s" onBackground="neutral-weak" />}
                        />
                        <Option
                          label="Seguridad y privacidad"
                          value="security"
                          hasPrefix={<Icon name="shield" size="s" onBackground="neutral-weak" />}
                        />
                      </Column>
                    }
                  >
                    {headerContent}
                  </ContextMenu>
                ) : (
                  headerContent
                )}
                {isOwnProfile && (
                  // Vía adicional (además del click derecho) para abrir el modal de
                  // edición completa; hermano del ContextMenu, no anidado dentro, para
                  // que el click en el engrane no dispare también el menú contextual.
                  <Row position="absolute" top="16" right="16" style={{ zIndex: 1 }}>
                    <IconButton
                      icon="settings"
                      tooltip="Editar perfil"
                      tooltipPosition="left"
                      variant="secondary"
                      onClick={() => setOpenDialog("info")}
                    />
                  </Row>
                )}
              </Card>
            );
          })()}

          {/* ── Resumen de actividad ───────────────────────────────────────── */}
          <Row fillWidth horizontal="end" vertical="center" gap="8" wrap>
            <Tag size="m" variant="warning" label={`${inProgress.length} en curso`} />
            <Tag
              size="m"
              variant="success"
              label={`${finished.filter((p) => p.status === "completed").length} completados`}
            />
            <Tag
              size="m"
              variant="info"
              prefixIcon="bell"
              label={`${notificationCount} notificaciones`}
            />
          </Row>

          {/* ── Nuevo proyecto: panel principal de creación, toda la tarjeta ── */}
          {/* es clicable (reemplaza el botón disparador que vivía en "Mis   */}
          {/* proyectos"); requiere al menos un diseñador conectado. ──────── */}
          {acceptedConnections.length > 0 ? (
            <Card
              fillWidth
              padding="20"
              radius="l"
              direction="column"
              gap="12"
              onClick={() => setCollabDialogOpen(true)}
            >
              <Row fillWidth horizontal="between" vertical="center">
                <Icon name="plus" size="m" onBackground="brand-weak" />
                <Icon name="arrowUpRight" size="s" onBackground="neutral-weak" />
              </Row>
              <Column gap="4">
                <Text variant="heading-strong-s">Nuevo proyecto</Text>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  Elige la vertical de tu proyecto y arráncalo en colaboración con tu diseñador.
                </Text>
              </Column>
            </Card>
          ) : (
            <Column
              fillWidth
              padding="20"
              radius="l"
              background="surface"
              border="neutral-alpha-weak"
              gap="12"
            >
              <Icon name="plus" size="m" onBackground="brand-weak" />
              <Column gap="4">
                <Text variant="heading-strong-s">Nuevo proyecto</Text>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  Conecta primero con un diseñador para poder iniciar un proyecto en colaboración.
                </Text>
              </Column>
            </Column>
          )}

          {/* ── Tablero de proyectos + paneles laterales ───────────────────── */}
          <Row fillWidth gap="24" vertical="start" s={{ direction: "column" }}>
            {/* Tablero tipo Monday */}
            <Column gap="40" fillWidth>
              <Column gap="16" fillWidth>
                <Row fillWidth horizontal="between" vertical="center" wrap gap="8">
                  <Heading variant="heading-strong-m">Mis proyectos</Heading>
                </Row>

                {projects.length === 0 && collabProjects.length === 0 ? (
                  <Column
                    fillWidth
                    horizontal="center"
                    gap="16"
                    padding="48"
                    border="neutral-alpha-medium"
                    radius="l"
                  >
                    <Icon name="sparkles" size="l" onBackground="neutral-weak" />
                    <Text variant="body-default-m" onBackground="neutral-weak" align="center">
                      Aún no has contratado proyectos.
                    </Text>
                    <Button
                      href="/servicios/cotizador"
                      variant="primary"
                      size="m"
                      prefixIcon="plus"
                    >
                      Cotizar mi primer proyecto
                    </Button>
                  </Column>
                ) : (
                  <Column gap="16" fillWidth>
                    <InProgressProjectsGroup
                      collabProjects={collabProjects}
                      quoteProjects={inProgress}
                      designer={mainDesigner}
                    />
                    <ProjectGroup
                      title="Finalizados"
                      variant="success"
                      projects={finished}
                      designer={mainDesigner}
                    />
                  </Column>
                )}
              </Column>

              {/* Mis recursos: assets propios del client como links compartibles */}
              <Column gap="16" fillWidth>
                <Row fillWidth horizontal="between" vertical="center" wrap gap="8">
                  <Heading variant="heading-strong-m">Mis recursos</Heading>
                  <Button
                    variant="secondary"
                    size="s"
                    prefixIcon="plus"
                    onClick={() => setResourceDialog("add")}
                  >
                    Agregar recurso
                  </Button>
                </Row>

                {resources.length === 0 ? (
                  <Column
                    fillWidth
                    horizontal="center"
                    gap="12"
                    padding="32"
                    border="neutral-alpha-medium"
                    radius="l"
                  >
                    <Icon name="folder" size="l" onBackground="neutral-weak" />
                    <Text variant="body-default-m" onBackground="neutral-weak" align="center">
                      Aún no agregas recursos. Sube tus assets a tu nube favorita y comparte el link
                      aquí.
                    </Text>
                  </Column>
                ) : (
                  <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
                    {resources.map((resource, index) => (
                      <Column key={resource.id} fillWidth>
                        {index > 0 && <Line background="neutral-alpha-weak" />}
                        <ResourceRow
                          resource={resource}
                          onShare={() => setShareCandidate(resource)}
                          onDelete={() => setDeleteCandidate(resource)}
                        />
                      </Column>
                    ))}
                  </Column>
                )}
              </Column>
            </Column>

            {/* Paneles laterales */}
            <Column gap="16" fillWidth style={{ maxWidth: 320 }}>
              {/* Diseñadores contratados */}
              <Column
                background="neutral-alpha-weak"
                border="neutral-alpha-weak"
                padding="16"
                radius="m"
                gap="12"
              >
                <Row gap="8" vertical="center">
                  <Icon name="userGroup" size="s" onBackground="neutral-weak" />
                  <Text variant="label-strong-s">Tus diseñadores</Text>
                </Row>
                {connections.length === 0 ? (
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Todavía no trabajas con ningún diseñador.
                  </Text>
                ) : (
                  <>
                    {acceptedConnections.map(({ freelancer }) => (
                      <Row
                        key={freelancer.id}
                        fillWidth
                        horizontal="between"
                        vertical="center"
                        gap="8"
                      >
                        <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
                          <Avatar
                            size="s"
                            {...(freelancer.imageUrl
                              ? { src: freelancer.imageUrl }
                              : { value: (freelancer.name?.[0] ?? "P").toUpperCase() })}
                          />
                          <Column gap="2" style={{ minWidth: 0 }}>
                            <Text
                              variant="label-default-s"
                              onBackground="neutral-strong"
                              style={{ minWidth: 0, overflowWrap: "anywhere" }}
                            >
                              {freelancer.name ?? freelancer.username}
                            </Text>
                            <Text variant="label-default-s" onBackground="neutral-weak">
                              Freelancer
                            </Text>
                          </Column>
                        </Row>
                        <Row gap="4" vertical="center">
                          {freelancer.whatsapp && (
                            <IconButton
                              icon="whatsapp"
                              size="s"
                              variant="tertiary"
                              href={waLink(freelancer.whatsapp)}
                              tooltip="Contactar por WhatsApp"
                              tooltipPosition="top"
                            />
                          )}
                          {freelancer.username && (
                            <IconButton
                              icon="person"
                              size="s"
                              variant="tertiary"
                              href={`/${freelancer.username}`}
                              tooltip="Ver perfil"
                              tooltipPosition="top"
                            />
                          )}
                        </Row>
                      </Row>
                    ))}
                    {pendingConnections.map(({ id, freelancer }) => (
                      <Row key={id} fillWidth horizontal="between" vertical="center" gap="8">
                        <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
                          <Avatar
                            size="s"
                            {...(freelancer.imageUrl
                              ? { src: freelancer.imageUrl }
                              : { value: (freelancer.name?.[0] ?? "P").toUpperCase() })}
                          />
                          <Column gap="2" style={{ minWidth: 0 }}>
                            <Text
                              variant="label-default-s"
                              onBackground="neutral-strong"
                              style={{ minWidth: 0, overflowWrap: "anywhere" }}
                            >
                              {freelancer.name ?? freelancer.username}
                            </Text>
                          </Column>
                        </Row>
                        <Tag size="s" variant="neutral" label="Solicitud enviada" />
                      </Row>
                    ))}
                  </>
                )}
                <Line background="neutral-alpha-weak" />
                <CollaboratorSearchModal
                  people={discoverableFreelancers}
                  onSelect={handleContactFreelancer}
                  trigger={
                    <Button variant="secondary" size="s" fillWidth prefixIcon="search">
                      Buscar más talento
                    </Button>
                  }
                  emptyHint="No hay más diseñadores disponibles para conectar por ahora."
                />
                {contactError && <Feedback variant="danger" description={contactError} />}
              </Column>

              {/* Recursos por categoría */}
              <Column
                background="neutral-alpha-weak"
                border="neutral-alpha-weak"
                padding="16"
                radius="m"
                gap="12"
              >
                <Row gap="8" vertical="center">
                  <Icon name="download" size="s" onBackground="neutral-weak" />
                  <Text variant="label-strong-s">Recursos compartidos</Text>
                </Row>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  Materiales que tus diseñadores publican para ti.
                </Text>
                <Row gap="8" wrap>
                  {Object.entries(RESOURCE_CATEGORY_SLUGS).map(([slug, label]) => (
                    <Button key={slug} href={`/recursos/${slug}`} variant="secondary" size="s">
                      {label}
                    </Button>
                  ))}
                </Row>
              </Column>
            </Column>
          </Row>
        </Column>

        {isOwnProfile && (
          <>
            <AvatarUploadDialog
              isOpen={openDialog === "avatar"}
              onClose={() => setOpenDialog(null)}
              currentImageUrl={avatarUrl}
            />
            <EditInfoDialog
              isOpen={openDialog === "info"}
              onClose={() => setOpenDialog(null)}
              avatarUrl={avatarUrl}
              onOpenAvatar={() => setOpenDialog("avatar")}
              initial={{
                firstName: firstName ?? "",
                lastName: lastName ?? "",
                username: username ?? "",
                whatsapp: whatsapp ?? "",
                secondaryEmail: secondaryEmail ?? "",
                address: address ?? "",
                company: company ?? "",
                brand: brand ?? "",
                motto: motto ?? "",
                contactPreference: contactPreference ?? "",
                contactHours: contactHours ?? "",
                website: website ?? "",
                industry: industry ?? "",
              }}
            />
            <SecurityPrivacyDialog
              isOpen={openDialog === "security"}
              onClose={() => setOpenDialog(null)}
            />
            <NewCollabProjectDialog
              isOpen={collabDialogOpen}
              onClose={() => setCollabDialogOpen(false)}
              options={collabProjectOptions}
            />
            <AddClientResourceDialog
              isOpen={resourceDialog === "add"}
              onClose={() => setResourceDialog(null)}
            />
            <ShareClientResourceDialog
              key={shareCandidate?.id ?? "none"}
              isOpen={shareCandidate !== null}
              onClose={() => setShareCandidate(null)}
              resource={shareCandidate}
              freelancers={shareableFreelancers}
            />
            <DeleteClientResourceDialog
              isOpen={deleteCandidate !== null}
              onClose={() => setDeleteCandidate(null)}
              resource={deleteCandidate}
            />
          </>
        )}
      </Column>
    </RevealFx>
  );
}
