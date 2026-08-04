// ─────────────────────────────────────────────────────────────────────────
// CV Live: shape persistido en User.cvData (Json?, ver prisma/schema.prisma)
// y helpers para leerlo de forma segura. Hasta que el editor de CV (ola
// siguiente) escriba datos reales, getCvData() cae al mock histórico
// (src/lib/mockCvLive.ts) para que la UI no cambie de comportamiento.
// ─────────────────────────────────────────────────────────────────────────

import {
  type CvEducation,
  type CvExperience,
  type CvSkill,
  MOCK_CV_EDUCATION,
  MOCK_CV_EXPERIENCES,
  MOCK_CV_INTRO,
  MOCK_CV_LANGUAGES,
  MOCK_CV_LOCATION,
  MOCK_CV_SKILLS,
} from "@/lib/mockCvLive";

export type { CvEducation, CvExperience, CvSkill };

// Hacia dónde apunta el QR de la tarjeta Designerd cuando el Freelancer
// activa CV Live: al portafolio (default) o directo al CV.
export type CvQrTarget = "portfolio" | "cv";

export interface CvData {
  intro: string;
  location: string;
  languages: string[];
  qrTarget: CvQrTarget;
  experiences: CvExperience[];
  skills: CvSkill[];
  education: CvEducation[];
}

// El mock ensamblado como CvData: fallback cuando el usuario no tiene
// `cvData` guardado todavía.
export const DEFAULT_CV_DATA: CvData = {
  intro: MOCK_CV_INTRO,
  location: MOCK_CV_LOCATION,
  languages: [...MOCK_CV_LANGUAGES],
  qrTarget: "portfolio",
  experiences: MOCK_CV_EXPERIENCES,
  skills: MOCK_CV_SKILLS,
  education: MOCK_CV_EDUCATION,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback;
}

function cleanStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return cleaned.length > 0 ? cleaned : fallback;
}

function cleanQrTarget(value: unknown, fallback: CvQrTarget): CvQrTarget {
  return value === "portfolio" || value === "cv" ? value : fallback;
}

function cleanExperience(value: unknown): CvExperience | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id.trim() !== "" ? value.id : null;
  const role = typeof value.role === "string" ? value.role : null;
  const company = typeof value.company === "string" ? value.company : null;
  const startLabel = typeof value.startLabel === "string" ? value.startLabel : null;
  if (!id || !role || !company || !startLabel) return null;
  return {
    id,
    role,
    company,
    startLabel,
    endLabel: typeof value.endLabel === "string" ? value.endLabel : null,
    description: typeof value.description === "string" ? value.description : "",
    achievements: Array.isArray(value.achievements)
      ? value.achievements.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function cleanSkill(value: unknown): CvSkill | null {
  if (!isRecord(value)) return null;
  const name = typeof value.name === "string" && value.name.trim() !== "" ? value.name : null;
  const level = value.level;
  if (!name || typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 5) return null;
  return { name, level: level as CvSkill["level"] };
}

function cleanEducation(value: unknown): CvEducation | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" && value.id.trim() !== "" ? value.id : null;
  const title = typeof value.title === "string" ? value.title : null;
  const institution = typeof value.institution === "string" ? value.institution : null;
  const year = typeof value.year === "string" ? value.year : null;
  if (!id || !title || !institution || !year) return null;
  return { id, title, institution, year };
}

function cleanList<T>(
  value: unknown,
  clean: (item: unknown) => T | null,
  fallback: T[],
): T[] {
  if (!Array.isArray(value)) return fallback;
  const cleaned = value.map(clean).filter((item): item is T => item !== null);
  return cleaned.length > 0 ? cleaned : fallback;
}

// Parsea/valida el Json guardado en User.cvData, con default campo a campo
// hacia el mock histórico. Nunca lanza: ante Json malformado o ausente,
// devuelve DEFAULT_CV_DATA (o una mezcla segura de lo que sí sea válido).
export function getCvData(user: { cvData?: unknown }): CvData {
  const raw = user.cvData;
  if (!isRecord(raw)) return DEFAULT_CV_DATA;

  return {
    intro: cleanString(raw.intro, DEFAULT_CV_DATA.intro),
    location: cleanString(raw.location, DEFAULT_CV_DATA.location),
    languages: cleanStringArray(raw.languages, DEFAULT_CV_DATA.languages),
    qrTarget: cleanQrTarget(raw.qrTarget, DEFAULT_CV_DATA.qrTarget),
    experiences: cleanList(raw.experiences, cleanExperience, DEFAULT_CV_DATA.experiences),
    skills: cleanList(raw.skills, cleanSkill, DEFAULT_CV_DATA.skills),
    education: cleanList(raw.education, cleanEducation, DEFAULT_CV_DATA.education),
  };
}
