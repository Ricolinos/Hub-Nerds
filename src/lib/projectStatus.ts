// Estatus válidos de un ProjectQuote y sus etiquetas en español.
// Módulo compartido server/client: NO agregar "use server".
export const PROJECT_STATUSES = ["draft", "sent", "active", "completed", "archived"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Borrador",
  sent: "Enviada",
  active: "En progreso",
  completed: "Completada",
  archived: "Archivada",
};

/* ══ Máquina de estados homologada (Fase 3, panel de client: bloque ══
   "Proyectos en curso") ═══════════════════════════════════════════════
   Las etiquetas VISIBLES de estado de proyecto se limitan estrictamente a
   estas 4, sin importar el modelo de origen (ProjectQuote o CollabProject).
   Valores reales en BD de CollabProject.status: active | paused |
   pending_approval | completed | archived (ver schema.prisma). Desde la
   Fase 6, updateCollabProject (src/app/actions/collab.ts) ya valida los 5
   contra esa whitelist — NO se migran datos existentes. */
export type CollabStatusLabel = "EN_PROGRESO" | "EN_PAUSA" | "PENDIENTE_APROBACION" | "COMPLETADO";

export const COLLAB_STATUS_TEXT: Record<CollabStatusLabel, string> = {
  EN_PROGRESO: "En progreso",
  EN_PAUSA: "En pausa",
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  COMPLETADO: "Completado",
};

// Tokens de color Once UI (ColorScheme) por etiqueta homologada.
export const COLLAB_STATUS_VARIANT: Record<CollabStatusLabel, "brand" | "warning" | "neutral" | "success"> = {
  EN_PROGRESO: "brand",
  EN_PAUSA: "neutral",
  PENDIENTE_APROBACION: "warning",
  COMPLETADO: "success",
};

// Mapa de TODOS los valores crudos que puede traer un status de proyecto,
// tanto de CollabProject (active|paused|pending_approval|completed|archived)
// como de ProjectQuote (draft|sent|active|completed|archived) — se fusionan
// en un solo vocabulario porque el panel de client los muestra en un único
// bloque "Proyectos en curso".
const RAW_STATUS_TO_LABEL: Record<string, CollabStatusLabel> = {
  draft: "EN_PROGRESO",
  sent: "PENDIENTE_APROBACION",
  active: "EN_PROGRESO",
  paused: "EN_PAUSA",
  pending_approval: "PENDIENTE_APROBACION",
  completed: "COMPLETADO",
  archived: "COMPLETADO",
};

export function projectStatusLabel(status: string): CollabStatusLabel {
  return RAW_STATUS_TO_LABEL[status] ?? "EN_PROGRESO";
}

export function projectStatusTag(status: string): {
  label: string;
  variant: "brand" | "warning" | "neutral" | "success";
} {
  const label = projectStatusLabel(status);
  return { label: COLLAB_STATUS_TEXT[label], variant: COLLAB_STATUS_VARIANT[label] };
}

/* ══ Estados de ProjectTask (checklist/tareas de un CollabProject) ══════
   "pending"/"in_review" son los históricos del checklist manual;
   "pending_approval"/"approved"/"rejected" llegan del pipeline
   mensaje->tarea (chat-requirements.md). Mismo mapa ya usado en
   CollabProjectView, centralizado aquí para no duplicarlo. */
export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  in_review: "En revisión",
  pending_approval: "Por aprobar",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export const TASK_STATUS_VARIANTS: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  in_review: "neutral",
  pending_approval: "warning",
  approved: "success",
  rejected: "danger",
};
