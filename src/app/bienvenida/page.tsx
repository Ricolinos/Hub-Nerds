import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClientWelcomeWizard } from "@/components/onboarding/ClientWelcomeWizard";
import { WelcomeWizard } from "@/components/onboarding/WelcomeWizard";
import type { TalentCard } from "@/components/onboarding/TalentPreview";
import { shouldSeeOnboarding } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";
import { FREELANCER_ROLE_VALUES, isFreelancerRole } from "@/lib/roles";
import { getOrCreateUser } from "@/lib/syncUser";

export const metadata = { title: "Te damos la bienvenida" };

/* Bienvenida guiada, común a los dos roles.
 *
 * Aparece al registrarse y sigue apareciendo en cada inicio de sesión
 * mientras el perfil esté incompleto — posponerla no la silencia. El mínimo
 * que cuenta como "completo" es distinto por rol (ver shouldSeeOnboarding).
 */
export default async function BienvenidaPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const viewer = await currentUser();
  const dbUser = await getOrCreateUser();

  // El rol se toma de Postgres primero: justo tras el registro la sesión de
  // Clerk todavía puede traer la metadata vieja (mismo motivo que en
  // /dashboard, que es el único punto de reparto).
  const isFreelancer = isFreelancerRole(
    dbUser?.role ?? (viewer?.publicMetadata?.role as string | undefined),
  );

  if (!shouldSeeOnboarding(viewer?.publicMetadata, dbUser, isFreelancer ? "freelancer" : "client")) {
    redirect("/dashboard");
  }

  // Altas por Google/Facebook llegan sin contraseña: ambos asistentes añaden
  // un primer paso para configurarla. Se resuelve en el servidor para que el
  // número de pasos no cambie a mitad de render.
  const needsPassword = viewer ? !viewer.passwordEnabled : false;

  if (isFreelancer) {
    return (
      <WelcomeWizard
        needsPassword={needsPassword}
        firstName={viewer?.firstName ?? null}
        username={dbUser?.username ?? viewer?.username ?? null}
        name={dbUser?.name ?? null}
        avatarUrl={dbUser?.imageUrl ?? viewer?.imageUrl ?? null}
        initialPrimaryRole={dbUser?.primaryRole ?? null}
        initialSecondaryRoles={dbUser?.secondaryRoles ?? []}
        initialHeadline={dbUser?.headline ?? null}
        initialBio={dbUser?.bio ?? null}
        initialCardQuote={dbUser?.cardQuote ?? null}
        initialFeaturedImageUrl={dbUser?.featuredImageUrl ?? null}
        initialAppearance={{
          brand: dbUser?.profileBrand ?? null,
          accent: dbUser?.profileAccent ?? null,
          neutral: dbUser?.profileNeutral ?? null,
        }}
      />
    );
  }

  // Vitrina de talento REAL para el client: es lo que vino a buscar, y hace
  // las veces de la recompensa que para el freelancer es su propia tarjeta.
  // Solo perfiles públicos y ya presentables (con profesión definida).
  const rows = await prisma.user.findMany({
    where: {
      role: { in: FREELANCER_ROLE_VALUES },
      isPublic: true,
      primaryRole: { not: null },
    },
    select: {
      id: true,
      name: true,
      username: true,
      imageUrl: true,
      featuredImageUrl: true,
      headline: true,
      primaryRole: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });

  const talent: TalentCard[] = rows.map((row) => ({
    id: row.id,
    name: row.name ?? row.username ?? "Talento",
    username: row.username,
    avatar: row.imageUrl,
    featuredImageUrl: row.featuredImageUrl,
    headline: row.headline,
    primaryRole: row.primaryRole,
  }));

  return (
    <ClientWelcomeWizard
      needsPassword={needsPassword}
      firstName={viewer?.firstName ?? null}
      name={dbUser?.name ?? null}
      username={dbUser?.username ?? viewer?.username ?? null}
      avatarUrl={dbUser?.imageUrl ?? viewer?.imageUrl ?? null}
      initialCompany={dbUser?.company ?? null}
      initialBrand={dbUser?.brand ?? null}
      initialIndustry={dbUser?.industry ?? null}
      initialContactPreference={dbUser?.contactPreference ?? null}
      initialContactHours={dbUser?.contactHours ?? null}
      initialWebsite={dbUser?.website ?? null}
      talent={talent}
    />
  );
}
