import { Column, Spinner } from "@once-ui-system/core";

// Este loading.tsx de Next.js NO recibe params ni conoce el rol del dueño
// del perfil (ProfileView estilo Behance vs ClientProfileView estilo
// Monday), así que no puede elegir el skeleton correcto por sí solo. Por
// eso se mantiene deliberadamente mínimo: solo cubre la query ligera
// (prisma.user.findUnique por username) que UserProfilePage hace ANTES de
// abrir el <Suspense> con el fallback correcto por rol — ese boundary
// interno (ver src/app/[username]/page.tsx y
// src/components/profile/ProfileSkeletons.tsx) es el que muestra
// FreelancerProfileSkeleton o ClientProfileSkeleton mientras resuelve el fetch
// pesado. Como esa query ligera es rápida, este fallback casi nunca se
// llega a ver; un spinner centrado basta.
export default function UserProfileLoading() {
  return (
    <Column fillWidth horizontal="center" vertical="center" paddingY="104" minHeight={40}>
      <Spinner size="m" />
    </Column>
  );
}
