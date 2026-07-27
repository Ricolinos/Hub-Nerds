"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import {
  Button,
  CelebrationFx,
  Column,
  Feedback,
  Heading,
  PasswordInput,
  ProgressBar,
  RevealFx,
  Row,
  Tag,
  Text,
  Textarea,
} from "@once-ui-system/core";
import {
  finishOnboarding,
  saveOnboardingAppearance,
  saveOnboardingFeaturedImage,
  saveOnboardingPresentation,
  saveOnboardingRoles,
} from "@/app/actions/onboarding";
import { syncProfileImage } from "@/app/actions/updateProfile";
import { InlineImagePicker } from "@/components/onboarding/InlineImagePicker";
import { LiveCardPreview } from "@/components/onboarding/LiveCardPreview";
import { RolePicker } from "@/components/onboarding/RolePicker";
import { AppearancePanel, type ProfileAppearanceValue } from "@/components/profile/AppearancePanel";
import { AppearancePreviewScope } from "@/components/onboarding/AppearancePreviewScope";
import { MAX_SECONDARY_ROLES } from "@/lib/freelancerRoles";
import { EDITABLE_STEPS, MAX_BIO_CHARS, MAX_CARD_QUOTE_CHARS } from "@/lib/onboarding";

const MIN_PASSWORD_CHARS = 8;

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_SIDE_VIEW = 170;
const AVATAR_SIDE_OUT = 400;
const AVATAR_MAX_CHARS = 400_000;

const FEATURED_MAX_BYTES = 4 * 1024 * 1024;
const FEATURED_VIEW_W = 210;
const FEATURED_VIEW_H = 280;
const FEATURED_OUT_W = 900;
const FEATURED_OUT_H = 1200;
const FEATURED_MAX_CHARS = 700_000;

interface WelcomeWizardProps {
  needsPassword: boolean;
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
  initialAppearance: ProfileAppearanceValue;
}

/* ══════════════════════════════════════════════════════════════════════════
 * Bienvenida guiada del Freelancer.
 *
 * Se muestra al registrarse y vuelve a aparecer en cada inicio de sesión
 * mientras el perfil siga incompleto: "Lo hago luego" pospone, no silencia
 * (ver shouldSeeOnboarding en src/lib/onboarding.ts).
 *
 * Tres decisiones que la separan de un formulario cualquiera:
 *
 * 1. Se edita AQUÍ. No manda a ningún modal ni a otra pantalla: lo que el
 *    usuario escribe en cada paso es su perfil real, guardado al avanzar.
 * 2. La recompensa se ve mientras escribe, y la tarjeta ACOMPAÑA el relato:
 *    de frente al elegir profesión, se voltea al reverso donde se escriben
 *    los textos que ahí se leen, y vuelve al frente para ponerle imagen.
 * 3. Se puede salir en cualquier momento sin castigo, y lo capturado hasta
 *    ese punto queda guardado.
 * ══════════════════════════════════════════════════════════════════════════ */
export function WelcomeWizard({
  needsPassword,
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
  initialAppearance,
}: WelcomeWizardProps) {
  const router = useRouter();
  const { user } = useUser();
  /* Poner contraseña es una operación SENSIBLE para Clerk: exige que la sesión
     se haya verificado hace poco. Sin esto, una cuenta creada con Google
     —que es justo la que necesita este paso— fallaba con "You need to provide
     additional verification to perform this operation".
     `useReverification` envuelve la llamada: si Clerk pide reverificación abre
     su propia UI, y al completarla reintenta el guardado solo. */
  const setPasswordWithReverification = useReverification(async (newPassword: string) => {
    if (!user) throw new Error("Sesión no disponible");
    return user.updatePassword({ newPassword });
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [primaryRole, setPrimaryRole] = useState(initialPrimaryRole ?? "");
  const [secondaryRoles, setSecondaryRoles] = useState<string[]>(initialSecondaryRoles);
  const [bio, setBio] = useState(initialBio ?? "");
  const [cardQuote, setCardQuote] = useState(initialCardQuote ?? "");
  const [featuredImageUrl, setFeaturedImageUrl] = useState(initialFeaturedImageUrl);
  const [avatar, setAvatar] = useState(avatarUrl);
  // Clerk SIEMPRE entrega una imagen (genera un avatar por defecto), así que
  // `avatarUrl` nunca viene vacío y el selector creería que ya hay foto
  // propia. `hasImage` distingue la subida real de la generada.
  const hasOwnAvatar = user?.hasImage ?? false;
  const [appearance, setAppearance] = useState<ProfileAppearanceValue>(initialAppearance);
  const appearanceDirty = useRef(false);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  // El paso de contraseña solo existe para quien no tiene una (alta por
  // Google/Facebook). `needsPassword` viene del servidor, así que la cantidad
  // de pasos es estable desde el primer render.
  const steps = useMemo(
    () => (needsPassword ? (["seguridad", ...EDITABLE_STEPS] as string[]) : (EDITABLE_STEPS as string[])),
    [needsPassword],
  );

  const step = steps[stepIndex];
  const isCelebration = stepIndex >= steps.length;
  const totalSteps = steps.length;
  const progress = isCelebration ? 100 : Math.round((stepIndex / totalSteps) * 100);

  /* ── Guardado por paso ─────────────────────────────────────────────── */
  const goNext = () => {
    setError(null);
    startTransition(async () => {
      try {
        if (step === "seguridad") {
          if (!user) throw new Error("Sesión no disponible");
          if (password.length < MIN_PASSWORD_CHARS) {
            throw new Error(`La contraseña necesita al menos ${MIN_PASSWORD_CHARS} caracteres.`);
          }
          if (password !== passwordConfirm) throw new Error("Las contraseñas no coinciden.");
          await setPasswordWithReverification(password);
          setPassword("");
          setPasswordConfirm("");
        } else if (step === "roles") {
          await saveOnboardingRoles({ primaryRole, secondaryRoles });
        } else if (step === "presentacion") {
          await saveOnboardingPresentation({ bio, cardQuote });
        } else if (step === "imagen" && appearanceDirty.current) {
          await saveOnboardingAppearance(appearance);
        }
        // finishOnboarding() se llama al SALIR de la celebración, no aquí: su
        // revalidatePath hace re-evaluar /bienvenida, y con onboardedAt ya
        // puesto la página redirige al dashboard — la celebración nunca
        // llegaba a verse. Al llegar aquí el perfil ya cumple el mínimo, así
        // que aunque el usuario cierre el navegador no se le vuelve a pedir.
        setStepIndex((i) => i + 1);
      } catch (err) {
        // Cerrar la ventana de reverificación es una decisión del usuario, no
        // un fallo: se deja el paso como estaba, sin mensaje de error.
        if (isReverificationCancelledError(err)) return;
        setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
      }
    });
  };

  /** Posponer: NO marca la bienvenida como terminada, así vuelve a aparecer. */
  const postpone = () => {
    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  };

  /** Salida desde la celebración: aquí sí se cierra la bienvenida para bien. */
  const leave = (destination: string) => {
    startTransition(async () => {
      try {
        await finishOnboarding();
      } catch {
        // El perfil ya cumple el mínimo; no vale la pena bloquear la salida.
      }
      router.push(destination);
      router.refresh();
    });
  };

  /* ── Imágenes ──────────────────────────────────────────────────────── */
  const saveAvatar = async (dataUrl: string) => {
    if (!user) throw new Error("Sesión no disponible");
    const blob = await (await fetch(dataUrl)).blob();
    await user.setProfileImage({ file: new File([blob], "avatar.jpg", { type: "image/jpeg" }) });
    await syncProfileImage();
    setAvatar(dataUrl);
    router.refresh();
  };

  const removeAvatar = async () => {
    if (!user) throw new Error("Sesión no disponible");
    await user.setProfileImage({ file: null });
    await syncProfileImage();
    setAvatar(null);
    router.refresh();
  };

  const saveFeatured = async (dataUrl: string) => {
    await saveOnboardingFeaturedImage(dataUrl);
    setFeaturedImageUrl(dataUrl);
  };

  const removeFeatured = async () => {
    await saveOnboardingFeaturedImage(null);
    setFeaturedImageUrl(null);
  };

  const canAdvance =
    step === "roles"
      ? primaryRole !== ""
      : step === "seguridad"
        ? password.length >= MIN_PASSWORD_CHARS && password === passwordConfirm
        : true;

  const preview = (
    <AppearancePreviewScope appearance={appearance}>
      <LiveCardPreview
        name={name ?? firstName ?? ""}
        username={username}
        // Solo la foto propia: el avatar generado por Clerk se vería como un
        // dibujo aleatorio pegado en la tarjeta. Sin foto, la tarjeta cae a la
        // inicial del nombre, que es un estado vacío honesto.
        avatarUrl={hasOwnAvatar ? avatar : null}
        headline={initialHeadline || primaryRole}
        bio={bio}
        cardQuote={cardQuote}
        primaryRole={primaryRole || null}
        secondaryRoles={secondaryRoles}
        featuredImageUrl={featuredImageUrl}
        face={step === "presentacion" ? "back" : "front"}
        caption="Así te van a ver en Explorar"
        overlay={
          step === "presentacion" ? (
            <InlineImagePicker
              currentUrl={hasOwnAvatar ? avatar : null}
              onSave={saveAvatar}
              onDelete={removeAvatar}
              shape="circle"
              viewWidth={AVATAR_SIDE_VIEW}
              viewHeight={AVATAR_SIDE_VIEW}
              outputWidth={AVATAR_SIDE_OUT}
              outputHeight={AVATAR_SIDE_OUT}
              maxBytes={AVATAR_MAX_BYTES}
              maxDataUrlChars={AVATAR_MAX_CHARS}
              emptyLabel="Subir foto de perfil"
              disabled={isPending}
            />
          ) : step === "imagen" ? (
            <InlineImagePicker
              currentUrl={featuredImageUrl}
              onSave={saveFeatured}
              onDelete={removeFeatured}
              shape="rect"
              viewWidth={FEATURED_VIEW_W}
              viewHeight={FEATURED_VIEW_H}
              outputWidth={FEATURED_OUT_W}
              outputHeight={FEATURED_OUT_H}
              maxBytes={FEATURED_MAX_BYTES}
              maxDataUrlChars={FEATURED_MAX_CHARS}
              emptyLabel="Subir imagen"
              disabled={isPending}
            />
          ) : undefined
        }
      />
    </AppearancePreviewScope>
  );

  /* ── Celebración ─────────────────────────────────────────────────────── */
  if (isCelebration) {
    return (
      <Column fillWidth flex={1} paddingY="64" paddingX="24" horizontal="center" vertical="center">
        {/* CelebrationFx renderiza un Flex con `fill` y dirección row (default):
            sin horizontal/vertical="center" el contenido se pega a la esquina.
            Acepta props de Flex porque hace spread del resto sobre él. */}
        <CelebrationFx
          type="fireworks"
          trigger="mount"
          intensity={70}
          duration={6000}
          fillWidth
          horizontal="center"
          vertical="center"
        >
          <Column maxWidth="xs" fillWidth gap="32" horizontal="center">
            {/* fillWidth en el RevealFx: sin él se encoge al contenido y el
                bloque de texto queda descentrado respecto a la tarjeta y los
                botones, que sí ocupan el ancho de la columna. */}
            <RevealFx fillWidth translateY="8">
              <Column fillWidth gap="12" horizontal="center">
                <Heading variant="display-strong-s" align="center">
                  {firstName ? `${firstName}, ya eres parte` : "Ya eres parte"}
                </Heading>
                <Text variant="body-default-m" onBackground="neutral-weak" align="center">
                  Tu tarjeta ya aparece en Explorar. Puedes seguir puliéndola cuando quieras.
                </Text>
              </Column>
            </RevealFx>

            <Column maxWidth={17} fillWidth horizontal="center">
              {preview}
            </Column>

            <Column fillWidth gap="12" horizontal="center">
              <Button
                size="l"
                fillWidth
                loading={isPending}
                onClick={() => leave(username ? `/${username}?tour=1` : "/dashboard?tour=1")}
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
  const stepNumber = stepIndex + 1;
  const stepCopy: Record<string, { eyebrow: string; title: string; body: string }> = {
    seguridad: {
      eyebrow: `Paso ${stepNumber} de ${totalSteps}`,
      title: "Ponle una contraseña a tu cuenta",
      body: "Entraste con Google o Facebook, así que todavía no tienes una. Con contraseña puedes iniciar sesión aunque un día pierdas el acceso a esa cuenta.",
    },
    roles: {
      eyebrow: `Paso ${stepNumber} de ${totalSteps}`,
      title: firstName && !needsPassword ? `Hola, ${firstName}. Déjanos saber más de ti` : "Déjanos saber más de ti",
      body: "Empecemos por el título con el que te presentas. Es lo que se lee bajo tu nombre y lo que decide dónde te encuentran.",
    },
    presentacion: {
      eyebrow: `Paso ${stepNumber} de ${totalSteps}`,
      title: "Así te verán los demás",
      body: "Tu cita se lee en el reverso de tu tarjeta; la descripción, en tu perfil. Escríbelas como se las dirías a alguien en persona.",
    },
    imagen: {
      eyebrow: `Paso ${stepNumber} de ${totalSteps}`,
      title: "Ponle cara a tu tarjeta",
      body: "Una imagen de tu trabajo y los colores con los que quieres que se vea. Puedes cambiarlos después.",
    },
  };
  const copy = stepCopy[step];

  return (
    <Column fillWidth paddingY="48" paddingX="24" horizontal="center" gap="32">
      <Column maxWidth="l" fillWidth gap="24">
        <Row fillWidth horizontal="between" vertical="center" gap="16">
          <Text variant="label-default-s" onBackground="brand-medium">
            {copy.eyebrow}
          </Text>
          <Button variant="tertiary" size="s" disabled={isPending} onClick={postpone}>
            Lo hago luego
          </Button>
        </Row>

        <ProgressBar value={progress} label={false} />

        <Row fillWidth gap="40" s={{ direction: "column" }}>
          <Column flex={3} gap="24" style={{ minWidth: 0 }}>
            <RevealFx key={step} translateY="8">
              <Column gap="8">
                <Heading variant="display-strong-s">{copy.title}</Heading>
                <Text variant="body-default-m" onBackground="neutral-weak">
                  {copy.body}
                </Text>
              </Column>
            </RevealFx>

            {step === "seguridad" && (
              <Column gap="20">
                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Nueva contraseña
                  </Text>
                  <PasswordInput
                    id="onboarding-password"
                    placeholder={`Al menos ${MIN_PASSWORD_CHARS} caracteres`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Column>
                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Repítela
                  </Text>
                  <PasswordInput
                    id="onboarding-password-confirm"
                    placeholder="La misma de arriba"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                  />
                  {passwordConfirm !== "" && password !== passwordConfirm && (
                    <Text variant="body-default-xs" onBackground="danger-weak">
                      Las contraseñas no coinciden.
                    </Text>
                  )}
                </Column>
              </Column>
            )}

            {step === "roles" && (
              <Column gap="20">
                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    ¿A qué te dedicas?
                  </Text>
                  <RolePicker
                    id="onboarding-primary-role"
                    value={primaryRole}
                    placeholder="Elige tu profesión"
                    onChange={(role) => {
                      setPrimaryRole(role);
                      setSecondaryRoles((current) => current.filter((r) => r !== role));
                    }}
                  />
                </Column>

                {primaryRole && (
                  <Column gap="8">
                    <Text variant="label-default-s" onBackground="neutral-weak">
                      ¿Tienes alguna otra especialidad? (opcional, hasta {MAX_SECONDARY_ROLES})
                    </Text>
                    <RolePicker
                      id="onboarding-secondary-roles"
                      multiple
                      max={MAX_SECONDARY_ROLES}
                      exclude={[primaryRole]}
                      value={secondaryRoles}
                      placeholder="Elige hasta dos"
                      onChange={(role) =>
                        setSecondaryRoles((current) => {
                          if (current.includes(role)) return current.filter((r) => r !== role);
                          if (current.length >= MAX_SECONDARY_ROLES) return current;
                          return [...current, role];
                        })
                      }                    />
                  </Column>
                )}
              </Column>
            )}

            {step === "presentacion" && (
              /* Etiquetas explícitas en Text, no el prop `label`: el Textarea
                 de Once UI lo descarta en silencio cuando hay `placeholder`
                 (verificado en el DOM), dejando los campos sin nombre. */
              <Column gap="20">
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
              <Column gap="8">
                <Text variant="label-default-s" onBackground="neutral-weak">
                  Personaliza tus colores
                </Text>
                <AppearancePanel
                  value={appearance}
                  onChange={(next) => {
                    appearanceDirty.current = true;
                    setAppearance(next);
                  }}
                />

                {/* Muestra en vivo. Sin esto el color de ACENTO no se percibe:
                    la tarjeta usa brand y neutral, pero ningún elemento de la
                    pantalla pintaba con accent, así que elegirlo no cambiaba
                    nada visible. */}
                <AppearancePreviewScope appearance={appearance}>
                  <Row
                    fillWidth
                    gap="12"
                    padding="16"
                    radius="l"
                    border="neutral-alpha-weak"
                    background="surface"
                    vertical="center"
                    wrap
                  >
                    <Button size="s">Botón</Button>
                    <Tag label="Principal" variant="brand" />
                    <Tag label="Acento" variant="accent" />
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Así se ven tus colores
                    </Text>
                  </Row>
                </AppearancePreviewScope>
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

          <Column flex={2} gap="16" style={{ minWidth: 0 }}>
            {preview}
          </Column>
        </Row>
      </Column>
    </Column>
  );
}
