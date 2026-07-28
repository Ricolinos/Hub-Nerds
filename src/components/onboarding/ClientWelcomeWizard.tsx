"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useReverification, useUser } from "@clerk/nextjs";
import { isReverificationCancelledError } from "@clerk/nextjs/errors";
import {
  Avatar,
  Button,
  CelebrationFx,
  Column,
  Feedback,
  Heading,
  Input,
  PasswordInput,
  ProgressBar,
  RevealFx,
  Checkbox,
  Row,
  SegmentedControl,
  Select,
  Text,
} from "@once-ui-system/core";
import {
  finishOnboarding,
  saveOnboardingClientBusiness,
  saveOnboardingClientContact,
} from "@/app/actions/onboarding";
import { syncProfileImage } from "@/app/actions/updateProfile";
import { InlineImagePicker } from "@/components/onboarding/InlineImagePicker";
import { TalentPreview, type TalentCard } from "@/components/onboarding/TalentPreview";
import {
  composeContactHours,
  CONTACT_CHANNELS,
  CONTACT_DAY_PRESETS,
  CONTACT_HOUR_OPTIONS,
  parseContactHours,
  parseContactPreference,
} from "@/lib/contactPreferences";

const MIN_PASSWORD_CHARS = 8;
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_SIDE_VIEW = 170;
const AVATAR_SIDE_OUT = 400;
const AVATAR_MAX_CHARS = 400_000;

const CLIENT_STEPS = ["negocio", "contacto"] as const;

interface ClientWelcomeWizardProps {
  needsPassword: boolean;
  firstName: string | null;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  initialCompany: string | null;
  initialBrand: string | null;
  initialIndustry: string | null;
  initialContactPreference: string | null;
  initialContactHours: string | null;
  initialWebsite: string | null;
  talent: TalentCard[];
}

/* ══════════════════════════════════════════════════════════════════════════
 * Bienvenida guiada del Client.
 *
 * Deliberadamente más corta que la del freelancer: dos pasos de captura.
 * Un freelancer viene a construir una presencia y agradece el detalle; un
 * client viene a encontrar a alguien, y cada campo de más es una razón para
 * abandonar antes de ver el talento.
 *
 * La recompensa también es otra. El freelancer ve su tarjeta crecer mientras
 * escribe; al client se le muestran perfiles REALES de la plataforma, que es
 * exactamente lo que vino a buscar.
 * ══════════════════════════════════════════════════════════════════════════ */
export function ClientWelcomeWizard({
  needsPassword,
  firstName,
  name,
  username,
  avatarUrl,
  initialCompany,
  initialBrand,
  initialIndustry,
  initialContactPreference,
  initialContactHours,
  initialWebsite,
  talent,
}: ClientWelcomeWizardProps) {
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

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [company, setCompany] = useState(initialCompany ?? "");
  const [brand, setBrand] = useState(initialBrand ?? "");
  const [industry, setIndustry] = useState(initialIndustry ?? "");
  // Varios canales a la vez (mínimo uno). Por defecto, los mensajes de la
  // propia plataforma: es donde el proyecto ya vive.
  const [channels, setChannels] = useState<string[]>(() => {
    const parsed = parseContactPreference(initialContactPreference);
    return parsed.length > 0 ? parsed : ["plataforma"];
  });
  const initialHours = parseContactHours(initialContactHours);
  const [hourDays, setHourDays] = useState(initialHours.days);
  const [hourFrom, setHourFrom] = useState(initialHours.from);
  const [hourTo, setHourTo] = useState(initialHours.to);
  // "Represento a una empresa o marca" vs "Busco por mi cuenta". Arranca en
  // empresa solo si ya había algo escrito, para no presuponer nada.
  const [hasOrg, setHasOrg] = useState(
    Boolean((initialCompany ?? "").trim() || (initialBrand ?? "").trim()),
  );
  const [website, setWebsite] = useState(initialWebsite ?? "");
  const [avatar, setAvatar] = useState(avatarUrl);
  const hasOwnAvatar = user?.hasImage ?? false;

  const steps = useMemo(
    () =>
      needsPassword ? (["seguridad", ...CLIENT_STEPS] as string[]) : ([...CLIENT_STEPS] as string[]),
    [needsPassword],
  );

  const step = steps[stepIndex];
  const isCelebration = stepIndex >= steps.length;
  const totalSteps = steps.length;
  const progress = isCelebration ? 100 : Math.round((stepIndex / totalSteps) * 100);

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
        } else if (step === "negocio") {
          await saveOnboardingClientBusiness({ company, brand, industry });
        } else if (step === "contacto") {
          await saveOnboardingClientContact({
            contactChannels: channels,
            contactHours: composeContactHours(hourDays, hourFrom, hourTo),
            website,
          });
        }
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

  const leave = (destination: string) => {
    startTransition(async () => {
      try {
        await finishOnboarding();
      } catch {
        // El perfil ya cumple el mínimo; no bloquear la salida.
      }
      router.push(destination);
      router.refresh();
    });
  };

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

  const canAdvance =
    step === "seguridad"
      ? password.length >= MIN_PASSWORD_CHARS && password === passwordConfirm
      : step === "contacto"
        ? channels.length > 0
        : true;

  /* ── Celebración ─────────────────────────────────────────────────────── */
  if (isCelebration) {
    return (
      <Column fillWidth flex={1} paddingY="64" paddingX="24" horizontal="center" vertical="center">
        <CelebrationFx
          type="fireworks"
          trigger="mount"
          intensity={70}
          duration={6000}
          fillWidth
          horizontal="center"
          vertical="center"
        >
          <Column maxWidth="s" fillWidth gap="32" horizontal="center">
            <RevealFx fillWidth translateY="8">
              <Column fillWidth gap="12" horizontal="center">
                <Heading variant="display-strong-s" align="center">
                  {firstName ? `${firstName}, ya eres parte` : "Ya eres parte"}
                </Heading>
                <Text variant="body-default-m" onBackground="neutral-weak" align="center">
                  Ya puedes escribirle a quien te interese o publicar tu primer brief. El talento
                  está de este lado.
                </Text>
              </Column>
            </RevealFx>

            {/* Solo aquí la tarjeta activa lleva al perfil: el recorrido ya
                terminó y lo natural es que el client empiece a mirar gente.
                Va por `leave()` y no por un push suelto para que la bienvenida
                quede cerrada igual que con los dos botones de abajo. */}
            <TalentPreview
              talent={talent}
              onActiveClick={(person) => {
                if (person.username) leave(`/${person.username}`);
              }}
            />

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
                onClick={() => leave("/explorar/freelancers")}
              >
                Prefiero ver el talento ya
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
    negocio: {
      eyebrow: `Paso ${stepNumber} de ${totalSteps}`,
      title: firstName ? `Hola, ${firstName}. ¿De dónde vienes?` : "¿De dónde vienes?",
      body: "Si representas a una empresa o marca, cuéntanos cuál. Y si vienes por tu cuenta, también está perfecto: con saber el área de tu proyecto basta.",
    },
    contacto: {
      eyebrow: `Paso ${stepNumber} de ${totalSteps}`,
      title: "¿Por dónde te buscamos?",
      body: "Puedes elegir más de un canal: el primero es por donde prefieres que te busquen y el resto quedan como alternativas.",
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
            <RevealFx key={step} fillWidth translateY="8">
              <Column fillWidth gap="8">
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

            {step === "negocio" && (
              <Column gap="20">
                {/* No se presupone que el client represente a una empresa:
                    mucha gente llega por su cuenta buscando quien le ayude, y
                    obligarla a poner un nombre de empresa la hacía inventarse
                    uno. Los campos de empresa/marca solo aparecen si aplica. */}
                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    ¿Cómo llegas?
                  </Text>
                  <SegmentedControl
                    buttons={[
                      { value: "org", label: "Tengo empresa o marca" },
                      { value: "solo", label: "Busco por mi cuenta" },
                    ]}
                    selected={hasOrg ? "org" : "solo"}
                    onToggle={(value) => setHasOrg(value === "org")}
                  />
                </Column>

                {hasOrg && (
                  <>
                    <Column gap="8">
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        Empresa
                      </Text>
                      <Input
                        id="onboarding-company"
                        placeholder="Ej. Estudio Norte"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    </Column>
                    <Column gap="8">
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        Marca (si es distinta)
                      </Text>
                      <Input
                        id="onboarding-brand"
                        placeholder="Opcional"
                        value={brand}
                        onChange={(e) => setBrand(e.target.value)}
                      />
                    </Column>
                  </>
                )}

                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    {hasOrg ? "Giro" : "¿En qué área se mueve tu proyecto?"}
                  </Text>
                  <Input
                    id="onboarding-industry"
                    placeholder="Ej. Bebidas, editorial, televisión…"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </Column>

                {/* El avatar SÍ es lo que ve el freelancer al recibir tu
                    solicitud de contacto (CollabClientSummary expone name,
                    username e imageUrl). Por eso se ofrece aquí y se dice tal
                    cual, sin prometer que se vea nada más. */}
                <Row fillWidth gap="16" vertical="center" wrap>
                  <Avatar
                    size="l"
                    {...(hasOwnAvatar && avatar
                      ? { src: avatar }
                      : { value: (name?.[0] ?? firstName?.[0] ?? "C").toUpperCase() })}
                  />
                  <Column gap="8" style={{ minWidth: 0 }}>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Tu foto es lo que ve el talento cuando le escribes.
                    </Text>
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
                      emptyLabel="Subir foto"
                      disabled={isPending}
                    />
                  </Column>
                </Row>
              </Column>
            )}

            {step === "contacto" && (
              <Column gap="20">
                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    ¿Por dónde aceptas que te escriban? Elige al menos uno
                  </Text>
                  {/* Varios canales, no uno excluyente: el primero es por
                      donde prefiere que lo busquen y el resto son alternativas
                      que también acepta. Checkbox de Once UI SIEMPRE con
                      `label` (el aria-label no pinta nada). */}
                  <Column
                    fillWidth
                    border="neutral-alpha-medium"
                    radius="l"
                    overflow="hidden"
                  >
                    {CONTACT_CHANNELS.map((channel, index) => {
                      const checked = channels.includes(channel.value);
                      const isOnlyOne = checked && channels.length === 1;
                      return (
                        <Row
                          key={channel.value}
                          fillWidth
                          paddingX="16"
                          paddingY="12"
                          gap="12"
                          vertical="center"
                          borderTop={index > 0 ? "neutral-alpha-weak" : undefined}
                          background={checked ? "brand-alpha-weak" : "transparent"}
                        >
                          <Checkbox
                            label={channel.label}
                            description={channel.description}
                            isChecked={checked}
                            // No se puede desmarcar el último: al menos un
                            // canal es obligatorio.
                            disabled={isOnlyOne}
                            onToggle={() =>
                              setChannels((current) =>
                                current.includes(channel.value)
                                  ? current.filter((c) => c !== channel.value)
                                  : [...current, channel.value],
                              )
                            }
                          />
                        </Row>
                      );
                    })}
                  </Column>
                </Column>

                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    ¿En qué horario?
                  </Text>
                  {/* Opciones predefinidas en vez de texto libre. NO se usan
                      DateInput/DatePicker de Once UI: son calendarios para una
                      fecha concreta, no sirven para una disponibilidad
                      semanal recurrente. */}
                  <SegmentedControl
                    buttons={CONTACT_DAY_PRESETS.map((preset) => ({
                      value: preset.value,
                      label: preset.label,
                    }))}
                    selected={hourDays}
                    onToggle={(value) => setHourDays(value)}
                  />
                  <Row fillWidth gap="12" vertical="center" wrap>
                    <Column flex={1} gap="4" style={{ minWidth: 120 }}>
                      <Text variant="body-default-xs" onBackground="neutral-weak">
                        Desde
                      </Text>
                      <Select
                        id="onboarding-hour-from"
                        options={CONTACT_HOUR_OPTIONS.map((h) => ({ value: h, label: h }))}
                        value={hourFrom}
                        onSelect={(value: string) => setHourFrom(value)}
                      />
                    </Column>
                    <Column flex={1} gap="4" style={{ minWidth: 120 }}>
                      <Text variant="body-default-xs" onBackground="neutral-weak">
                        Hasta
                      </Text>
                      <Select
                        id="onboarding-hour-to"
                        options={CONTACT_HOUR_OPTIONS.map((h) => ({ value: h, label: h }))}
                        value={hourTo}
                        onSelect={(value: string) => setHourTo(value)}
                      />
                    </Column>
                  </Row>
                </Column>

                <Column gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    Sitio web
                  </Text>
                  <Input
                    id="onboarding-website"
                    placeholder="https://… (opcional)"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </Column>
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
            <TalentPreview talent={talent} />
          </Column>
        </Row>
      </Column>
    </Column>
  );
}
