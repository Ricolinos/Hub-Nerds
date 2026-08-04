"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isFreelancerRole } from "@/lib/roles";
import type { CvData, CvEducation, CvExperience, CvQrTarget, CvSkill } from "@/lib/cvData";

// Límites del CV Live, validados/recortados server-side (nunca en el schema,
// mismo patrón que el resto de las server actions de perfil, ver
// src/app/actions/updateProfile.ts).
const MAX_INTRO_CHARS = 600;
const MAX_LOCATION_CHARS = 200;
const MAX_LANGUAGES = 5;
const MAX_LANGUAGE_CHARS = 200;
const MAX_EXPERIENCES = 10;
const MAX_SKILLS = 20;
const MAX_EDUCATION = 6;
const MAX_STRING_CHARS = 200;
const MAX_ACHIEVEMENTS = 10;
const QR_TARGETS: CvQrTarget[] = ["portfolio", "cv"];

function truncate(value: unknown, max: number): string {
  const str = typeof value === "string" ? value : "";
  return str.slice(0, max);
}

function sanitizeExperience(value: CvExperience): CvExperience {
  return {
    id: truncate(value.id, MAX_STRING_CHARS) || "exp",
    role: truncate(value.role, MAX_STRING_CHARS),
    company: truncate(value.company, MAX_STRING_CHARS),
    startLabel: truncate(value.startLabel, MAX_STRING_CHARS),
    endLabel: value.endLabel ? truncate(value.endLabel, MAX_STRING_CHARS) : null,
    description: truncate(value.description, MAX_STRING_CHARS),
    achievements: Array.isArray(value.achievements)
      ? value.achievements.slice(0, MAX_ACHIEVEMENTS).map((a) => truncate(a, MAX_STRING_CHARS))
      : [],
  };
}

function sanitizeSkill(value: CvSkill): CvSkill | null {
  const name = truncate(value.name, MAX_STRING_CHARS);
  if (!name) return null;
  const level = Number(value.level);
  const clampedLevel = Math.min(5, Math.max(1, Number.isInteger(level) ? level : 1)) as CvSkill["level"];
  return { name, level: clampedLevel };
}

function sanitizeEducation(value: CvEducation): CvEducation {
  return {
    id: truncate(value.id, MAX_STRING_CHARS) || "edu",
    title: truncate(value.title, MAX_STRING_CHARS),
    institution: truncate(value.institution, MAX_STRING_CHARS),
    year: truncate(value.year, MAX_STRING_CHARS),
  };
}

// Recorta/sanea el shape entrante a los límites del CV Live. No lanza ante
// datos incompletos: recorta lo que exceda y descarta lo inválido.
function sanitizeCvData(data: CvData): CvData {
  const qrTarget: CvQrTarget = QR_TARGETS.includes(data.qrTarget) ? data.qrTarget : "portfolio";

  return {
    intro: truncate(data.intro, MAX_INTRO_CHARS),
    location: truncate(data.location, MAX_LOCATION_CHARS),
    languages: Array.isArray(data.languages)
      ? data.languages
          .slice(0, MAX_LANGUAGES)
          .map((lang) => truncate(lang, MAX_LANGUAGE_CHARS))
          .filter(Boolean)
      : [],
    qrTarget,
    experiences: Array.isArray(data.experiences)
      ? data.experiences.slice(0, MAX_EXPERIENCES).map(sanitizeExperience)
      : [],
    skills: Array.isArray(data.skills)
      ? data.skills
          .slice(0, MAX_SKILLS)
          .map(sanitizeSkill)
          .filter((skill): skill is CvSkill => skill !== null)
      : [],
    education: Array.isArray(data.education)
      ? data.education.slice(0, MAX_EDUCATION).map(sanitizeEducation)
      : [],
  };
}

// Actualiza el CV Live del propio Freelancer. Escribe User.cvData completo
// (reemplazo total, no merge parcial): el editor de CV manda el objeto
// entero ya armado.
//
// TODO: exigir isPro(user) cuando el webhook esté en producción. Por ahora
// no se gatea (el webhook de Stripe aún no está probado en producción y los
// usuarios demo/seed son todos plan "free"): cualquier Freelancer puede
// guardar su CV, y la UI decide dónde mostrarlo (CV_LIVE_PREVIEW).
export async function updateCvData(data: CvData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, username: true },
  });
  if (!user || !isFreelancerRole(user.role)) {
    throw new Error("Solo disponible para Freelancers.");
  }

  const cvData = sanitizeCvData(data);

  await prisma.user.update({
    where: { id: userId },
    data: { cvData: cvData as unknown as Prisma.InputJsonValue },
  });

  if (user.username) {
    revalidatePath(`/${user.username}`);
    revalidatePath(`/${user.username}/cv`);
  }
}
