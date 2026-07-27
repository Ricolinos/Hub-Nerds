import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { WelcomeWizard } from "@/components/onboarding/WelcomeWizard";
import { hasSeenOnboarding } from "@/lib/onboarding";
import { isFreelancerRole } from "@/lib/roles";
import { getOrCreateUser } from "@/lib/syncUser";

export const metadata = { title: "Te damos la bienvenida" };

/* Bienvenida guiada, una sola vez, justo después del registro.
 *
 * Las tres guardas de abajo son lo que garantiza el "una sola vez": quien ya
 * la pasó (o la saltó) nunca la vuelve a ver, y quien entra a la URL a mano
 * termina en su dashboard. */
export default async function BienvenidaPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const viewer = await currentUser();
  if (hasSeenOnboarding(viewer?.publicMetadata)) redirect("/dashboard");

  // Los clients no tienen tarjeta ni portafolio que armar: su alta termina en
  // /complete-profile y entran directo al panel.
  if (!isFreelancerRole(viewer?.publicMetadata?.role as string | undefined)) {
    redirect("/dashboard");
  }

  const dbUser = await getOrCreateUser();

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
    />
  );
}
