"use client";

import { useClerk } from "@clerk/nextjs";
import {
  Avatar,
  Button,
  Column,
  Feedback,
  Heading,
  Icon,
  Input,
  Line,
  Modal,
  Option,
  Row,
  Switch,
  Text,
  Textarea,
  ToggleButton,
} from "@once-ui-system/core";
import { MediaUpload } from "@once-ui-system/core/modules";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  updateDesignerCard,
  updateFeaturedImage,
  updateFreelancerContactSharing,
  updateFreelancerRoles,
  updateFreelancerVisibility,
  updateProfileAppearance,
  type DesignerCardInput,
} from "@/app/actions/updateProfile";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { ImageCropper } from "@/components/shared/ImageCropper";
import { MAX_SECONDARY_ROLES, FREELANCER_ROLES } from "@/lib/freelancerRoles";
import { AppearancePanel, type ProfileAppearanceValue } from "@/components/profile/AppearancePanel";

const MAX_FEATURED_BYTES = 4 * 1024 * 1024;
// Salida final de la imagen destacada, misma proporción vertical 3:4 de la
// tarjeta Designerd en Explorar.
const FEATURED_W = 900;
const FEATURED_H = 1200;
// Lado del viewport de encuadre en pantalla, misma proporción 3:4.
const FEATURED_CROP_VIEW_W = 210;
const FEATURED_CROP_VIEW_H = 280;
const MAX_FEATURED_DATA_URL_CHARS = 700_000;
const MAX_CARD_QUOTE_CHARS = 180;
const MAX_HEADLINE_CHARS = 60;
const MAX_BIO_CHARS = 280;

const modalBackdrop = <BrandModalBackdrop />;

// ─── Cambiar imagen destacada de la tarjeta Designerd ────────────────────────
export function FeaturedImageUploadDialog({
  isOpen,
  onClose,
  currentFeaturedUrl,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentFeaturedUrl?: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const exportCrop = useRef<(() => Promise<string | null>) | null>(null);

  const handleFileUpload = async (selected: File) => {
    setFile(null);
    if (selected.size > MAX_FEATURED_BYTES) {
      setError("La imagen supera el máximo de 4MB permitido.");
      return;
    }
    setError(null);
    setFile(selected);
  };

  const persist = async (dataUrl: string | null) => {
    setSaving(true);
    setError(null);
    try {
      await updateFeaturedImage(dataUrl);
      setFile(null);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la imagen destacada.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!file) return;
    setSaving(true);
    setError(null);
    try {
      const dataUrl = await exportCrop.current?.();
      if (!dataUrl) throw new Error("crop");
      await persist(dataUrl);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "crop"
          ? err.message
          : "No se pudo procesar la imagen.",
      );
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imagen destacada" backdrop={modalBackdrop}>
      <Column gap="16" fillWidth paddingTop="12">
        <Feedback
          variant="info"
          description="Esta imagen es el fondo de tu tarjeta en Explorar / designerds. Sube únicamente imágenes libres de derechos de autor y sin contenido ofensivo. Máximo 4MB; formato vertical 3:4."
        />

        {file ? (
          <Column gap="12" fillWidth horizontal="center">
            <ImageCropper
              file={file}
              exportRef={exportCrop}
              viewWidth={FEATURED_CROP_VIEW_W}
              viewHeight={FEATURED_CROP_VIEW_H}
              outputWidth={FEATURED_W}
              outputHeight={FEATURED_H}
              maxDataUrlChars={MAX_FEATURED_DATA_URL_CHARS}
              maskShape="none"
              ariaLabel="Arrastra la imagen para reencuadrar la tarjeta"
            />
            <Button variant="tertiary" size="s" onClick={() => setFile(null)} disabled={saving}>
              Elegir otra imagen
            </Button>
          </Column>
        ) : (
          <MediaUpload
            aspectRatio="3 / 4"
            accept="image/*"
            initialPreviewImage={currentFeaturedUrl ?? null}
            emptyState="Arrastra una imagen o haz click para buscar"
            onFileUpload={handleFileUpload}
          />
        )}

        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="8" horizontal="end">
          {currentFeaturedUrl && (
            <Button variant="tertiary" size="m" onClick={() => persist(null)} disabled={saving}>
              Quitar imagen
            </Button>
          )}
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

// ─── Editar información de perfil (Freelancer): general, tarjeta, visibilidad, seguridad ──
const FREELANCER_EDIT_SECTIONS = [
  {
    key: "general",
    label: "General",
    icon: "infoCircle",
    description: "Tu identidad en la plataforma: imagen de perfil, nombre y usuario.",
  },
  {
    key: "tarjeta",
    label: "Tarjeta Designerd",
    icon: "gallery",
    description: "El contenido de tu tarjeta en Explorar / designerds.",
  },
  {
    key: "visibilidad",
    label: "Visibilidad",
    icon: "eye",
    description: "Quién puede ver tu perfil y tus datos de contacto.",
  },
  {
    key: "apariencia",
    label: "Apariencia",
    icon: "paintBrush",
    description: "Los colores y la forma que ven los visitantes de TU perfil.",
  },
  {
    key: "seguridad",
    label: "Seguridad",
    icon: "shield",
    description: "Protección de tu cuenta.",
  },
] as const;

type FreelancerEditSectionKey = (typeof FREELANCER_EDIT_SECTIONS)[number]["key"];

// ── Selector de roles (single/multiple) sin portal de Once-UI ───────────────
// El `Select` nativo de Once-UI monta su dropdown en un portal a
// document.body con z-index fijo en 9, más bajo que el z-index 10 del propio
// Modal: dentro de un modal el dropdown queda oculto detrás del overlay y sus
// opciones no reciben clicks. Este selector reutiliza los mismos primitivos
// (Input de solo lectura + Option), pero expande el menú EN FLUJO NORMAL del
// documento (como un acordeón) justo debajo del Input, en vez de portalizarlo:
// así hereda el scroll interno y el click-outside del propio `contentRef` del
// Modal sin depender de ningún cálculo de posición ni de ningún detalle
// interno de Modal/ScrollLock. En modo `multiple` muestra las etiquetas en
// español en vez del "N options selected" hardcodeado en inglés de Select.js.
const ROLE_MENU_MAX_HEIGHT = 320;

function RoleSelect({
  id,
  label,
  placeholder,
  options,
  value,
  onSelect,
  multiple = false,
}: {
  id: string;
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string | string[];
  onSelect: (value: string | string[]) => void;
  multiple?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedValues = Array.isArray(value) ? value : [];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const displayText = multiple
    ? selectedValues.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ")
    : (options.find((o) => o.value === value)?.label ?? "");

  const handleOptionClick = (optionValue: string) => {
    if (multiple) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onSelect(next);
    } else {
      onSelect(optionValue);
      setOpen(false);
    }
  };

  return (
    <Column ref={containerRef} gap="4" fillWidth>
      <Input
        id={id}
        label={label}
        placeholder={placeholder}
        value={displayText}
        readOnly
        cursor="interactive"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <Column
          radius="l"
          border="neutral-alpha-medium"
          background="surface"
          shadow="l"
          padding="4"
          gap="2"
          fillWidth
          overflowY="auto"
          style={{ maxHeight: ROLE_MENU_MAX_HEIGHT }}
        >
          {options.map((option) => {
            const selected = multiple ? selectedValues.includes(option.value) : option.value === value;
            return (
              <Option
                key={option.value}
                label={option.label}
                value={option.value}
                selected={selected}
                onClick={() => handleOptionClick(option.value)}
                hasPrefix={
                  multiple && selected ? (
                    <Icon name="check" size="xs" onBackground="neutral-weak" />
                  ) : undefined
                }
              />
            );
          })}
        </Column>
      )}
    </Column>
  );
}

export function FreelancerEditInfoDialog({
  isOpen,
  onClose,
  initialIsPublic,
  initialShareWhatsapp,
  initial,
  initialPrimaryRole,
  initialSecondaryRoles,
  initialAppearance,
  onPreviewAppearanceChange,
  avatarUrl,
  displayName,
  username,
  featuredImageUrl,
  onOpenAvatar,
  onOpenFeatured,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialIsPublic: boolean;
  initialShareWhatsapp: boolean;
  initial: DesignerCardInput;
  initialPrimaryRole?: string | null;
  initialSecondaryRoles?: string[];
  // Apariencia guardada del perfil (null en cada campo = default de marca).
  initialAppearance: ProfileAppearanceValue;
  // Refleja en vivo, en el render del perfil detrás del modal, cada cambio
  // de apariencia mientras el Freelancer todavía no guarda (preview en vivo).
  onPreviewAppearanceChange: (next: ProfileAppearanceValue) => void;
  avatarUrl?: string;
  displayName: string;
  username: string;
  featuredImageUrl?: string | null;
  // Cierran este modal y abren el diálogo de recorte correspondiente.
  onOpenAvatar: () => void;
  onOpenFeatured: () => void;
}) {
  const router = useRouter();
  const { openUserProfile } = useClerk();
  const [section, setSection] = useState<FreelancerEditSectionKey>("general");
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareWhatsapp, setShareWhatsapp] = useState(initialShareWhatsapp);
  const [form, setForm] = useState<DesignerCardInput>(initial);
  const [primaryRole, setPrimaryRole] = useState(initialPrimaryRole ?? "");
  const [secondaryRoles, setSecondaryRoles] = useState<string[]>(initialSecondaryRoles ?? []);
  const [appearance, setAppearance] = useState<ProfileAppearanceValue>(initialAppearance);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const initialSnapshotRef = useRef("");

  // Cambio de un swatch: actualiza el borrador local Y empuja el preview en
  // vivo hacia ProfileView (los data-attrs del wrapper del perfil), para que
  // el propio Freelancer vea el resultado sin guardar todavía.
  const handleAppearanceChange = (next: ProfileAppearanceValue) => {
    setAppearance(next);
    onPreviewAppearanceChange(next);
  };

  // Cancelar / salir sin guardar: además de cerrar, revierte el preview en
  // vivo al valor realmente guardado (si no se revirtiera, ProfileView
  // seguiría mostrando el borrador descartado hasta la próxima recarga).
  const cancelAndClose = () => {
    onPreviewAppearanceChange(initialAppearance);
    onClose();
  };

  // Reabrir el modal debe partir del valor guardado, no de un borrador previo sin guardar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe reiniciar el formulario al abrir, no en cada cambio de props mientras el modal está abierto.
  useEffect(() => {
    if (isOpen) {
      setSection("general");
      setIsPublic(initialIsPublic);
      setShareWhatsapp(initialShareWhatsapp);
      setForm(initial);
      setPrimaryRole(initialPrimaryRole ?? "");
      setSecondaryRoles(initialSecondaryRoles ?? []);
      setAppearance(initialAppearance);
      setError(null);
      setConfirmingExit(false);
      initialSnapshotRef.current = JSON.stringify({
        isPublic: initialIsPublic,
        shareWhatsapp: initialShareWhatsapp,
        form: initial,
        primaryRole: initialPrimaryRole ?? "",
        secondaryRoles: initialSecondaryRoles ?? [],
        appearance: initialAppearance,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const isDirty =
    isOpen &&
    initialSnapshotRef.current !==
      JSON.stringify({ isPublic, shareWhatsapp, form, primaryRole, secondaryRoles, appearance });

  const requestClose = () => {
    if (isDirty) {
      setConfirmingExit(true);
    } else {
      onClose();
    }
  };

  const tooLong =
    form.cardQuote.length > MAX_CARD_QUOTE_CHARS ||
    form.headline.length > MAX_HEADLINE_CHARS ||
    form.bio.length > MAX_BIO_CHARS;

  // Un rol secundario nunca puede repetir el principal recién elegido.
  const handlePrimaryRoleChange = (value: string) => {
    setPrimaryRole(value);
    setSecondaryRoles((current) => current.filter((role) => role !== value));
  };

  const handleSave = async () => {
    if (tooLong) return;
    setSaving(true);
    setError(null);
    try {
      await Promise.all([
        updateFreelancerVisibility(isPublic),
        updateFreelancerContactSharing(shareWhatsapp),
        updateDesignerCard(form),
        updateFreelancerRoles({ primaryRole, secondaryRoles }),
        updateProfileAppearance(appearance),
      ]);
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={requestClose}
      title="Editar información de perfil"
      backdrop={modalBackdrop}
    >
      <Column gap="16" fillWidth paddingTop="12">
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
              <Button variant="secondary" size="m" onClick={cancelAndClose}>
                Salir de todos modos
              </Button>
              <Button variant="primary" size="m" onClick={handleSave} loading={saving}>
                Guardar y salir
              </Button>
            </Row>
          </Column>
        ) : (
          <>
        <Row fillWidth gap="24" vertical="start" s={{ direction: "column" }}>
          {/* ── Navegación lateral (escritorio): máx. 30% del ancho ── */}
          <Column
            gap="4"
            style={{ flex: "0 0 30%", maxWidth: "30%", minWidth: 0 }}
            s={{ hide: true }}
          >
            {FREELANCER_EDIT_SECTIONS.map((s) => (
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
            {FREELANCER_EDIT_SECTIONS.map((s) => (
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
              const active = FREELANCER_EDIT_SECTIONS.find((s) => s.key === section)!;
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
                <Row gap="16" vertical="center" wrap>
                  <Avatar size="l" {...(avatarUrl ? { src: avatarUrl } : { value: (displayName[0] ?? "U").toUpperCase() })} />
                  <Column gap="2" style={{ minWidth: 0 }}>
                    <Text variant="label-strong-s">{displayName}</Text>
                    <Text variant="label-default-s" onBackground="neutral-weak">
                      @{username}
                    </Text>
                  </Column>
                  <Button size="s" variant="secondary" prefixIcon="camera" onClick={onOpenAvatar}>
                    Cambiar imagen
                  </Button>
                </Row>

                <Line background="neutral-alpha-weak" />

                <Column gap="12" fillWidth>
                  <Column gap="4">
                    <Text variant="label-strong-s">Roles</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Tu rol principal se destaca en tu perfil; elige hasta {MAX_SECONDARY_ROLES}{" "}
                      roles secundarios.
                    </Text>
                  </Column>

                  <RoleSelect
                    id="freelancer-primary-role"
                    label="Rol principal"
                    placeholder="Elige tu especialidad principal"
                    value={primaryRole}
                    onSelect={(value) => handlePrimaryRoleChange(value as string)}
                    options={FREELANCER_ROLES.map((role) => ({ value: role, label: role }))}
                  />

                  <RoleSelect
                    id="freelancer-secondary-roles"
                    label={`Roles secundarios (máx. ${MAX_SECONDARY_ROLES})`}
                    placeholder="Elige tus especialidades secundarias"
                    multiple
                    value={secondaryRoles}
                    onSelect={(values) => {
                      const next = values as string[];
                      if (next.length > MAX_SECONDARY_ROLES) return;
                      setSecondaryRoles(next);
                    }}
                    options={FREELANCER_ROLES.filter((role) => role !== primaryRole).map((role) => ({
                      value: role,
                      label: role,
                    }))}
                  />
                </Column>
              </Column>
            )}

            {section === "tarjeta" && (
              <Column gap="16" fillWidth>
                <Row gap="16" vertical="center" wrap>
                  <Column
                    radius="m"
                    overflow="hidden"
                    background="neutral-alpha-weak"
                    style={{ width: 56, height: 56, flexShrink: 0 }}
                    horizontal="center"
                    vertical="center"
                  >
                    {featuredImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura de vista previa
                      <img
                        src={featuredImageUrl}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Icon name="gallery" size="m" onBackground="neutral-weak" />
                    )}
                  </Column>
                  <Button size="s" variant="secondary" prefixIcon="camera" onClick={onOpenFeatured}>
                    Cambiar imagen
                  </Button>
                </Row>

                <Input
                  id="designer-headline"
                  label="Puesto"
                  placeholder="Ej. Diseñador de marca"
                  value={form.headline}
                  maxLength={MAX_HEADLINE_CHARS}
                  characterCount
                  onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                />
                <Textarea
                  id="designer-quote"
                  label="Cita"
                  placeholder="Una frase corta que te represente"
                  lines={2}
                  value={form.cardQuote}
                  maxLength={MAX_CARD_QUOTE_CHARS}
                  characterCount
                  onChange={(e) => setForm((f) => ({ ...f, cardQuote: e.target.value }))}
                />
                <Textarea
                  id="designer-bio"
                  label="Descripción breve"
                  placeholder="Cuéntanos brevemente quién eres y qué haces"
                  lines={3}
                  value={form.bio}
                  maxLength={MAX_BIO_CHARS}
                  characterCount
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </Column>
            )}

            {section === "visibilidad" && (
              <Column gap="12" fillWidth>
                <Row
                  fillWidth
                  horizontal="between"
                  vertical="center"
                  gap="16"
                  padding="16"
                  radius="m"
                  border="neutral-alpha-weak"
                  background="neutral-alpha-weak"
                >
                  <Column gap="4">
                    <Text variant="label-strong-s">Perfil público</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Tu tarjeta aparece en Explorar / designerds. Si lo desactivas, tu perfil
                      seguirá disponible buscándolo por nombre de usuario.
                    </Text>
                  </Column>
                  <Switch
                    isChecked={isPublic}
                    onToggle={() => setIsPublic((v) => !v)}
                    ariaLabel="Mantener mi perfil público en Explorar"
                  />
                </Row>

                <Row
                  fillWidth
                  horizontal="between"
                  vertical="center"
                  gap="16"
                  padding="16"
                  radius="m"
                  border="neutral-alpha-weak"
                  background="neutral-alpha-weak"
                >
                  <Column gap="4">
                    <Text variant="label-strong-s">Compartir mi WhatsApp</Text>
                    <Text variant="body-default-s" onBackground="neutral-weak">
                      Solo lo verán usuarios registrados de la plataforma que visiten tu perfil.
                      Nunca se muestra a visitantes anónimos. Apagado por defecto.
                    </Text>
                  </Column>
                  <Switch
                    isChecked={shareWhatsapp}
                    onToggle={() => setShareWhatsapp((v) => !v)}
                    ariaLabel="Compartir mi WhatsApp con otros usuarios de la plataforma"
                  />
                </Row>
              </Column>
            )}

            {section === "apariencia" && (
              <AppearancePanel value={appearance} onChange={handleAppearanceChange} />
            )}

            {section === "seguridad" && (
              <Column gap="16" fillWidth>
                <Feedback
                  variant="info"
                  description="Tu perfil es público en Explorar / designerds salvo que lo desactives en la sección Visibilidad. Protege tu cuenta desde el panel de seguridad: ahí puedes cambiar tu contraseña, activar la verificación en dos pasos y cerrar sesiones abiertas en otros dispositivos."
                />
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
          </Column>
        </Row>

        {error && <Feedback variant="danger" description={error} />}

        <Line background="neutral-alpha-weak" />

        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={cancelAndClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="m" onClick={handleSave} loading={saving} disabled={tooLong}>
            Guardar cambios
          </Button>
        </Row>
          </>
        )}
      </Column>
    </Modal>
  );
}
