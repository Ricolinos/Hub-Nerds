import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { shouldSeeOnboarding } from "@/lib/onboarding";
import { isFreelancerRole, normalizeRole } from "@/lib/roles";
import { getOrCreateUser } from "@/lib/syncUser";

/* Único punto de reparto después de autenticarse.
 *
 * Todos los formularios de auth mandan aquí (window.location.href =
 * "/dashboard") y ESTA página decide el destino en un solo salto de servidor.
 * Antes la decisión estaba repartida entre /complete-profile, /dashboard y
 * /dashboard/freelancer, y el usuario veía la cadena completa parpadear:
 * panel → perfil → bienvenida.
 *
 * El rol se toma de Postgres y NO de publicMetadata de Clerk: justo después
 * del registro la sesión todavía trae la metadata vieja, y ese desfase era lo
 * que disparaba el rebote. completeProfile() escribe ambos, así que la fila
 * de Postgres ya es correcta cuando se llega aquí.
 *
 * Destinos:
 *   sin rol               → /complete-profile
 *   client                → /dashboard/client
 *   freelancer nuevo      → /bienvenida  (el registro: la bienvenida es clave)
 *   freelancer con perfil → su propio perfil, no el panel de proyectos
 */
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [viewer, dbUser] = await Promise.all([currentUser(), getOrCreateUser()]);

  const role =
    normalizeRole(dbUser?.role) ??
    normalizeRole(viewer?.publicMetadata?.role as string | undefined) ??
    normalizeRole(viewer?.unsafeMetadata?.role as string | undefined);

  if (!role) redirect("/complete-profile");

  // Reconcilia publicMetadata cuando la BD ya sabe el rol pero Clerk no (alta
  // por OAuth, o la propia carrera de arriba): el resto de la app sí lee la
  // metadata y se quedaría con el valor viejo.
  if (normalizeRole(viewer?.publicMetadata?.role as string | undefined) !== role) {
    const client = await clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: { ...(viewer?.publicMetadata ?? {}), role },
    });
  }

  if (!isFreelancerRole(role)) redirect("/dashboard/client");

  if (shouldSeeOnboarding(viewer?.publicMetadata, dbUser)) redirect("/bienvenida");

  // Ya pasó por la bienvenida: a partir de aquí lo primero que ve al entrar es
  // su propio perfil, que es su espacio de trabajo real. El panel de proyectos
  // sigue disponible desde el menú.
  redirect(dbUser?.username ? `/${dbUser.username}` : "/dashboard/freelancer");
}
