"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import {
  Avatar,
  Button,
  Column,
  Feedback,
  Grid,
  Heading,
  Input,
  Line,
  Modal,
  PasswordInput,
  Row,
  Select,
  Text,
  ToggleButton,
} from "@once-ui-system/core";
import { MediaUpload } from "@once-ui-system/core/modules";
import {
  updateProfileInfo,
  updateClientIdentity,
  syncProfileImage,
  type ProfileInfoInput,
} from "@/app/actions/updateProfile";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { ImageCropper } from "@/components/shared/ImageCropper";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
// Salida final del recorte: la restricción de 400×400 se garantiza aquí.
const OUTPUT_PX = 400;
// Lado del viewport de encuadre en pantalla.
const CROP_VIEW = 240;
const MAX_AVATAR_DATA_URL_CHARS = 2_000_000;
const MAX_MOTTO_CHARS = 40;

const modalBackdrop = <BrandModalBackdrop />;

// ─── Cambiar imagen de perfil ─────────────────────────────────────────────────
export function AvatarUploadDialog({
  isOpen,
  onClose,
  currentImageUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentImageUrl?: string;
}) {
  const { user } = useUser();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const exportCrop = useRef<(() => Promise<string | null>) | null>(null);

  // MediaUpload comprime al vuelo, pero si su compresión falla entrega el
  // archivo ORIGINAL sin avisar — el peso se valida sobre lo que llega.
  // La resolución no se restringe aquí: el encuadre exporta siempre 400×400.
  const handleFileUpload = async (selected: File) => {
    setFile(null);
    if (selected.size > MAX_AVATAR_BYTES) {
      setError("La imagen supera el máximo de 2MB permitido.");
      return;
    }
    setError(null);
    setFile(selected);
  };

  const handleSave = async () => {
    if (!user || !file) return;
    setSaving(true);
    setError(null);
    try {
      const dataUrl = await exportCrop.current?.();
      if (!dataUrl) throw new Error("crop");
      const blob = await (await fetch(dataUrl)).blob();
      const cropped = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await user.setProfileImage({ file: cropped });
      await syncProfileImage();
      setFile(null);
      onClose();
      router.refresh();
    } catch {
      setError("No se pudo actualizar la imagen. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imagen de perfil" backdrop={modalBackdrop}>
      <Column gap="16" fillWidth paddingTop="12">
        <Feedback
          variant="info"
          description="Sube únicamente imágenes libres de derechos de autor y sin contenido ofensivo. Te sugerimos una foto real de ti. Máximo 2MB; la imagen final se recorta a 400 × 400 px."
        />

        {file ? (
          <Column gap="12" fillWidth horizontal="center">
            <ImageCropper
              file={file}
              exportRef={exportCrop}
              viewWidth={CROP_VIEW}
              viewHeight={CROP_VIEW}
              outputWidth={OUTPUT_PX}
              outputHeight={OUTPUT_PX}
              maxDataUrlChars={MAX_AVATAR_DATA_URL_CHARS}
              maskShape="circle"
            />
            <Button
              variant="tertiary"
              size="s"
              onClick={() => setFile(null)}
              disabled={saving}
            >
              Elegir otra imagen
            </Button>
          </Column>
        ) : (
          <Row fillWidth horizontal="center">
            <MediaUpload
              aspectRatio="1 / 1"
              maxWidth={16}
              accept="image/*"
              compress
              resizeMaxWidth={1024}
              resizeMaxHeight={1024}
              initialPreviewImage={currentImageUrl ?? null}
              emptyState="Arrastra una imagen o haz click para buscar"
              onFileUpload={handleFileUpload}
            />
          </Row>
        )}

        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="m" onClick={handleSave} loading={saving} disabled={!file}>
            Guardar imagen
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

// ─── Editar perfil (identidad + contacto + empresa + perfil) ─────────────────
export interface EditProfileInitial extends ProfileInfoInput {
  firstName: string;
  lastName: string;
  username: string;
}

const CONTACT_PREFERENCE_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Correo electrónico" },
];

// Secciones del panel: navegación lateral (izquierda) + contenido (derecha)
const EDIT_SECTIONS = [
  {
    key: "general",
    label: "Información general",
    icon: "infoCircle",
    description: "Tu identidad en la plataforma: imagen de perfil, nombre y usuario.",
  },
  {
    key: "contacto",
    label: "Contacto",
    icon: "email",
    description: "Cómo y cuándo prefieres que tus diseñadores te contacten.",
  },
  {
    key: "empresa",
    label: "Empresa",
    icon: "briefcase",
    description: "Los datos de tu negocio o marca.",
  },
  {
    key: "perfil",
    label: "Perfil",
    icon: "edit",
    description: "La información que aparece en la portada de tu perfil.",
  },
  {
    key: "seguridad",
    label: "Seguridad",
    icon: "shield",
    description: "Privacidad de tu perfil y protección de tu cuenta.",
  },
  {
    key: "ayuda",
    label: "Ayuda",
    icon: "helpCircle",
    description: "Vuelve a ver el recorrido por la plataforma.",
  },
] as const;

type EditSectionKey = (typeof EDIT_SECTIONS)[number]["key"];

export function EditInfoDialog({
  isOpen,
  onClose,
  initial,
  avatarUrl,
  onOpenAvatar,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial: EditProfileInitial;
  avatarUrl?: string;
  // Abre el diálogo de recorte de imagen existente (cierra este panel)
  onOpenAvatar?: () => void;
}) {
  const router = useRouter();
  const { openUserProfile } = useClerk();
  const [form, setForm] = useState<EditProfileInitial>(initial);
  const [section, setSection] = useState<EditSectionKey>("general");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const initialSnapshotRef = useRef("");

  // Reinicia el estado cada vez que el diálogo se abre: sin esto arrastraría
  // texto sin guardar o el paso de confirmación de una apertura anterior.
  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setSection("general");
      setStep("form");
      setPassword("");
      setError(null);
      setConfirmingExit(false);
      initialSnapshotRef.current = JSON.stringify(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isDirty = isOpen && initialSnapshotRef.current !== JSON.stringify(form);

  const requestClose = () => {
    if (isDirty) {
      setConfirmingExit(true);
    } else {
      onClose();
    }
  };


  const set = (field: keyof EditProfileInitial) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const identityChanged =
    form.firstName.trim() !== initial.firstName.trim() ||
    form.lastName.trim() !== initial.lastName.trim() ||
    form.username.trim() !== initial.username.trim();

  const profileFields: ProfileInfoInput = {
    whatsapp: form.whatsapp,
    secondaryEmail: form.secondaryEmail,
    address: form.address,
    company: form.company,
    brand: form.brand,
    motto: form.motto,
    contactPreference: form.contactPreference,
    contactHours: form.contactHours,
    website: form.website,
    industry: form.industry,
  };

  const finishSave = (usernameForRedirect?: string) => {
    onClose();
    if (usernameForRedirect) {
      router.push(`/${usernameForRedirect}`);
    } else {
      router.refresh();
    }
  };

  const handleSave = async () => {
    if (identityChanged) {
      setError(null);
      setStep("confirm");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateProfileInfo(profileFields);
      finishSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmIdentity = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateClientIdentity({
        password,
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await updateProfileInfo(profileFields);
      finishSave(result.username !== initial.username ? result.username : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={requestClose} title="Editar perfil" backdrop={modalBackdrop}>
      {confirmingExit ? (
        <Column gap="16" fillWidth paddingTop="12">
          <Feedback
            variant="warning"
            title="Tienes cambios sin guardar"
            description="Si sales ahora, perderás los ajustes que hiciste en este formulario."
          />
          <Row fillWidth gap="8" horizontal="end" wrap>
            <Button variant="tertiary" size="m" onClick={() => setConfirmingExit(false)}>
              Seguir editando
            </Button>
            <Button variant="secondary" size="m" onClick={onClose}>
              Salir de todos modos
            </Button>
            <Button variant="primary" size="m" onClick={handleSave} loading={saving}>
              Guardar y salir
            </Button>
          </Row>
        </Column>
      ) : step === "confirm" ? (
        <Column gap="16" fillWidth paddingTop="12">
          <Feedback
            variant="info"
            title="Confirma tu contraseña"
            description="Cambiar tu nombre, apellido o nombre de usuario requiere confirmar tu contraseña actual."
          />
          <PasswordInput
            id="profile-identity-password"
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <Feedback variant="danger" description={error} />}

          <Row fillWidth gap="8" horizontal="end">
            <Button
              variant="secondary"
              size="m"
              onClick={() => {
                setStep("form");
                setError(null);
              }}
              disabled={saving}
            >
              Volver
            </Button>
            <Button
              variant="primary"
              size="m"
              onClick={handleConfirmIdentity}
              loading={saving}
              disabled={!password}
            >
              Confirmar
            </Button>
          </Row>
        </Column>
      ) : (
        <Column gap="16" fillWidth paddingTop="12">
          <Row fillWidth gap="24" vertical="start" s={{ direction: "column" }}>
            {/* ── Navegación lateral (escritorio): máx. 30% del ancho ── */}
            <Column
              gap="4"
              style={{ flex: "0 0 30%", maxWidth: "30%", minWidth: 0 }}
              s={{ hide: true }}
            >
              {EDIT_SECTIONS.map((s) => (
                <ToggleButton
                  key={s.key}
                  fillWidth
                  horizontal="start"
                  prefixIcon={s.icon}
                  label={s.label}
                  selected={section === s.key}
                  onClick={() => setSection(s.key)}
                />
              ))}
            </Column>

            {/* ── Navegación móvil: solo iconos arriba, con indicador de activa ── */}
            <Row fillWidth gap="8" horizontal="center" hide s={{ hide: false }}>
              {EDIT_SECTIONS.map((s) => (
                <Column key={s.key} gap="4" horizontal="center">
                  <ToggleButton
                    prefixIcon={s.icon}
                    selected={section === s.key}
                    onClick={() => setSection(s.key)}
                    aria-label={s.label}
                  />
                  {/* Indicador de sección activa */}
                  <Line
                    background={section === s.key ? "brand-strong" : "transparent"}
                    style={{ width: 16, height: 2 }}
                  />
                </Column>
              ))}
            </Row>

            <Line vert background="neutral-alpha-weak" style={{ alignSelf: "stretch" }} s={{ hide: true }} />

            {/* ── Contenido de la sección activa ── */}
            <Column gap="20" fillWidth style={{ minWidth: 0 }}>
              {(() => {
                const active = EDIT_SECTIONS.find((s) => s.key === section)!;
                return (
                  <Column gap="4" fillWidth>
                    <Heading variant="heading-strong-m">{active.label}</Heading>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      {active.description}
                    </Text>
                  </Column>
                );
              })()}
              <Line background="neutral-alpha-weak" />

              {section === "general" && (
                <Column gap="20" fillWidth>
                  <Column gap="12" fillWidth>
                    <Text variant="label-strong-s">Imagen de perfil</Text>
                    <Row gap="16" vertical="center" wrap>
                      <Avatar
                        size="l"
                        {...(avatarUrl
                          ? { src: avatarUrl }
                          : { value: (form.firstName[0] ?? "U").toUpperCase() })}
                      />
                      <Column gap="2" style={{ minWidth: 0 }}>
                        <Text variant="label-strong-s">
                          {[form.firstName, form.lastName].filter(Boolean).join(" ") || "Tu nombre"}
                        </Text>
                        <Text variant="label-default-s" onBackground="neutral-weak">
                          /{form.username || "usuario"}
                        </Text>
                      </Column>
                      {onOpenAvatar && (
                        <Button size="s" variant="secondary" prefixIcon="camera" onClick={onOpenAvatar}>
                          Cambiar imagen
                        </Button>
                      )}
                    </Row>
                  </Column>
                  <Grid columns={2} s={{ columns: 1 }} gap="12" fillWidth>
                    <Input id="profile-first-name" label="Nombre" value={form.firstName} onChange={set("firstName")} />
                    <Input id="profile-last-name" label="Apellido" value={form.lastName} onChange={set("lastName")} />
                  </Grid>
                  <Input
                    id="profile-username"
                    label="Nombre de usuario"
                    value={form.username}
                    onChange={set("username")}
                    description={`Tu perfil vive en /${form.username || "usuario"} · cambiarlo requiere confirmar tu contraseña`}
                  />
                </Column>
              )}

              {section === "contacto" && (
                <Column gap="12" fillWidth>
                  <Grid columns={2} s={{ columns: 1 }} gap="12" fillWidth>
                    <Input
                      id="profile-whatsapp"
                      label="Teléfono celular"
                      type="tel"
                      value={form.whatsapp}
                      onChange={set("whatsapp")}
                    />
                    {/* Label corto: los labels a dos líneas se enciman con el valor */}
                    <Input
                      id="profile-secondary-email"
                      label="Segundo correo"
                      type="email"
                      value={form.secondaryEmail}
                      onChange={set("secondaryEmail")}
                    />
                    <Select
                      id="profile-contact-preference"
                      label="Preferencia de contacto"
                      placeholder="Selecciona una opción"
                      options={CONTACT_PREFERENCE_OPTIONS}
                      value={form.contactPreference ?? ""}
                      onSelect={(value) => setForm((f) => ({ ...f, contactPreference: value }))}
                    />
                    <Input
                      id="profile-contact-hours"
                      label="Horario de contacto"
                      placeholder="L-V 9:00-18:00"
                      value={form.contactHours ?? ""}
                      onChange={set("contactHours")}
                    />
                  </Grid>
                </Column>
              )}

              {section === "empresa" && (
                <Grid columns={2} s={{ columns: 1 }} gap="12" fillWidth>
                  <Input id="profile-company" label="Empresa" value={form.company} onChange={set("company")} />
                  <Input id="profile-brand" label="Marca" value={form.brand} onChange={set("brand")} />
                  <Input
                    id="profile-industry"
                    label="Giro o industria"
                    value={form.industry ?? ""}
                    onChange={set("industry")}
                  />
                  <Input
                    id="profile-website"
                    label="Sitio web"
                    type="url"
                    value={form.website ?? ""}
                    onChange={set("website")}
                  />
                </Grid>
              )}

              {section === "perfil" && (
                <Grid columns={2} s={{ columns: 1 }} gap="12" fillWidth>
                  <Input id="profile-address" label="Dirección" value={form.address} onChange={set("address")} />
                  <Input
                    id="profile-motto"
                    label="Lema"
                    value={form.motto}
                    onChange={set("motto")}
                    maxLength={MAX_MOTTO_CHARS}
                  />
                  <Text
                    variant="label-default-s"
                    onBackground="neutral-weak"
                    style={{ gridColumn: "1 / -1" }}
                  >
                    * El lema no puede exceder los {MAX_MOTTO_CHARS} caracteres.
                  </Text>
                </Grid>
              )}

              {section === "seguridad" && (
                <Column gap="16" fillWidth>
                  <Feedback
                    variant="info"
                    title="Tu perfil es privado"
                    description="Nadie más puede ver tu perfil de client, ni siquiera con el enlace directo. Tus diseñadores solo ven los proyectos y recursos que tú decidas compartir con ellos."
                  />
                  <Text variant="body-default-s" onBackground="neutral-weak">
                    Protege tu cuenta desde el panel de seguridad: ahí puedes cambiar tu contraseña,
                    activar la verificación en dos pasos y cerrar sesiones abiertas en otros dispositivos.
                  </Text>
                  <Row fillWidth>
                    <Button
                      variant="secondary"
                      size="m"
                      prefixIcon="shield"
                      onClick={() => {
                        onClose();
                        openUserProfile();
                      }}
                    >
                      Abrir panel de seguridad
                    </Button>
                  </Row>
                </Column>
              )}

              {section === "ayuda" && (
                <Column gap="16" fillWidth>
                  <Feedback
                    variant="info"
                    description="El recorrido de bienvenida te muestra cómo encontrar talento, publicar un brief y coordinar tus proyectos. Puedes volver a verlo las veces que quieras."
                  />
                  <Row fillWidth>
                    <Button
                      variant="secondary"
                      size="m"
                      prefixIcon="sparkles"
                      onClick={() => {
                        onClose();
                        // Lo levanta TourHost (layout raíz) al leer ?tour=1.
                        router.push("/dashboard/client?tour=1");
                      }}
                    >
                      Ver el recorrido otra vez
                    </Button>
                  </Row>
                </Column>
              )}
            </Column>
          </Row>

          {error && <Feedback variant="danger" description={error} />}

          <Line background="neutral-alpha-weak" />

          <Row fillWidth gap="8" horizontal="end">
            <Button variant="secondary" size="m" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="m"
              onClick={handleSave}
              loading={saving}
            >
              Guardar cambios
            </Button>
          </Row>
        </Column>
      )}
    </Modal>
  );
}

// ─── Seguridad y privacidad ───────────────────────────────────────────────────
// Las herramientas de protección de la cuenta (contraseña, verificación en dos
// pasos, sesiones activas) viven en el panel de cuenta de Clerk; este diálogo
// explica la privacidad del perfil y abre ese panel.
export function SecurityPrivacyDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { openUserProfile } = useClerk();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Seguridad y privacidad" backdrop={modalBackdrop}>
      <Column gap="16" fillWidth paddingTop="12">
        <Feedback
          variant="info"
          title="Tu perfil es privado"
          description="Nadie más puede ver tu perfil de client, ni siquiera con el enlace directo. Tus diseñadores solo ven los proyectos y recursos que tú decidas compartir con ellos."
        />
        <Text variant="body-default-s" onBackground="neutral-weak">
          Protege tu cuenta desde el panel de seguridad: ahí puedes cambiar tu contraseña, activar la
          verificación en dos pasos y cerrar sesiones abiertas en otros dispositivos.
        </Text>
        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            size="m"
            prefixIcon="shield"
            onClick={() => {
              onClose();
              openUserProfile();
            }}
          >
            Abrir panel de seguridad
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}
