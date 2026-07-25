"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Button,
  Chip,
  Column,
  Dialog,
  Feedback,
  Input,
  Modal,
  Row,
  Select,
  Switch,
  Text,
  Textarea,
} from "@once-ui-system/core";
import type { ClientResourceData } from "@/lib/collab";
import { validateExternalUrl } from "@/lib/externalLink";
import { PROJECT_SUBCATEGORIES, PROJECT_VERTICALS, type ProjectVertical } from "@/lib/projectCategories";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";
import { addClientResource, createCollabProject, updateClientResource, deleteClientResource } from "@/app/actions/collab";

const modalBackdrop = <BrandModalBackdrop />;

export interface ConnectionOption {
  value: string; // connectionId
  label: string; // nombre de la contraparte (freelancer o client, según quién abre el dialog)
}

/* ══ Nuevo proyecto en colaboración ═══════════════════════════════════════
   Compartido entre client y freelancer: solo cambia qué lista de connections
   (options) se le pasa desde cada vista. ═══════════════════════════════ */
export function NewCollabProjectDialog({
  isOpen,
  onClose,
  options,
}: {
  isOpen: boolean;
  onClose: () => void;
  options: ConnectionOption[];
}) {
  const router = useRouter();
  const [connectionId, setConnectionId] = useState<string>(options[0]?.value ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Formulario predictivo de categoría: vertical raíz + ramificaciones que se
  // despliegan dinámicamente tras accionar "Agregar". No hay campo en el
  // schema para esto (CollabProject no tiene categoría); se resume como una
  // línea al inicio de la descripción para no romper createCollabProject.
  const [vertical, setVertical] = useState<ProjectVertical | "">("");
  const [subcategoriesRevealed, setSubcategoriesRevealed] = useState(false);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setConnectionId(options[0]?.value ?? "");
    setTitle("");
    setDescription("");
    setVertical("");
    setSubcategoriesRevealed(false);
    setSelectedSubcategories([]);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAddVertical = () => {
    if (!vertical) return;
    setSubcategoriesRevealed(true);
    setSelectedSubcategories([]);
  };

  const toggleSubcategory = (subcategory: string) => {
    setSelectedSubcategories((current) =>
      current.includes(subcategory) ? current.filter((item) => item !== subcategory) : [...current, subcategory],
    );
  };

  const handleSave = async () => {
    if (!connectionId || !title.trim()) {
      setError("Elige a tu contraparte y escribe un título.");
      return;
    }
    setSaving(true);
    setError(null);
    const categoryLine =
      vertical && selectedSubcategories.length > 0
        ? `Categoría: ${vertical} → ${selectedSubcategories.join(", ")}`
        : null;
    const finalDescription = categoryLine
      ? [categoryLine, description.trim()].filter(Boolean).join("\n\n")
      : description;
    const result = await createCollabProject(connectionId, title, finalDescription);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    reset();
    onClose();
    router.refresh();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Nuevo proyecto en colaboración" backdrop={modalBackdrop}>
      <Column gap="16" fillWidth paddingTop="12">
        <Select
          id="collab-new-project-connection"
          label="Con quién"
          value={connectionId}
          onSelect={(value) => setConnectionId(value as string)}
          options={options}
        />
        <Input
          id="collab-new-project-title"
          label="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ej. Rediseño de marca"
        />

        <Column gap="12" fillWidth>
          <Row fillWidth gap="8" vertical="end" wrap>
            <Column style={{ flex: 1, minWidth: 160 }}>
              <Select
                id="collab-new-project-vertical"
                label="Tipo de proyecto"
                value={vertical}
                onSelect={(value) => {
                  setVertical(value as ProjectVertical);
                  setSubcategoriesRevealed(false);
                  setSelectedSubcategories([]);
                }}
                options={PROJECT_VERTICALS.map((item) => ({ value: item, label: item }))}
              />
            </Column>
            <Button variant="secondary" size="m" prefixIcon="plus" onClick={handleAddVertical} disabled={!vertical}>
              Agregar
            </Button>
          </Row>

          {subcategoriesRevealed && vertical && (
            <Column gap="8" fillWidth>
              <Text variant="label-default-s" onBackground="neutral-weak">
                Elige una o más ramificaciones
              </Text>
              <Row gap="8" wrap>
                {PROJECT_SUBCATEGORIES[vertical].map((subcategory) => (
                  <Chip
                    key={subcategory}
                    label={subcategory}
                    selected={selectedSubcategories.includes(subcategory)}
                    onClick={() => toggleSubcategory(subcategory)}
                  />
                ))}
              </Row>
            </Column>
          )}
        </Column>

        <Textarea
          id="collab-new-project-description"
          label="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          lines={3}
        />

        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="m"
            onClick={handleSave}
            loading={saving}
            disabled={!connectionId || !title.trim()}
          >
            Crear proyecto
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

/* ══ Agregar recurso ("Mis recursos" del client) ═════════════════════════ */
export function AddClientResourceDialog({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setLabel("");
    setUrl("");
    setDescription("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!label.trim() || !url.trim()) return;
    if (!validateExternalUrl(url)) {
      setError("La URL no es válida.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await addClientResource(label, url, description);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    reset();
    onClose();
    router.refresh();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Agregar recurso" backdrop={modalBackdrop}>
      <Column gap="16" fillWidth paddingTop="12">
        <Feedback
          variant="info"
          description="Aquí no se guardan archivos pesados: sube tus assets a tu servicio de nube favorito (Google Drive, Dropbox, OneDrive...) y comparte solo el link, cuidando que tenga permisos de acceso."
        />
        <Input
          id="client-resource-label"
          label="Etiqueta"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej. Logotipos finales"
        />
        <Input
          id="client-resource-url"
          label="URL"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://drive.google.com/..."
        />
        <Textarea
          id="client-resource-description"
          label="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          lines={2}
        />

        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="m"
            onClick={handleSave}
            loading={saving}
            disabled={!label.trim() || !url.trim()}
          >
            Guardar recurso
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

export interface ShareableFreelancer {
  id: string;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
}

/* ══ Compartir un recurso con freelancers (connections ACCEPTED) ═════════════ */
export function ShareClientResourceDialog({
  isOpen,
  onClose,
  resource,
  freelancers,
}: {
  isOpen: boolean;
  onClose: () => void;
  resource: ClientResourceData | null;
  freelancers: ShareableFreelancer[];
}) {
  const router = useRouter();
  // El padre remonta este dialog con key={resource?.id} al cambiar de
  // recurso, así que el estado inicial siempre corresponde al recurso abierto.
  const [selected, setSelected] = useState<string[]>(resource?.sharedWith ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const toggle = (freelancerId: string) => {
    setSelected((current) =>
      current.includes(freelancerId) ? current.filter((id) => id !== freelancerId) : [...current, freelancerId],
    );
  };

  const handleSave = async () => {
    if (!resource) return;
    setSaving(true);
    setError(null);
    const result = await updateClientResource(resource.id, { sharedWith: selected });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Compartir recurso" backdrop={modalBackdrop}>
      <Column gap="16" fillWidth paddingTop="12">
        {resource && (
          <Text variant="body-default-s" onBackground="neutral-weak" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
            Elige con qué freelancers compartir <strong>{resource.label}</strong>.
          </Text>
        )}

        {freelancers.length === 0 ? (
          <Feedback
            variant="info"
            description="Todavía no tienes ningún freelancer con conexión aceptada. Cuando un freelancer acepte tu solicitud de contacto, aparecerá aquí para poder compartirle este recurso."
          />
        ) : (
          <Column gap="8" fillWidth>
            {freelancers.map((freelancer) => (
              <Row key={freelancer.id} fillWidth horizontal="between" vertical="center" gap="12">
                <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
                  <Avatar
                    size="s"
                    {...(freelancer.imageUrl
                      ? { src: freelancer.imageUrl }
                      : { value: (freelancer.name?.[0] ?? freelancer.username?.[0] ?? "P").toUpperCase() })}
                  />
                  <Text
                    variant="label-default-s"
                    onBackground="neutral-strong"
                    style={{ minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {freelancer.name ?? freelancer.username ?? "Freelancer"}
                  </Text>
                </Row>
                <Switch
                  isChecked={selected.includes(freelancer.id)}
                  onToggle={() => toggle(freelancer.id)}
                  ariaLabel={`Compartir con ${freelancer.name ?? freelancer.username ?? "freelancer"}`}
                />
              </Row>
            ))}
          </Column>
        )}

        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="m"
            onClick={handleSave}
            loading={saving}
            disabled={freelancers.length === 0}
          >
            Guardar
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}

/* ══ Eliminar recurso ══════════════════════════════════════════════════ */
export function DeleteClientResourceDialog({
  isOpen,
  onClose,
  resource,
}: {
  isOpen: boolean;
  onClose: () => void;
  resource: ClientResourceData | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleClose = () => {
    if (deleting) return;
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    if (!resource) return;
    setDeleting(true);
    setError(null);
    const result = await deleteClientResource(resource.id);
    setDeleting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="¿Eliminar este recurso?"
      footer={
        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={deleting}>
            Cancelar
          </Button>
          <Button variant="danger" size="m" onClick={handleConfirm} loading={deleting}>
            Sí, eliminar
          </Button>
        </Row>
      }
    >
      <Column gap="16" fillWidth>
        <Feedback
          variant="danger"
          icon
          description="Esta acción no se puede deshacer. Dejará de estar disponible para los freelancers con los que lo compartiste."
        />
        {resource && (
          <Text variant="body-default-m">
            Vas a eliminar <strong>{resource.label}</strong>.
          </Text>
        )}
        {error && <Feedback variant="danger" description={error} />}
      </Column>
    </Dialog>
  );
}
