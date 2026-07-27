"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  CelebrationFx,
  Column,
  Feedback,
  Heading,
  Icon,
  Input,
  ProgressBar,
  RevealFx,
  Row,
  Text,
  Textarea,
  ToggleButton,
} from "@once-ui-system/core";
import { MediaUpload } from "@once-ui-system/core/modules";
import {
  finishOnboarding,
  saveOnboardingFeaturedImage,
  saveOnboardingPresentation,
  saveOnboardingRoles,
} from "@/app/actions/onboarding";
import { ImageCropper } from "@/components/shared/ImageCropper";
import { LiveCardPreview } from "@/components/onboarding/LiveCardPreview";
import { FREELANCER_ROLES, MAX_SECONDARY_ROLES } from "@/lib/freelancerRoles";
import {
  EDITABLE_STEPS,
  MAX_BIO_CHARS,
  MAX_CARD_QUOTE_CHARS,
  MAX_HEADLINE_CHARS,
} from "@/lib/onboarding";

const MAX_FEATURED_BYTES = 4 * 1024 * 1024;
const FEATURED_W = 900;
const FEATURED_H = 1200;
const FEATURED_CROP_VIEW_W = 210;
const FEATURED_CROP_VIEW_H = 280;
const MAX_FEATURED_DATA_URL_CHARS = 700_000;

interface WelcomeWizardProps {
  firstName: string | null;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  initialPrimaryRole: string | null;
  initialSecondaryRoles: string[];
  initialHeadline: string | null;
  initialBio: string | null;
  initialCardQuote: string | null;
  initialFeaturedImageUrl: string | null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Bienvenida guiada del Freelancer — se ve UNA SOLA VEZ, tras el registro.
 *
 * Tres decisiones que la separan de un formulario cualquiera:
 *
 * 1. Se edita AQUÍ. No manda a ningún modal ni a otra pantalla: lo que el
 *    usuario escribe en cada paso es su perfil real, guardado al avanzar.
 * 2. La recompensa se ve mientras escribe. La tarjeta de la derecha es el
 *    componente real de Explorar, así que el usuario ve exactamente lo que
 *    va a quedar publicado en lugar de llenar campos a ciegas.
 * 3. Se puede salir en cualquier momento sin castigo, y lo capturado hasta
 *    ese punto queda guardado.
 * ══════════════════════════════════════════════════════════════════════════ */
export function WelcomeWizard({
  firstName,
  username,
  name,
  avatarUrl,
  initialPrimaryRole,
  initialSecondaryRoles,
  initialHeadline,
  initialBio,
  initialCardQuote,
  initialFeaturedImageUrl,
}: WelcomeWizardProps) {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [primaryRole, setPrimaryRole] = useState(initialPrimaryRole ?? "");
  const [secondaryRoles, setSecondaryRoles] = useState<string[]>(initialSecondaryRoles);
  const [headline, setHeadline] = useState(initialHeadline ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [cardQuote, setCardQuote] = useState(initialCardQuote ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const exportCrop = useRef<(() => Promise<string | null>) | null>(null);

  const step = EDITABLE_STEPS[stepIndex];
  const isCelebration = stepIndex >= EDITABLE_STEPS.length;
  const totalSteps = EDITABLE_STEPS.length;
  // En la celebración la barra ya está llena.
  const progress = isCelebration ? 100 : Math.round((stepIndex / totalSteps) * 100);

  const toggleSecondary = (role: string) => {
    setSecondaryRoles((current) => {
      if (current.includes(role)) return current.filter((r) => r !== role);
      if (current.length >= MAX_SECONDARY_ROLES) return current;
      return [...current, role];
    });
  };

  const choosePrimary = (role: string) => {
    setPrimaryRole(role);
    // Un rol no puede ser principal y secundario a la vez.
    setSecondaryRoles((current) => current.filter((r) => r !== role));
  };

  const handleFileUpload = async (selected: File) => {
    setPendingFile(null);
    if (selected.size > MAX_FEATURED_BYTES) {
      setError("La imagen supera el máximo de 4MB permitido.");
      return;
    }
    setError(null);
    setPendingFile(selected);
  };

  /** Persiste el paso actual y avanza. Guardar al avanzar es lo que permite
   *  abandonar a media bienvenida sin perder lo ya escrito. */
  const goNext = () => {
    setError(null);
    startTransition(async () => {
      try {
        if (step === "roles") {
          await saveOnboardingRoles({ primaryRole, secondaryRoles });
        } else if (step === "presentacion") {
          await saveOnboardingPresentation({ headline, bio, cardQuote });
        } else if (step === "imagen") {
          if (pendingFile) {
            const dataUrl = await exportCrop.current?.();
            if (!dataUrl) throw new Error("No se pudo procesar la imagen.");
            await saveOnboardingFeaturedImage(dataUrl);
            setFeaturedImageUrl(dataUrl);
            setPendingFile(null);
          }
        }
        setStepIndex((i) => i + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
      }
    });
  };

  /** Salir sin terminar: se marca como vista para no volver a empujarla. */
  const leave = (destination: string) => {
    startTransition(async () => {
      try {
        await finishOnboarding();
      } catch {
        // Si falla el marcado no vale la pena bloquear la salida.
      }
      router.push(destination);
      router.refresh();
    });
  };

  const canAdvance = step === "roles" ? primaryRole !== "" : true;

  const preview = (
    <LiveCardPreview
      name={name ?? firstName ?? ""}
      username={username}
      avatarUrl={avatarUrl}
      headline={headline}
      bio={bio}
      cardQuote={cardQuote}
      primaryRole={primaryRole || null}
      secondaryRoles={secondaryRoles}
      featuredImageUrl={featuredImageUrl}
      caption="Así te van a ver en Explorar"
    />
  );

  /* ── Celebración ─────────────────────────────────────────────────────── */
  if (isCelebration) {
    return (
      <Column fillWidth paddingY="80" paddingX="24" horizontal="center">
        {/* CelebrationFx renderiza un Flex con `fill` y dirección row (default):
            sin horizontal="center" el contenido queda pegado a la izquierda.
            Acepta props de Flex porque hace spread del resto sobre él. */}
        <CelebrationFx trigger="mount" intensity={60} fillWidth horizontal="center">
          <Column maxWidth="s" fillWidth gap="32" horizontal="center">
            <RevealFx translateY="8">
              <Column gap="12" horizontal="center">
                <Heading variant="display-strong-s" align="center">
                  Ya estás dentro{firstName ? `, ${firstName}` : ""}
                </Heading>
                <Text variant="body-default-m" onBackground="neutral-weak" align="center">
                  Tu tarjeta ya aparece en Explorar. Puedes seguir puliéndola cuando quieras.
                </Text>
              </Column>
            </RevealFx>

            <Column maxWidth={18} fillWidth>
              {preview}
            </Column>

            <Column fillWidth gap="12" horizontal="center">
              <Button
                size="l"
                fillWidth
                loading={isPending}
                onClick={() => leave("/dashboard/freelancer?tour=1")}
              >
                Enséñame la plataforma
              </Button>
              <Button
                variant="tertiary"
                size="m"
                disabled={isPending}
                onClick={() => leave(username ? `/${username}` : "/dashboard")}
              >
                Prefiero explorar por mi cuenta
              </Button>
            </Column>
          </Column>
        </CelebrationFx>
      </Column>
    );
  }

  /* ── Pasos con captura ───────────────────────────────────────────────── */
  const stepCopy: Record<string, { eyebrow: string; title: string; body: string }> = {
    roles: {
      eyebrow: `Paso 1 de ${totalSteps}`,
      title: firstName ? `Hola, ${firstName}. ¿Qué haces?` : "¿Qué haces?",
      body: "Elige tu especialidad principal. Es lo que decide en qué categoría te encuentran.",
    },
    presentacion: {
      eyebrow: `Paso 2 de ${totalSteps}`,
      title: "Cómo te presentas",
      body: "Tres frases cortas. Se leen en tu tarjeta y en tu perfil, así que escríbelas como se las dirías a alguien en persona.",
    },
    imagen: {
      eyebrow: `Paso 3 de ${totalSteps}`,
      title: "Ponle cara a tu tarjeta",
      body: "Una imagen de tu trabajo. Es lo primero que se ve de ti en Explorar.",
    },
  };
  const copy = stepCopy[step];

  return (
    <Column fillWidth paddingY="48" paddingX="24" horizontal="center" gap="32">
      <Column maxWidth="l" fillWidth gap="24">
        {/* Encabezado con progreso y salida siempre disponible */}
        <Row fillWidth horizontal="between" vertical="center" gap="16">
          <Text variant="label-default-s" onBackground="brand-medium">
            {copy.eyebrow}
          </Text>
          <Button
            variant="tertiary"
            size="s"
            disabled={isPending}
            onClick={() => leave("/dashboard")}
          >
            Lo hago luego
          </Button>
        </Row>

        <ProgressBar value={progress} label={false} />

        <Row fillWidth gap="40" s={{ direction: "column" }}>
          {/* Formulario */}
          <Column flex={3} gap="24" style={{ minWidth: 0 }}>
            <RevealFx key={step} translateY="8">
              <Column gap="8">
                <Heading variant="display-strong-s">{copy.title}</Heading>
                <Text variant="body-default-m" onBackground="neutral-weak">
                  {copy.body}
                </Text>
              </Column>
            </RevealFx>

            {step === "roles" && (
              <Column gap="24">
                <Column gap="12">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Especialidad principal
                  </Text>
                  <Row wrap gap="8">
                    {FREELANCER_ROLES.map((role) => (
                      <ToggleButton
                        key={role}
                        selected={primaryRole === role}
                        onClick={() => choosePrimary(role)}
                      >
                        {role}
                      </ToggleButton>
                    ))}
                  </Row>
                </Column>

                {primaryRole && (
                  <Column gap="12">
                    <Text variant="label-default-s" onBackground="neutral-weak">
                      ¿Algo más? Hasta {MAX_SECONDARY_ROLES} (opcional)
                    </Text>
                    <Row wrap gap="8">
                      {FREELANCER_ROLES.filter((role) => role !== primaryRole).map((role) => {
                        const selected = secondaryRoles.includes(role);
                        const atLimit = !selected && secondaryRoles.length >= MAX_SECONDARY_ROLES;
                        return (
                          <ToggleButton
                            key={role}
                            selected={selected}
                            disabled={atLimit}
                            onClick={() => toggleSecondary(role)}
                          >
                            {role}
                          </ToggleButton>
                        );
                      })}
                    </Row>
                  </Column>
                )}
              </Column>
            )}

            {step === "presentacion" && (
              /* Etiquetas explícitas en Text, no el prop `label`: el Textarea
                 de Once UI lo descarta en silencio cuando hay `placeholder`
                 (verificado en el DOM), así que los campos largos quedarían
                 sin nombre visible. Se aplica también al Input para que los
                 tres se vean igual. */
              <Column gap="20">
                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Tu puesto
                  </Text>
                  <Input
                    id="onboarding-headline"
                    placeholder="Ej. Diseñador de Marca"
                    value={headline}
                    maxLength={MAX_HEADLINE_CHARS}
                    onChange={(e) => setHeadline(e.target.value)}
                  />
                </Column>

                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Quién eres
                  </Text>
                  <Textarea
                    id="onboarding-bio"
                    placeholder="Un par de líneas sobre a qué te dedicas y qué te gusta hacer"
                    lines={3}
                    value={bio}
                    maxLength={MAX_BIO_CHARS}
                    characterCount
                    onChange={(e) => setBio(e.target.value)}
                  />
                </Column>

                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Tu cita
                  </Text>
                  <Textarea
                    id="onboarding-quote"
                    placeholder="Una frase con la que quieras que te recuerden"
                    lines={2}
                    value={cardQuote}
                    maxLength={MAX_CARD_QUOTE_CHARS}
                    characterCount
                    onChange={(e) => setCardQuote(e.target.value)}
                  />
                </Column>
              </Column>
            )}

            {step === "imagen" && (
              <Column gap="16">
                {pendingFile ? (
                  <Column gap="12" horizontal="start">
                    <ImageCropper
                      file={pendingFile}
                      exportRef={exportCrop}
                      viewWidth={FEATURED_CROP_VIEW_W}
                      viewHeight={FEATURED_CROP_VIEW_H}
                      outputWidth={FEATURED_W}
                      outputHeight={FEATURED_H}
                      maxDataUrlChars={MAX_FEATURED_DATA_URL_CHARS}
                      maskShape="none"
                      ariaLabel="Arrastra la imagen para reencuadrar la tarjeta"
                    />
                    <Button
                      variant="tertiary"
                      size="s"
                      disabled={isPending}
                      onClick={() => setPendingFile(null)}
                    >
                      Elegir otra imagen
                    </Button>
                  </Column>
                ) : (
                  <MediaUpload
                    aspectRatio="3 / 4"
                    accept="image/*"
                    initialPreviewImage={featuredImageUrl}
                    emptyState="Arrastra una imagen o haz click para buscar"
                    onFileUpload={handleFileUpload}
                  />
                )}
                <Row gap="8" vertical="center">
                  <Icon name="infoCircle" size="xs" onBackground="neutral-weak" />
                  <Text variant="body-default-xs" onBackground="neutral-weak">
                    Puedes saltarte esto y subirla después desde tu perfil.
                  </Text>
                </Row>
              </Column>
            )}

            {error && (
              <Feedback
                variant="danger"
                description={error}
                showCloseButton
                onClose={() => setError(null)}
                fillWidth
              />
            )}

            <Row fillWidth gap="12" vertical="center" wrap>
              {stepIndex > 0 && (
                <Button
                  variant="secondary"
                  size="m"
                  prefixIcon="arrowLeft"
                  disabled={isPending}
                  onClick={() => {
                    setError(null);
                    setStepIndex((i) => i - 1);
                  }}
                >
                  Atrás
                </Button>
              )}
              <Button size="m" loading={isPending} disabled={!canAdvance} onClick={goNext}>
                {stepIndex === totalSteps - 1 ? "Terminar" : "Continuar"}
              </Button>
            </Row>
          </Column>

          {/* Preview en vivo */}
          <Column flex={2} gap="16" style={{ minWidth: 0 }}>
            {preview}
          </Column>
        </Row>
      </Column>
    </Column>
  );
}
