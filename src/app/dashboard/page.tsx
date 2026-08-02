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
 *   usuario nuevo         → /bienvenida  (el registro: la bienvenida es clave)
 *   perfil ya armado      → su propio perfil, no el panel de proyectos
 */
export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [viewer, dbUser] = await Promise.all([currentUser(), getOrCreateUser()]);

  const role =
    normalizeRole(dbUser?.role) ??
    normalizeRole(viewer?.publicMetadata?.role as string | undefined) ??
    normalizeRole(viewer?.unsafeMetadata?.role as string | undefined);

  // El gate no puede basarse solo en el rol: getOrCreateUser() (syncUser.ts)
  // inventa "client" cuando Clerk no trae rol, así que !role nunca es cierto y
  // el alta por OAuth se saltaba /complete-profile. La aceptación de los
  // Términos sí es señal fiable: solo la escriben completeProfile() (en
  // publicMetadata) o el alta por email (SignUpForm.tsx, en unsafeMetadata,
  // igual que el rol dos líneas arriba), y los usuarios previos a su
  // publicación no la tienen.
  const termsAccepted =
    viewer?.publicMetadata?.termsVersion ?? viewer?.unsafeMetadata?.termsVersion;
  if (!role || !termsAccepted) redirect("/complete-profile");

  // Reconcilia publicMetadata cuando la BD ya sabe el rol pero Clerk no (alta
  // por OAuth, o la propia carrera de arriba): el resto de la app sí lee la
  // metadata y se quedaría con el valor viejo.
  if (normalizeRole(viewer?.publicMetadata?.role as string | undefined) !== role) {
    const client = await clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: { ...(viewer?.publicMetadata ?? {}), role },
    });
  }

  if (shouldSeeOnboarding(viewer?.publicMetadata, dbUser, role)) redirect("/bienvenida");

  // Ya pasó por la bienvenida: a partir de aquí lo primero que ve al entrar es
  // su propio perfil, que es su espacio de trabajo real (para el client, su
  // panel de proyectos contratados). El panel sigue disponible desde el menú.
  const fallback = isFreelancerRole(role) ? "/dashboard/freelancer" : "/dashboard/client";
  redirect(dbUser?.username ? `/${dbUser.username}` : fallback);
}
