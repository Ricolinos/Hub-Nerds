import type { IconName } from "@once-ui-system/core";

// ─────────────────────────────────────────────────────────────────────────
// MOCK TEMPORAL: contenido de referencia para /pro/preview/panel-client —
// una maqueta navegable del panel que traería Client Pro para gestionar
// varios proyectos y freelancers a la vez. Nada de esto viene de la base de
// datos todavía; es solo para visualizar la propuesta antes de conectarla a
// datos reales de un client Pro.
// ─────────────────────────────────────────────────────────────────────────

export interface MockPanelClient {
  name: string;
  city: string;
}

export interface SuggestedFreelancer {
  id: string;
  name: string;
  initials: string;
  specialty: string;
  affinity: number;
  reasons: string[];
}

export interface ActiveProject {
  id: string;
  name: string;
  freelancerName: string;
  freelancerInitials: string;
  progress: number;
  nextDelivery: string;
}

export interface PerformancePoint {
  label: string;
  value: number;
}

export interface PerformanceData {
  progressByProject: PerformancePoint[];
  deliveriesByWeek: PerformancePoint[];
  investmentByCategory: PerformancePoint[];
}

export interface AlertFreelancer {
  id: string;
  name: string;
  initials: string;
}

export interface DirectContact {
  id: string;
  name: string;
  specialty: string;
  unlocked: boolean;
  whatsapp?: string;
  email?: string;
}

export interface ChatGroup {
  id: string;
  projectName: string;
  unread: number;
  members: number;
  icon: IconName;
}

export interface MockClientPanel {
  client: MockPanelClient;
  suggestedFreelancers: SuggestedFreelancer[];
  activeProjects: ActiveProject[];
  performance: PerformanceData;
  alertPresets: string[];
  alertFreelancers: AlertFreelancer[];
  contacts: DirectContact[];
  chatGroups: ChatGroup[];
}

export const MOCK_CLIENT_PANEL: MockClientPanel = {
  client: {
    name: "Renata Solís",
    city: "Guadalajara, Jalisco",
  },
  suggestedFreelancers: [
    {
      id: "mariana",
      name: "Mariana Ortiz",
      initials: "MO",
      specialty: "Motion Designer",
      affinity: 96,
      reasons: ["A 20 min de tu zona · Guadalajara", "Especialidad: Motion", "Disponible ahora"],
    },
    {
      id: "diego",
      name: "Diego Cabrera",
      initials: "DC",
      specialty: "Editor de Video",
      affinity: 91,
      reasons: ["Trabajó con Renata antes", "Especialidad: Edición", "Entregas puntuales"],
    },
    {
      id: "valentina",
      name: "Valentina Ruiz",
      initials: "VR",
      specialty: "Diseñadora de Marca",
      affinity: 87,
      reasons: ["A 12 min de tu zona · Guadalajara", "Especialidad: Branding", "Disponible ahora"],
    },
  ],
  activeProjects: [
    {
      id: "campana-otono",
      name: "Campaña Otoño",
      freelancerName: "Mariana Ortiz",
      freelancerInitials: "MO",
      progress: 72,
      nextDelivery: "Vie 7 ago",
    },
    {
      id: "rebrand-tienda",
      name: "Rebrand de tienda",
      freelancerName: "Valentina Ruiz",
      freelancerInitials: "VR",
      progress: 38,
      nextDelivery: "Mié 12 ago",
    },
    {
      id: "serie-reels",
      name: "Serie de reels",
      freelancerName: "Diego Cabrera",
      freelancerInitials: "DC",
      progress: 55,
      nextDelivery: "Lun 10 ago",
    },
  ],
  performance: {
    progressByProject: [
      { label: "Campaña Otoño", value: 72 },
      { label: "Rebrand de tienda", value: 38 },
      { label: "Serie de reels", value: 55 },
    ],
    deliveriesByWeek: [
      { label: "Sem 1", value: 2 },
      { label: "Sem 2", value: 3 },
      { label: "Sem 3", value: 1 },
      { label: "Sem 4", value: 4 },
    ],
    investmentByCategory: [
      { label: "Motion", value: 45 },
      { label: "Branding", value: 30 },
      { label: "Edición", value: 25 },
    ],
  },
  alertPresets: ["Revisión urgente", "Cambio de prioridad", "Junta hoy"],
  alertFreelancers: [
    { id: "mariana", name: "Mariana Ortiz", initials: "MO" },
    { id: "diego", name: "Diego Cabrera", initials: "DC" },
    { id: "valentina", name: "Valentina Ruiz", initials: "VR" },
  ],
  contacts: [
    {
      id: "mariana",
      name: "Mariana Ortiz",
      specialty: "Motion Designer",
      unlocked: true,
      whatsapp: "+52 33 1234 5678",
      email: "mariana@ejemplo.com",
    },
    {
      id: "diego",
      name: "Diego Cabrera",
      specialty: "Editor de Video",
      unlocked: false,
    },
    {
      id: "valentina",
      name: "Valentina Ruiz",
      specialty: "Diseñadora de Marca",
      unlocked: true,
      whatsapp: "+52 33 8765 4321",
      email: "valentina@ejemplo.com",
    },
  ],
  chatGroups: [
    { id: "campana-otono", projectName: "Campaña Otoño", unread: 3, members: 2, icon: "sparkles" },
    { id: "rebrand-tienda", projectName: "Rebrand de tienda", unread: 0, members: 2, icon: "paintBrush" },
    { id: "serie-reels", projectName: "Serie de reels", unread: 5, members: 2, icon: "film" },
  ],
};
