"use client";

import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Column,
  Flex,
  Grid,
  Heading,
  Icon,
  Media,
  RevealFx,
  Row,
  SegmentedControl,
  SmartLink,
  Switch,
  Tag,
  Text,
} from "@once-ui-system/core";
import type { ProjectStatus } from "@/lib/projectStatus";
import { setPieceVisibility } from "@/app/actions/portfolioPieces";
import { CreateProjectModal } from "./CreateProjectModal";

export interface PartnerProject {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  currency: string;
  total: number | null;
  updatedAt: string; // ISO string
}

export interface PartnerPiece {
  id: string;
  title: string;
  category: string;
  // Nula en piezas creadas desde el editor de Markdown (sin portada)
  coverUrl: string | null;
  views: number;
  likes: number;
  isPublic: boolean;
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
  projects: PartnerProject[];
  pieces: PartnerPiece[];
}

const IN_PROGRESS: ProjectStatus[] = ["draft", "sent", "active"];

const ALL_CATEGORIES = "Todos";

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
// visibilidad (público ↔ borrador) operable sin navegar.
function PieceCard({ piece, isOwnProfile }: { piece: PartnerPiece; isOwnProfile: boolean }) {
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

  const cover = piece.coverUrl ? (
    <Column fillWidth radius="m" overflow="hidden">
      <Media
        src={piece.coverUrl}
        alt={piece.title}
        aspectRatio="4 / 3"
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

  return (
    <Card
      href={isOwnProfile ? undefined : piece.href}
      fillWidth
      direction="column"
      gap="12"
      padding="12"
      radius="l"
      border="neutral-alpha-weak"
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
          <Text variant="heading-strong-s" onBackground="neutral-strong" wrap="balance">
            {piece.title}
          </Text>
          <Tag size="s" label={piece.category} variant="neutral" />
        </Row>
        <Row fillWidth horizontal="between" vertical="center" gap="12">
          <Row gap="12" vertical="center">
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
            <Row gap="8" vertical="center">
              <Text variant="label-default-s" onBackground="neutral-weak">
                {isPublic ? "Público" : "Borrador"}
              </Text>
              <Switch
                isChecked={isPublic}
                onToggle={toggleVisibility}
                loading={saving}
                ariaLabel={`Visibilidad de ${piece.title}`}
              />
            </Row>
          )}
        </Row>
      </Column>
    </Card>
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
  projects,
  pieces,
}: ProfileViewProps) {
  const [filter, setFilter] = useState<string>(ALL_CATEGORIES);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const initials = (displayName[0] ?? "U").toUpperCase();
  const avatarProps = avatarUrl ? { src: avatarUrl } : { value: initials };

  const inProgress = projects.filter((p) => IN_PROGRESS.includes(p.status as ProjectStatus));
  const completed = projects.filter((p) => p.status === "completed");
  const clients = new Set(projects.map((p) => p.clientName).filter(Boolean));
  const billed = projects.reduce((sum, p) => sum + (p.total ?? 0), 0);

  const categories = [ALL_CATEGORIES, ...new Set(pieces.map((p) => p.category))];
  const visiblePieces =
    filter === ALL_CATEGORIES ? pieces : pieces.filter((p) => p.category === filter);

  const metrics = [
    { label: "En curso", value: String(inProgress.length) },
    { label: "Completados", value: String(completed.length) },
    { label: "Clientes", value: String(clients.size) },
    // Monto facturado: solo visible para el dueño del perfil.
    ...(isOwnProfile
      ? [{ label: "Facturado", value: formatTotal(billed, projects[0]?.currency ?? "MXN") }]
      : []),
  ];

  return (
    <RevealFx fillWidth horizontal="center" revealedByDefault>
      <Column fillWidth maxWidth="l" horizontal="center" paddingBottom="80">
        <Column fillWidth paddingX="32" paddingTop="24" gap="0">

          {/* ── Banner de cobertura ─────────────────────────────────────────── */}
          <Flex fillWidth height="160" radius="l" background="brand-alpha-weak" />

          {/* ── Layout asimétrico de dos columnas ──────────────────────────── */}
          <Row fillWidth gap="32" s={{ direction: "column" }} vertical="start">

            {/* Columna izquierda — identidad, contacto y métricas */}
            <Column gap="24" fillWidth style={{ maxWidth: 320 }}>
              <Flex style={{ marginTop: "-48px" }}>
                <Avatar {...avatarProps} size="xl" />
              </Flex>

              <Column gap="8">
                <Heading variant="heading-strong-l">{displayName}</Heading>
                <Row gap="8" vertical="center">
                  <Tag size="s" variant="brand" label="Partner" />
                  <Text variant="body-default-m" onBackground="neutral-weak">
                    @{username}
                  </Text>
                </Row>
                {memberSince && (
                  <Row gap="8" vertical="center">
                    <Icon name="calendar" size="s" onBackground="neutral-weak" />
                    <Text variant="body-default-m" onBackground="neutral-weak">
                      Partner desde {formatMemberSince(memberSince)}
                    </Text>
                  </Row>
                )}
                {isOwnProfile && email && (
                  <Row gap="8" vertical="center">
                    <Icon name="email" size="s" onBackground="neutral-weak" />
                    <Text variant="body-default-m" onBackground="neutral-weak">
                      {email}
                    </Text>
                  </Row>
                )}
              </Column>

              {isOwnProfile ? (
                <Column gap="8" fillWidth>
                  <Button fillWidth variant="primary" href="/dashboard/collaborator">
                    Ir a mi panel
                  </Button>
                  <Button fillWidth variant="secondary" href="/dashboard/client/settings">
                    Editar información de perfil
                  </Button>
                </Column>
              ) : (
                whatsapp && (
                  <Button fillWidth variant="primary" href={waLink(whatsapp)} prefixIcon="whatsapp">
                    Contactar por WhatsApp
                  </Button>
                )
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
                    <Text variant="label-default-s" onBackground="neutral-weak">
                      {metric.label}
                    </Text>
                    <Text variant="label-strong-s">{metric.value}</Text>
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
                  <Text variant="label-strong-s">Clientes</Text>
                  <Column gap="12">
                    {[...clients].map((client) => (
                      <Row key={client} gap="12" vertical="center">
                        <Avatar value={(client as string)[0].toUpperCase()} size="s" radius="s" />
                        <Text variant="label-default-s" onBackground="neutral-strong">
                          {client}
                        </Text>
                      </Row>
                    ))}
                  </Column>
                </Flex>
              )}
            </Column>

            {/* Columna derecha — showcase de proyectos reales */}
            <Column gap="24" fillWidth paddingTop="24">
              <SegmentedControl
                selected={filter}
                onToggle={setFilter}
                buttons={categories.map((c) => ({ value: c, label: c }))}
              />

              {isOwnProfile && (
                <Flex
                  background="brand-alpha-weak"
                  padding="20"
                  radius="m"
                  fillWidth
                  vertical="center"
                  horizontal="between"
                  gap="16"
                  s={{ direction: "column", horizontal: "start" }}
                >
                  <Column gap="4">
                    <Text variant="heading-strong-s">Impulsa tus proyectos</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Llega a más clientes destacando tu trabajo en la portada de Explorar.
                    </Text>
                  </Column>
                  <Button variant="primary" size="m">Probar Pro</Button>
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
                <Grid columns={3} m={{ columns: 2 }} s={{ columns: 1 }} gap="20" fillWidth>
                  {visiblePieces.map((piece) => (
                    <PieceCard key={piece.id} piece={piece} isOwnProfile={isOwnProfile} />
                  ))}

                  {/* Tarjeta de acción "Crear un proyecto" */}
                  {isOwnProfile && (
                    <Flex
                      role="button"
                      tabIndex={0}
                      onClick={() => setCreateOpen(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setCreateOpen(true);
                      }}
                      border="neutral-medium"
                      radius="l"
                      style={{ borderStyle: "dashed", cursor: "pointer" }}
                      center
                      padding="40"
                      direction="column"
                      gap="12"
                    >
                      <Icon name="plus" size="l" onBackground="neutral-weak" />
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        Crear un proyecto
                      </Text>
                    </Flex>
                  )}
                </Grid>
              )}
            </Column>

          </Row>
        </Column>
      </Column>

      {isOwnProfile && (
        <CreateProjectModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
      )}
    </RevealFx>
  );
}
