import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Column, Heading, Text } from "@once-ui-system/core";
import { getSubscriptionInfo } from "@/app/actions/billing";
import { SubscriptionManager } from "@/components/pro/SubscriptionManager";
import { normalizeRole } from "@/lib/roles";

export const metadata = {
  title: "Gestionar suscripción",
  description: "Revisa tu plan Pro, cambia de periodicidad, actualiza tu método de pago o cancela cuando quieras.",
};

// Página protegida: sin sesión, Clerk retoma aquí después del login gracias
// al redirect_url. force-dynamic evita que el estado de la suscripción quede
// atrapado en un prerender cacheado (mismo criterio que /pro, ver
// src/app/pro/page.tsx).
export const dynamic = "force-dynamic";

export default async function SuscripcionPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/pro/suscripcion");

  const viewer = await currentUser();
  const role = normalizeRole(viewer?.publicMetadata?.role as string | undefined);
  const info = await getSubscriptionInfo();

  return (
    <Column as="main" fillWidth horizontal="center" paddingY="80" paddingX="24">
      <Column fillWidth maxWidth="s" gap="32">
        <Column gap="4">
          <Heading as="h1" variant="display-strong-xs">
            Tu suscripción
          </Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Revisa tu plan, cambia de periodicidad o gestiona tus métodos de pago.
          </Text>
        </Column>

        <SubscriptionManager info={info} role={role} />
      </Column>
    </Column>
  );
}
