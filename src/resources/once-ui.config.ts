import {
  DataStyleConfig,
  DisplayConfig,
  EffectsConfig,
  FontsConfig,
  ProtectedRoutesConfig,
  RoutesConfig,
  SameAsConfig,
  SchemaConfig,
  StyleConfig,
} from "@/types";
import { home } from "./index";

// IMPORTANT: Replace with your own domain address - it's used for SEO in meta tags and schema
const baseURL: string = "https://hub-nerds.com";

const routes: RoutesConfig = {
  "/": true,
  "/explorar": true,
  "/recursos": true,
  "/servicios": true,
  "/ejercicios": true,
  "/proyectos": true,
  "/mensajes": true,
  "/convocatorias": true,
};

const display: DisplayConfig = {
  location: true,
  time: true,
  themeSwitcher: true,
};

// Enable password protection on selected routes
// Set password in the .env file, refer to .env.example
const protectedRoutes: ProtectedRoutesConfig = {};

// Import and set font for each variant
// FEATURE (prueba tipográfica, tarea "instalar Google Fonts de uso libre"):
// heading/body/label/code eran los 4 la MISMA familia (Geist) — el selector
// "Familia" del editor de piezas (ver ContentBlocks.tsx, TEXT_FAMILY_OPTIONS)
// aplicaba la clase `font-{type}` correcta, pero las 4 clases resolvían al
// mismo binario de fuente, así que nunca se veía ninguna diferencia (en vivo
// NI en el visor publicado). Se sustituyen `heading` (Space Grotesk, geométrica
// con presencia, buena distinción a tamaños grandes de título) y `label`
// (Inter, diseñada para UI/legibilidad en tamaños chicos) — ambas SIL Open
// Font License, variable fonts (next/font/google resuelve el eje de peso
// completo sin declarar `weight` explícito, mismo patrón que Geist). `body`
// se queda en Geist a propósito (no cambiar la base tipográfica del sitio de
// golpe) y `code` se queda en Geist_Mono. Mismas CSS variables de siempre
// (--font-heading/--font-body/--font-label/--font-code): el sistema de
// tokens de Once UI no se toca, solo el binario detrás de cada variable.
import { Geist, Geist_Mono, Inter, Space_Grotesk } from "next/font/google";

const heading = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const body = Geist({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const label = Inter({
  variable: "--font-label",
  subsets: ["latin"],
  display: "swap",
});

const code = Geist_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  display: "swap",
});

const fonts: FontsConfig = {
  heading: heading,
  body: body,
  label: label,
  code: code,
};

// default customization applied to the HTML in the main layout.tsx
const style: StyleConfig = {
  theme: "system", // dark | light | system
  neutral: "gray", // sand | gray | slate | custom
  brand: "cyan", // blue | indigo | violet | magenta | pink | red | orange | yellow | moss | green | emerald | aqua | cyan | custom
  accent: "cyan", // blue | indigo | violet | magenta | pink | red | orange | yellow | moss | green | emerald | aqua | cyan | custom
  solid: "inverse", // color | contrast | inverse
  solidStyle: "plastic", // flat | plastic
  border: "playful", // rounded | playful | conservative
  surface: "translucent", // filled | translucent
  transition: "all", // all | micro | macro
  scaling: "100", // 90 | 95 | 100 | 105 | 110
};

const dataStyle: DataStyleConfig = {
  variant: "gradient", // flat | gradient | outline
  mode: "categorical", // categorical | divergent | sequential
  height: 24, // default chart height
  axis: {
    stroke: "var(--neutral-alpha-weak)",
  },
  tick: {
    fill: "var(--neutral-on-background-weak)",
    fontSize: 11,
    line: false,
  },
};

const effects: EffectsConfig = {
  mask: {
    cursor: false,
    x: 50,
    y: 0,
    radius: 100,
  },
  gradient: {
    display: false,
    opacity: 100,
    x: 50,
    y: 60,
    width: 100,
    height: 50,
    tilt: 0,
    colorStart: "accent-background-strong",
    colorEnd: "page-background",
  },
  dots: {
    display: true,
    opacity: 40,
    size: "2",
    color: "brand-background-strong",
  },
  grid: {
    display: false,
    opacity: 100,
    color: "neutral-alpha-medium",
    width: "0.25rem",
    height: "0.25rem",
  },
  lines: {
    display: false,
    opacity: 100,
    color: "neutral-alpha-weak",
    size: "16",
    thickness: 1,
    angle: 45,
  },
};

// default schema data
const schema: SchemaConfig = {
  logo: "/trademark/icon-light.svg",
  type: "Organization",
  name: "Hub-Nerds",
  description: home.description,
  email: "ricardo@ricolinos.com",
};

// social links
const sameAs: SameAsConfig = {
  threads: "https://www.threads.com/@rick.olinos",
  linkedin: "https://www.linkedin.com/in/ricardo-g%C3%B3mez-ruiz-velasco-448b50aa/",
  discord: "",
};

export {
  display,
  routes,
  protectedRoutes,
  baseURL,
  fonts,
  style,
  schema,
  sameAs,
  effects,
  dataStyle,
};
