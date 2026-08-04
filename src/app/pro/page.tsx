import { currentUser } from "@clerk/nextjs/server";
import { ProPricing } from "@/components/pro/ProPricing";
import { isPromoActive } from "@/lib/proPlans";
import { normalizeRole } from "@/lib/roles";

export const metadata = {
  title: "Hazte Pro",
  description:
    "Más visibilidad, más herramientas y una presencia que destaca en Hub-Nerds, para freelancers y clients.",
};

// Lee la sesión (rol vía publicMetadata, mismo criterio que /[username]) y
// evalúa la promo en el server por request: currentUser() ya vuelve la
// página dinámica, pero se fija force-dynamic explícito (patrón del resto
// del sitio, ver /explorar, /convocatorias) para que el corte del 3-ago-2027
// nunca quede atrapado en un prerender estático cacheado.
export const dynamic = "force-dynamic";

export default async function ProPage() {
  const viewer = await currentUser();
  const isSignedIn = Boolean(viewer);
  const role = normalizeRole(viewer?.publicMetadata?.role as string | undefined);
  const promoActive = isPromoActive();

  return <ProPricing isSignedIn={isSignedIn} role={role} promoActive={promoActive} />;
}
