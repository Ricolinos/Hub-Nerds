// ─────────────────────────────────────────────────────────────────────────
// MOCK: contenido de referencia para "CV Live", ventaja de Freelancer Pro
// (ver src/lib/proPlans.ts → advantages[0]). Datos de ejemplo para un
// motion designer mexicano, coherentes con el resto del sitio (plecas,
// videobugs, branding). Temporal hasta que exista un modelo real en BD
// (experiencia/skills/formación del freelancer) — por ahora solo alimenta
// la maqueta visual de CvLiveSection.tsx.
// ─────────────────────────────────────────────────────────────────────────

export interface CvExperience {
  id: string;
  role: string;
  company: string;
  startLabel: string; // ej. "Ene 2023"
  endLabel: string | null; // null = presente
  description: string; // 1-2 líneas
  // Logros puntuales de la experiencia (bullets); usados en la página "CV
  // Live" a pantalla completa (src/components/profile/CvLivePage.tsx).
  // CvLiveSection.tsx (la tarjeta compacta del perfil) no los consume.
  achievements: string[];
}

export interface CvSkill {
  name: string;
  level: 1 | 2 | 3 | 4 | 5;
}

export interface CvEducation {
  id: string;
  title: string;
  institution: string;
  year: string;
}

// Más reciente primero — el índice 0 se marca como experiencia activa.
export const MOCK_CV_EXPERIENCES: CvExperience[] = [
  {
    id: "exp-1",
    role: "Motion Designer Senior",
    company: "Estudio Ánima",
    startLabel: "Ene 2023",
    endLabel: null,
    description:
      "Dirección de motion graphics para spots de TV y campañas digitales de clientes como Grupo Televisa y Cinépolis.",
    achievements: [
      "Lideró la producción motion de 12 campañas digitales con entrega puntual en el 100% de los casos.",
      "Redujo en 30% el tiempo de render del pipeline al estandarizar plantillas de Cinema 4D + After Effects.",
    ],
  },
  {
    id: "exp-2",
    role: "Diseñador de plecas y videobugs",
    company: "TV Azteca",
    startLabel: "Mar 2020",
    endLabel: "Dic 2022",
    description:
      "Producción de plecas, wippers y videobugs para noticieros en vivo bajo entregas diarias.",
    achievements: [
      "Diseñó el paquete gráfico completo (plecas, wippers, videobugs) para 3 noticieros en vivo.",
      "Sostuvo entregas diarias bajo presión de última hora sin retrasar ninguna transmisión.",
    ],
  },
  {
    id: "exp-3",
    role: "Freelance Motion & Branding",
    company: "Independiente",
    startLabel: "Jun 2017",
    endLabel: "Feb 2020",
    description:
      "Branding y animación 2D para marcas emergentes y agencias de publicidad en México.",
    achievements: [
      "Desarrolló identidad de marca y animación 2D para más de 15 clientes independientes.",
      "Construyó una cartera de clientes recurrentes en agencias de publicidad de la Ciudad de México.",
    ],
  },
];

// Presentación breve (2-3 frases) para la sección "Introducción" de la
// página CV Live a pantalla completa.
export const MOCK_CV_INTRO =
  "Motion designer y diseñador de branding con más de 7 años dirigiendo piezas para TV y campañas digitales. " +
  "Combino dirección de arte con producción técnica en After Effects y Cinema 4D para entregar motion graphics " +
  "con identidad propia, sin sacrificar tiempos de entrega.";

export const MOCK_CV_LOCATION = "Ciudad de México, UTC−6";

export const MOCK_CV_LANGUAGES = ["Español", "Inglés"];

export const MOCK_CV_SKILLS: CvSkill[] = [
  { name: "After Effects", level: 5 },
  { name: "Cinema 4D", level: 4 },
  { name: "Premiere Pro", level: 4 },
  { name: "Illustrator", level: 4 },
  { name: "Photoshop", level: 4 },
  { name: "Branding", level: 3 },
  { name: "Storyboarding", level: 3 },
  { name: "Trapcode Suite", level: 3 },
];

export const MOCK_CV_EDUCATION: CvEducation[] = [
  {
    id: "edu-1",
    title: "Lic. en Diseño Gráfico",
    institution: "Universidad Iberoamericana",
    year: "2017",
  },
  {
    id: "edu-2",
    title: "Certificación en Motion Design",
    institution: "Domestika",
    year: "2021",
  },
];
