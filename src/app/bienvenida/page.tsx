import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { WelcomeWizard } from "@/components/onboarding/WelcomeWizard";
import { shouldSeeOnboarding } from "@/lib/onboarding";
import { isFreelancerRole } from "@/lib/roles";
import { getOrCreateUser } from "@/lib/syncUser";

export const metadata = { title: "Te damos la bienvenida" };

/* Bienvenida guiada del freelancer.
 *
 * Aparece al registrarse y sigue apareciendo en cada inicio de sesión
 * mientras el perfil esté incompleto — posponerla no la silencia. Las guardas
 * de abajo evitan que la vea quien ya la terminó, quien ya tiene el perfil
 * armado (p. ej. lo llenó a mano) o quien no es freelancer. */
export default async function BienvenidaPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const viewer = await currentUser();

  // Los clients no tienen tarjeta ni portafolio que armar: su alta termina en
  // /complete-profile y entran directo al panel.
  if (!isFreelancerRole(viewer?.publicMetadata?.role as string | undefined)) {
    redirect("/dashboard");
  }

  const dbUser = await getOrCreateUser();
  if (!shouldSeeOnboarding(viewer?.publicMetadata, dbUser)) redirect("/dashboard");

  return (
    <WelcomeWizard
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
