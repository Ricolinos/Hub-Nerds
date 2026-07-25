// Novedades de la plataforma para el widget "Changelog" de ambos dashboards
// (Fase 6b). Entradas redactadas a mano a partir del historial real de
// features (ver `git log`); no hay modelo en BD para esto todavía — si algún
// día se vuelve dinámico, este archivo es el shape de referencia.
export type ChangelogTag = "Mensajería" | "Colaboración" | "Perfil" | "Cotizador" | "Tareas";

export interface ChangelogEntry {
  date: string; // ISO (solo fecha, YYYY-MM-DD)
  title: string;
  description: string;
  tag: ChangelogTag;
}

// Orden cronológico descendente (más reciente primero).
export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-07-11",
    title: "Tareas con avance, prioridad y dependencias",
    description:
      "Los proyectos conjuntos ahora tienen tareas con porcentaje de avance, prioridad, categoría, rango de fechas y dependencias entre sí, más sugerencias automáticas de a quién asignar según su rol.",
    tag: "Tareas",
  },
  {
    date: "2026-07-10",
    title: "Centro de mensajes estilo Messenger",
    description:
      "Todas las conversaciones con tus clients o freelancers viven ahora en /mensajes, con canales grupales por proyecto y una burbuja flotante de mensajes nuevos en el resto del sitio.",
    tag: "Mensajería",
  },
  {
    date: "2026-07-10",
    title: "De mensaje a tarea con un clic",
    description:
      "Cualquier mensaje del chat de un proyecto se puede convertir directamente en una tarea asignada a un responsable, que queda pendiente de aprobación hasta que la resuelve.",
    tag: "Mensajería",
  },
  {
    date: "2026-07-09",
    title: "Colaboración client-freelancer",
    description:
      "Nueva solicitud de contacto, proyectos conjuntos con checklist de activos y links a la nube, y recursos compartibles entre client y freelancer.",
    tag: "Colaboración",
  },
  {
    date: "2026-07-09",
    title: "Tarjetas Designerd en Explorar",
    description:
      "El perfil de cada freelancer ahora se presenta con una tarjeta volteable (frente con foto e insignias, reverso con cita destacada) dentro de un scroll infinito en /explorar.",
    tag: "Perfil",
  },
  {
    date: "2026-07-05",
    title: "Cotizador de servicios",
    description:
      "Formulario de cotización con captura de leads por correo (Resend), pensado para que un client potencial pida un presupuesto sin necesidad de cuenta.",
    tag: "Cotizador",
  },
];
