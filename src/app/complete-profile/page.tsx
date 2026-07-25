"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Column, Heading, Text, Row, Input, ToggleButton, Button } from "@once-ui-system/core";
import { completeProfile } from "@/app/actions/completeProfile";
import { normalizeRole, type Role } from "@/lib/roles";

export default function CompleteProfilePage() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [role, setRole] = useState<Role | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user || prefilled) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setUsername(user.username ?? "");
    const metaWhatsapp =
      user.publicMetadata?.whatsapp ?? user.unsafeMetadata?.whatsapp;
    if (typeof metaWhatsapp === "string") setWhatsapp(metaWhatsapp);
    const metaRole = user.publicMetadata?.role ?? user.unsafeMetadata?.role;
    const normalized = normalizeRole(typeof metaRole === "string" ? metaRole : undefined);
    if (normalized) setRole(normalized);
    setPrefilled(true);
  }, [isLoaded, user, prefilled]);

  const isIncomplete =
    !role || !firstName.trim() || !lastName.trim() || !username.trim() || !whatsapp.trim();

  const handleContinue = () => {
    if (isIncomplete || !role) return;
    setErrorMsg("");
    startTransition(async () => {
      try {
        await completeProfile({
          role,
          username: username.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          whatsapp: whatsapp.trim(),
        });
        router.push("/dashboard");
      } catch (error) {
        setErrorMsg(
          error instanceof Error && error.message
            ? error.message
            : "No se pudo guardar tu perfil. Intenta de nuevo.",
        );
      }
    });
  };

  return (
    <Column fillWidth paddingY="128" horizontal="center">
      <Column maxWidth="xs" fillWidth gap="l">
        <Column gap="xs">
          <Heading variant="display-strong-s">Completa tu perfil</Heading>
          <Text variant="body-default-m" onBackground="neutral-weak">
            Cuéntanos cómo vas a usar la plataforma para personalizar tu panel.
          </Text>
        </Column>

        <Column gap="m">
          <Row gap="m">
            <Input
              id="profile-firstName"
              label="Nombre"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
            <Input
              id="profile-lastName"
              label="Apellido"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </Row>

          <Input
            id="profile-username"
            label="Nombre de usuario"
            description="Podrás usarlo para iniciar sesión en lugar de tu email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <Input
            id="profile-whatsapp"
            label="WhatsApp"
            type="tel"
            description="Ej. +52 55 1234 5678"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
          />
        </Column>

        <Column gap="s">
          <Text variant="label-default-s" onBackground="neutral-weak">
            Selecciona tu rol
          </Text>
          <Row gap="m">
            <ToggleButton fillWidth size="l" selected={role === "client"} onClick={() => setRole("client")}>
              Client
            </ToggleButton>
            <ToggleButton
              fillWidth
              size="l"
              selected={role === "freelancer"}
              onClick={() => setRole("freelancer")}
            >
              Freelancer
            </ToggleButton>
          </Row>
        </Column>

        {errorMsg && (
          <Text variant="body-default-s" onBackground="danger-weak">
            {errorMsg}
          </Text>
        )}

        <Button fillWidth loading={isPending} disabled={isIncomplete} onClick={handleContinue}>
          Continuar
        </Button>
      </Column>
    </Column>
  );
}
