import { LEGAL_VERSION } from "@/resources/legal";

/* ══ Brief-hub: premio en especie (Términos §3.3/§3.5) ═════════════════════
   Un Client Free solo puede ofrecer premio MONETARY (Términos §3.3). Un
   Client Pro puede además ofrecer premio en especie bajo dos modalidades
   (§3.5): entrega directa (fee 8%, el Client asume la entrega total) o
   entrega mediante la Plataforma (fee 12%, la Plataforma se compromete a
   entregar). Los pagos reales de fees/premios son Fase 3; aquí solo el
   modelado, las validaciones (src/app/actions/contests.ts) y el texto de la
   carta de responsabilidad que el Client debe aceptar antes de publicar. ══ */

export const PRIZE_TYPES = ["MONETARY", "IN_KIND_DIRECT", "IN_KIND_PLATFORM"] as const;

export type PrizeType = (typeof PRIZE_TYPES)[number];

export function isPrizeType(value: unknown): value is PrizeType {
  return typeof value === "string" && (PRIZE_TYPES as readonly string[]).includes(value);
}

// Tipos de premio en especie (subconjunto de PrizeType que requiere carta de
// responsabilidad + prizeDescription).
export type InKindPrizeType = Extract<PrizeType, "IN_KIND_DIRECT" | "IN_KIND_PLATFORM">;

export function isInKindPrizeType(prizeType: PrizeType): prizeType is InKindPrizeType {
  return prizeType === "IN_KIND_DIRECT" || prizeType === "IN_KIND_PLATFORM";
}

// Tarifa (%) sobre el valor declarado del premio, estampada en
// Contest.prizeFeePct al elegir la modalidad (Términos §3.5). null para
// MONETARY: no hay fee de premio en especie que cobrar.
export const PRIZE_FEE_PCT: Record<PrizeType, number | null> = {
  MONETARY: null,
  IN_KIND_DIRECT: 8,
  IN_KIND_PLATFORM: 12,
};

// Máximo de caracteres de Contest.prizeDescription, validado en
// createContest/updateContest (src/app/actions/contests.ts).
export const PRIZE_DESCRIPTION_MAX_LENGTH = 500;

/* ══ Carta de responsabilidad ════════════════════════════════════════════
   Se muestra al Client Pro antes de aceptar (acceptPrizeResponsibility) y
   queda registrada en Contest.responsibilityAcceptedAt/responsibilityVersion.
   Redactada en español formal mexicano, coherente con el tono de los
   Términos (src/app/legal/terminos/page.tsx §3.5 y §7). ══════════════════ */

export interface ResponsibilityLetter {
  title: string;
  body: string[];
}

export const RESPONSIBILITY_LETTER: Record<InKindPrizeType, ResponsibilityLetter> = {
  IN_KIND_DIRECT: {
    title: "Carta de responsabilidad — Entrega directa del premio en especie",
    body: [
      "En mi carácter de Client responsable de esta convocatoria, declaro bajo protesta de decir verdad que el valor total declarado del premio en especie descrito es veraz y corresponde a su valor real de mercado.",
      "Acepto la tarifa del ocho por ciento (8%) sobre dicho valor declarado, correspondiente a la modalidad de entrega directa conforme a los Términos y Condiciones §3.5.",
      "Asumo de manera exclusiva y total la obligación de entregar el premio en especie al ganador y a los finalistas de la Terna, en los términos y plazos ofrecidos en esta convocatoria, deslindando a Hub-Nerds (la \"Plataforma\") de toda responsabilidad por la entrega física o material del premio.",
      "Entiendo y acepto que el incumplimiento de esta obligación de entrega, así como la falsedad en el valor declarado del premio, se sancionará conforme a lo previsto en la §7 de los Términos y Condiciones (suspensión y terminación de cuentas).",
      "Esta aceptación queda registrada junto con la fecha y la versión vigente de los Términos y Condiciones al momento de firmarla.",
    ],
  },
  IN_KIND_PLATFORM: {
    title: "Carta de responsabilidad — Entrega del premio en especie mediante la Plataforma",
    body: [
      "En mi carácter de Client responsable de esta convocatoria, declaro bajo protesta de decir verdad que el valor total declarado del premio en especie descrito es veraz y corresponde a su valor real de mercado.",
      "Acepto la tarifa del doce por ciento (12%) sobre dicho valor declarado, correspondiente a la modalidad de entrega mediante la Plataforma conforme a los Términos y Condiciones §3.5.",
      "Me obligo a poner el premio en especie a disposición de Hub-Nerds (la \"Plataforma\"), conforme a las instrucciones que esta me indique, para que sea la propia Plataforma quien lo haga llegar al ganador y a los finalistas de la Terna.",
      "Entiendo y acepto que, bajo esta modalidad, es la Plataforma quien asume el compromiso de entrega del premio al ganador y finalistas, y que la falsedad en el valor declarado del premio se sancionará conforme a lo previsto en la §7 de los Términos y Condiciones (suspensión y terminación de cuentas).",
      "Esta aceptación queda registrada junto con la fecha y la versión vigente de los Términos y Condiciones al momento de firmarla.",
    ],
  },
};

// Snapshot de LEGAL_VERSION vigente, estampado en
// Contest.responsibilityVersion al aceptar la carta (acceptPrizeResponsibility).
export const RESPONSIBILITY_VERSION = LEGAL_VERSION;
