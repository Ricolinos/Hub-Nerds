import { Avatar, Column, Heading, Line, Row, SmartLink, Tag, Text } from "@once-ui-system/core";
import type { CollabProjectData } from "@/lib/collab";

// Mismo mapeo de status que usa CollabProjectView (no se exporta desde ahí a
// propósito, así que lo replicamos localmente en vez de acoplarnos).
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  completed: "Completado",
  archived: "Archivado",
};

export const PROJECT_STATUS_VARIANTS: Record<string, "neutral" | "warning" | "success"> = {
  active: "warning",
  completed: "success",
  archived: "neutral",
};

interface ProjectListWidgetProps {
  // Omitir cuando la página ya trae su propio <Heading> (evita duplicarlo).
  title?: string;
  projects: CollabProjectData[];
  emptyMessage: string;
  limit?: number;
}

// Lista de proyectos conjuntos (CollabProject) reutilizada entre los
// dashboards de client/freelancer y sus páginas dedicadas "/projects" y
// "/projects/finished". Cada fila enlaza al detalle real en /proyectos/[id].
export function ProjectListWidget({
  title,
  projects,
  emptyMessage,
  limit,
}: ProjectListWidgetProps) {
  const items = limit ? projects.slice(0, limit) : projects;

  return (
    <Column gap="16" fillWidth>
      {title && <Heading variant="heading-strong-m">{title}</Heading>}

      {items.length === 0 ? (
        <Column fillWidth padding="24" border="neutral-alpha-medium" radius="l" horizontal="center">
          <Text variant="body-default-s" onBackground="neutral-weak">
            {emptyMessage}
          </Text>
        </Column>
      ) : (
        <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
          {items.map((project, index) => (
            <Column key={project.id} fillWidth>
              {index > 0 && <Line background="neutral-alpha-weak" />}
              <SmartLink href={`/proyectos/${project.id}`} unstyled fillWidth>
                <Row
                  fillWidth
                  paddingX="20"
                  paddingY="16"
                  horizontal="between"
                  vertical="center"
                  gap="16"
                  wrap
                >
                  <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
                    <Avatar
                      size="s"
                      {...(project.logoUrl
                        ? { src: project.logoUrl }
                        : { value: project.title[0]?.toUpperCase() ?? "P" })}
                    />
                    <Text
                      variant="label-default-m"
                      onBackground="neutral-strong"
                      style={{ minWidth: 0, overflowWrap: "anywhere" }}
                    >
                      {project.title}
                    </Text>
                  </Row>
                  <Tag
                    size="s"
                    variant={PROJECT_STATUS_VARIANTS[project.status] ?? "neutral"}
                    label={PROJECT_STATUS_LABELS[project.status] ?? project.status}
                  />
                </Row>
              </SmartLink>
            </Column>
          ))}
        </Column>
      )}
    </Column>
  );
}
