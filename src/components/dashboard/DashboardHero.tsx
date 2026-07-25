import { Background, Column, Heading, Text } from "@once-ui-system/core";
import type { Role } from "@/lib/roles";

/* ══ Hero institucional de ambos dashboards (Fase 6b) ══════════════════
   Mismo componente para /dashboard/client y /dashboard/freelancer: solo
   cambia la copia según el rol. Presentacional puro (sin estado), así que
   no necesita "use client". ═════════════════════════════════════════════ */

const ROLE_COPY: Record<Role, { eyebrow: string; message: string }> = {
  client: {
    eyebrow: "Panel de Client",
    message:
      "Sigue el avance de tus proyectos conjuntos, revisa tareas por aprobar y coordínate con tus freelancers.",
  },
  freelancer: {
    eyebrow: "Panel de Freelancer",
    message:
      "Revisa tus proyectos activos, tus tareas asignadas y las solicitudes de contacto de nuevos clients.",
  },
};

export function DashboardHero({
  name,
  viewerRole,
}: {
  name: string | null;
  viewerRole: Role;
}) {
  const copy = ROLE_COPY[viewerRole];
  const greetingName = name?.split(" ")[0] ?? (viewerRole === "client" ? "client" : "freelancer");

  return (
    <Column
      fillWidth
      overflow="hidden"
      radius="xl"
      border="neutral-alpha-weak"
      background="surface"
      paddingY="40"
      paddingX="32"
      gap="8"
    >
      <Background
        position="absolute"
        top="0"
        left="0"
        fill
        pointerEvents="none"
        gradient={{
          display: true,
          opacity: 60,
          x: 100,
          y: 0,
          width: 150,
          height: 100,
          tilt: 0,
          colorStart: "brand-alpha-medium",
          colorEnd: "static-transparent",
        }}
      />
      {/* Column wrapper (no Text/Heading) porque Once UI no depura la prop
          zIndex antes de pasarla al DOM en esos componentes: generaba
          "React does not recognize the zIndex prop" en consola. Row/Column sí
          la resuelven a estilo, así que el zIndex vive aquí y el contenido lo
          hereda por stacking context. */}
      <Column gap="8" zIndex={1}>
        <Text variant="label-default-s" onBackground="brand-medium">
          {copy.eyebrow}
        </Text>
        <Heading variant="display-strong-xs">Hola, {greetingName}</Heading>
        <Text variant="body-default-m" onBackground="neutral-weak" style={{ maxWidth: "40rem" }}>
          {copy.message}
        </Text>
      </Column>
    </Column>
  );
}
