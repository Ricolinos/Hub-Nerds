import type { IconName } from "@once-ui-system/core";

// ─────────────────────────────────────────────────────────────────────────
// MOCK TEMPORAL: contenido de referencia para /pro/preview/empresa — una
// maqueta navegable de la "brand page" pública que traería Client Pro
// (el espejo del portafolio del freelancer, pero para marcas). Nada de esto
// viene de la base de datos todavía; es solo para visualizar la propuesta
// antes de conectarla a datos reales de un client Pro.
// ─────────────────────────────────────────────────────────────────────────

export interface BrandProject {
  id: string;
  title: string;
  category: string;
  description: string;
}

export interface BrandTrustedFreelancer {
  id: string;
  name: string;
  specialty: string;
}

export interface BrandStat {
  icon: IconName;
  label: string;
  value: string;
}

export interface MockBrandPage {
  name: string;
  initials: string;
  motto: string;
  industry: string;
  location: string;
  description: string;
  memberSince: string;
  projects: BrandProject[];
  trustedFreelancers: BrandTrustedFreelancer[];
  stats: BrandStat[];
}

export const MOCK_BRAND_PAGE: MockBrandPage = {
  name: "Estudio Lumbre",
  initials: "EL",
  motto: "Contamos historias que se quedan.",
  industry: "Producción audiovisual",
  location: "Guadalajara, Jalisco",
  description:
    "Productora audiovisual independiente enfocada en documentales de marca, contenido para redes y identidad visual para negocios locales que quieren verse tan bien como saben hacer las cosas.",
  memberSince: "2024",
  projects: [
    {
      id: "raices",
      title: "Campaña “Raíces”",
      category: "Branding",
      description: "Spot institucional para un festival gastronómico regional.",
    },
    {
      id: "oficios",
      title: "Serie documental “Oficios”",
      category: "Contenido documental",
      description: "Miniserie de 6 episodios sobre oficios tradicionales mexicanos.",
    },
    {
      id: "cafe-nube",
      title: "Rebranding Café Nube",
      category: "Identidad de marca",
      description: "Sistema visual completo para una cadena local de cafeterías.",
    },
    {
      id: "temporada-lluvias",
      title: "Videobug “Temporada de lluvias”",
      category: "Motion graphics",
      description: "Plecas y wipers en vivo para un festival de música independiente.",
    },
  ],
  trustedFreelancers: [
    { id: "mariana", name: "Mariana Ortiz", specialty: "Motion Designer" },
    { id: "diego", name: "Diego Cabrera", specialty: "Editor de Video" },
    { id: "valentina", name: "Valentina Ruiz", specialty: "Diseñadora de Marca" },
  ],
  stats: [
    { icon: "briefcase", label: "Proyectos completados", value: "47" },
    { icon: "userGroup", label: "Freelancers contratados", value: "12" },
    { icon: "calendar", label: "Años en la plataforma", value: "2" },
  ],
};
