import { currentUser } from "@clerk/nextjs/server";
import { Meta } from "@once-ui-system/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AppearanceScope } from "@/components/profile/AppearanceScope";
import type { ProfileAppearanceValue } from "@/components/profile/AppearancePanel";
import { ClientProfileView } from "@/components/profile/ClientProfileView";
import {
  ClientProfileSkeleton,
  FreelancerProfileSkeleton,
} from "@/components/profile/ProfileSkeletons";
import { ProfileView } from "@/components/profile/ProfileView";
import { caseStudyHref } from "@/lib/caseStudies";
import { getCvData } from "@/lib/cvData";
import { getClientCollabData, getFreelancerCollabData } from "@/lib/collab";
import { prisma } from "@/lib/prisma";
import { getOrCreateUser } from "@/lib/syncUser";
import { FREELANCER_ROLE_VALUES, isFreelancerRole, normalizeRole, type Role } from "@/lib/roles";
import { baseURL } from "@/resources";

interface UserProfilePageProps {
  params: Promise<{ username: string }>;
  // ?editar=1 abre automáticamente el modal de edición del dueño al montar
  // (ver ProfileView/ClientProfileView, openEditOnMount) — usado por el
  // menú del avatar del Header ("Editar Perfil"). Se lee aquí (server
  // component) y NO con useSearchParams en un client component: eso rompió
  // el prerender de producción una vez (ver commit del modal de /mensajes).
  searchParams: Promise<{ editar?: string }>;
}

type ClerkViewer = Awaited<ReturnType<typeof currentUser>>;
type ProfileUserRecord = Awaited<ReturnType<typeof prisma.user.findUnique>>;

// Igual que la página: perfiles de client son privados y los de freelancer no
// públicos no deben filtrar nombre/avatar en la tarjeta de preview al
// compartir el link (mismo criterio de privacidad, ver comentario abajo).
export async function generateMetadata({ params }: UserProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  const profileUser = await prisma.user.findUnique({ where: { username } });

  if (!profileUser || !isFreelancerRole(profileUser.role) || !profileUser.isPublic) {
    return {};
  }

  const displayName = profileUser.name || username;
  // Tarjeta OG propia (estilo Designerd: avatar + glow de marca + rol +
  // cita) en vez de la foto cruda de Clerk sin diseño.
  const image = `/api/og/perfil?u=${encodeURIComponent(username)}`;

  return Meta.generate({
    title: displayName,
    description: `Perfil de ${displayName} (@${username}) en Hub-Nerds`,
    baseURL,
    path: `/${username}`,
    image,
  });
}

export default async function UserProfilePage({ params, searchParams }: UserProfilePageProps) {
  const { username } = await params;
  const { editar } = await searchParams;
  const openEditOnMount = editar === "1";
  await getOrCreateUser();
  const viewer = await currentUser();

  const isOwnProfile = viewer?.username === username;
  // Query ligera (lookup indexado por username) que resuelve el 404 temprano,
  // decide el rol para elegir el fallback de Suspense correcto, Y (al no
  // llevar `select`) ya trae profileBrand/profileAccent/profileNeutral: se
  // reutilizan abajo para el AppearanceScope EXTERIOR, sin duplicar el
  // select ni pagar una segunda consulta. Todo el fetch pesado (piezas,
  // cotizaciones, colaboración, discoverableFreelancers) vive en ProfileContent,
  // dentro del boundary.
  const profileUser = await prisma.user.findUnique({ where: { username } });

  // Username sin usuario en BD y que tampoco es el perfil propio del viewer → 404
  if (!profileUser && !isOwnProfile) {
    notFound();
  }

  // Rol del dueño del perfil: BD primero; para perfil propio aún sin fila, metadata de Clerk.
  // Normalizado a "client"|"freelancer" (tolera el valor legado "collaborator"
  // mientras no corra la migración de datos, ver src/lib/roles.ts).
  const viewerRole = viewer?.publicMetadata?.role;
  const role: Role =
    normalizeRole(profileUser?.role) ??
    (isOwnProfile ? normalizeRole(viewerRole as string | undefined) : undefined) ??
    "client";

  // Perfiles de client son privados: solo el dueño puede verlos, ni
  // modificando la URL ni de ninguna otra forma. (Compartir con freelancers
  // específicos queda para una iteración futura.)
  if (role !== "freelancer" && !isOwnProfile) {
    notFound();
  }

  // Paleta GUARDADA del dueño del perfil (null en cualquier campo = sin
  // override, hereda la marca Hub-Nerds). Se aplica en un AppearanceScope
  // EXTERIOR al <Suspense> —no dentro de ProfileView, que solo resuelve tras
  // el fetch pesado— para que el <html> ya quede teñido ANTES de que se
  // pinte siquiera el fallback: la secuencia visual queda color → skeleton ya
  // teñido → elementos, en vez de skeleton en cyan del sitio seguido de un
  // salto brusco de color + contenido a la vez. ProfileView monta su PROPIO
  // AppearanceScope interior (misma paleta guardada por defecto, se desvía
  // en vivo con el preview del dueño mientras edita) — ambas instancias
  // conviven sin pelearse vía el stack de prioridad de
  // appearanceOverrideController (ver AppearanceScope.tsx).
  const savedAppearance: ProfileAppearanceValue = {
    brand: profileUser?.profileBrand ?? null,
    accent: profileUser?.profileAccent ?? null,
    neutral: profileUser?.profileNeutral ?? null,
  };

  return (
    <AppearanceScope appearance={savedAppearance}>
      <Suspense
        fallback={role === "freelancer" ? <FreelancerProfileSkeleton /> : <ClientProfileSkeleton />}
      >
        <ProfileContent
          username={username}
          viewer={viewer}
          profileUser={profileUser}
          isOwnProfile={isOwnProfile}
          role={role}
          openEditOnMount={openEditOnMount}
        />
      </Suspense>
    </AppearanceScope>
  );
}

interface ProfileContentProps {
  username: string;
  viewer: ClerkViewer;
  profileUser: ProfileUserRecord;
  isOwnProfile: boolean;
  role: Role;
  openEditOnMount: boolean;
}

// Todo el fetch pesado (piezas de portafolio, cotizaciones, colaboración con
// clients/freelancers, discoverableFreelancers) vive aquí para que el Suspense de
// la página muestre el skeleton correcto (freelancer o client) mientras
// resuelve, sin bloquear el 404/bifurcación temprana de arriba.
async function ProfileContent({
  username,
  viewer,
  profileUser,
  isOwnProfile,
  role,
  openEditOnMount,
}: ProfileContentProps) {
  const displayName = isOwnProfile
    ? [viewer?.firstName, viewer?.lastName].filter(Boolean).join(" ") || username
    : profileUser?.name || username;
  const avatarUrl = isOwnProfile ? viewer?.imageUrl : (profileUser?.imageUrl ?? undefined);

  const ownerId = profileUser?.id ?? (isOwnProfile ? viewer?.id : undefined);
  const quotes = ownerId
    ? await prisma.projectQuote.findMany({
        where: { userId: ownerId },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const projects = quotes.map((quote) => ({
    id: quote.id,
    title: quote.title,
    clientName: quote.clientName,
    status: quote.status,
    currency: quote.currency,
    total: quote.total === null ? null : Number(quote.total),
    updatedAt: quote.updatedAt.toISOString(),
  }));

  // El WhatsApp de un freelancer solo se revela si él mismo lo activó (opt-in)
  // y quien visita es un usuario logueado de la plataforma; nunca a público
  // anónimo. Al dueño no le hace falta este dato en la vista (edita desde el
  // diálogo de configuración), así que se omite también en su propio perfil.
  const isLoggedIn = Boolean(viewer);
  const canSeeWhatsapp = !isOwnProfile && isLoggedIn && Boolean(profileUser?.shareWhatsapp);

  // Freelancers: showcase estilo Behance con sus proyectos reales.
  if (role === "freelancer") {
    // Los visitantes solo ven piezas públicas; el dueño también sus borradores.
    const rawPieces = ownerId
      ? await prisma.portfolioPiece.findMany({
          where: { userId: ownerId, ...(isOwnProfile ? {} : { isPublic: true }) },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            coverUrl: true,
            views: true,
            likes: true,
            isPublic: true,
            createdAt: true,
            markdownContent: true,
          },
        })
      : [];

    // Enlaza cada pieza a su caso de estudio: MDX en BD (editor propio) o
    // legado en archivo, lo que exista. markdownContent solo se usa aquí
    // para decidir el link — no se manda al client (puede pesar mucho).
    const pieces = rawPieces.map(({ markdownContent, ...piece }) => ({
      ...piece,
      coverUrl: piece.coverUrl ?? "",
      createdAt: piece.createdAt.toISOString(),
      href: caseStudyHref(username, piece.title, Boolean(markdownContent)),
    }));

    // Perfil propio del freelancer: panel de colaboración (solicitudes,
    // proyectos conjuntos, recursos que los clients le compartieron).
    const freelancerCollabData = isOwnProfile && ownerId ? await getFreelancerCollabData(ownerId) : null;

    // Viewer ajeno logueado como client: se le habilita el botón de
    // contacto y se le informa el estatus de su Connection con este freelancer,
    // si existe.
    let viewerCanContact = false;
    let viewerConnectionStatus: "PENDING" | "ACCEPTED" | "REJECTED" | null = null;
    if (!isOwnProfile && viewer && ownerId) {
      const viewerUser = await prisma.user.findUnique({
        where: { id: viewer.id },
        select: { role: true },
      });
      if (viewerUser?.role === "client") {
        viewerCanContact = true;
        const existingConnection = await prisma.connection.findUnique({
          where: { clientId_freelancerId: { clientId: viewer.id, freelancerId: ownerId } },
          select: { status: true },
        });
        viewerConnectionStatus = existingConnection?.status ?? null;
      }
    }

    return (
      <ProfileView
        displayName={displayName}
        avatarUrl={avatarUrl}
        isOwnProfile={isOwnProfile}
        username={username}
        whatsapp={canSeeWhatsapp ? profileUser?.whatsapp : undefined}
        email={isOwnProfile ? viewer?.emailAddresses[0]?.emailAddress : undefined}
        memberSince={profileUser?.createdAt.toISOString()}
        isPublic={profileUser?.isPublic ?? true}
        shareWhatsapp={profileUser?.shareWhatsapp ?? false}
        allowProContact={profileUser?.allowProContact ?? false}
        featuredImageUrl={profileUser?.featuredImageUrl}
        cardQuote={profileUser?.cardQuote}
        headline={profileUser?.headline}
        bio={profileUser?.bio}
        primaryRole={profileUser?.primaryRole}
        secondaryRoles={profileUser?.secondaryRoles ?? []}
        profileBrand={profileUser?.profileBrand}
        profileAccent={profileUser?.profileAccent}
        profileNeutral={profileUser?.profileNeutral}
        profileBorder={profileUser?.profileBorder}
        projects={projects}
        pieces={pieces}
        cvData={getCvData(profileUser ?? {})}
        plan={profileUser?.plan}
        planStatus={profileUser?.planStatus}
        freelancerId={ownerId}
        pendingRequests={freelancerCollabData?.pendingRequests}
        freelancerConnections={freelancerCollabData?.connections}
        collabProjects={freelancerCollabData?.projects}
        sharedResources={freelancerCollabData?.sharedResources}
        viewerCanContact={viewerCanContact}
        viewerConnectionStatus={viewerConnectionStatus}
        openEditOnMount={openEditOnMount}
      />
    );
  }

  // Clients: dashboard con proyectos contratados, diseñadores y recursos.
  // (Este bloque solo corre para isOwnProfile: los perfiles de client ajenos
  // ya fueron bloqueados arriba, así que el client que llega aquí siempre
  // está logueado como sí mismo.)
  const clientCollabData = ownerId ? await getClientCollabData(ownerId) : null;

  // "Buscar más talento" (CollaboratorSearchModal): freelancers públicos con los
  // que el client todavía no tiene ninguna Connection, para poder enviarles
  // una solicitud de contacto directo desde el buscador.
  const connectedFreelancerIds = (clientCollabData?.connections ?? []).map(
    (connection) => connection.freelancer.id,
  );
  const discoverableFreelancers = ownerId
    ? await prisma.user.findMany({
        where: {
          role: { in: FREELANCER_ROLE_VALUES },
          isPublic: true,
          id: { notIn: [...connectedFreelancerIds, ownerId] },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, username: true, headline: true },
        take: 30,
      })
    : [];

  return (
    <ClientProfileView
      displayName={displayName}
      avatarUrl={avatarUrl}
      isOwnProfile={isOwnProfile}
      email={isOwnProfile ? viewer?.emailAddresses[0]?.emailAddress : undefined}
      firstName={isOwnProfile ? viewer?.firstName : undefined}
      lastName={isOwnProfile ? viewer?.lastName : undefined}
      username={isOwnProfile ? viewer?.username : undefined}
      whatsapp={isOwnProfile ? profileUser?.whatsapp : undefined}
      secondaryEmail={isOwnProfile ? profileUser?.secondaryEmail : undefined}
      address={isOwnProfile ? profileUser?.address : undefined}
      company={profileUser?.company}
      brand={profileUser?.brand}
      motto={profileUser?.motto}
      contactPreference={isOwnProfile ? profileUser?.contactPreference : undefined}
      contactHours={isOwnProfile ? profileUser?.contactHours : undefined}
      website={profileUser?.website}
      industry={profileUser?.industry}
      projects={projects}
      connections={clientCollabData?.connections}
      collabProjects={clientCollabData?.projects}
      resources={clientCollabData?.resources}
      discoverableFreelancers={discoverableFreelancers}
      openEditOnMount={openEditOnMount}
    />
  );
}
