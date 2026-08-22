"use client";

import {
  Button,
  Checkbox,
  Column,
  Dialog,
  Feedback,
  Media,
  Row,
  Text,
  Textarea,
  useToast,
} from "@once-ui-system/core";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyToContest,
  getMyPortfolioPiecesForApplication,
  type MyPortfolioPieceOption,
} from "@/app/actions/contests";
import { resolveCoverSrc } from "@/lib/coverMedia";
import { ProUpsellModal } from "@/components/pro/ProUpsellModal";

const CONTEST_APPLY_UPSELL_BENEFITS = [
  "Postulaciones activas sin límite",
  "Prioridad en búsquedas y el feed",
  "CV Live compartible y descargable en PDF",
];

/* ══ Dialog de postulación (fase 1, anti spec-work) ═══════════════════════
   El freelancer postula SOLO con pitch + piezas YA EXISTENTES de su propio
   portafolio (checkbox multi-select, sin subir nada nuevo) — nunca produce
   una propuesta ad hoc. Mismo patrón de Dialog+footer que
   ClientCollabDialogs.tsx / ProfileView.tsx. ═══════════════════════════ */

export function ContestApplyDialog({
  isOpen,
  onClose,
  contestId,
}: {
  isOpen: boolean;
  onClose: () => void;
  contestId: string;
}) {
  const router = useRouter();
  const { addToast } = useToast();

  const [pitch, setPitch] = useState("");
  const [pieces, setPieces] = useState<MyPortfolioPieceOption[]>([]);
  const [loadingPieces, setLoadingPieces] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: addToast no está memoizado por ToastProvider (mismo criterio que NewConversationModal).
  useEffect(() => {
    if (!isOpen) return;
    setLoadingPieces(true);
    setError(null);
    (async () => {
      const result = await getMyPortfolioPiecesForApplication();
      if (result.ok) setPieces(result.pieces);
      else addToast({ variant: "danger", message: result.error });
      setLoadingPieces(false);
    })();
  }, [isOpen]);

  const handleClose = () => {
    if (sending) return;
    setPitch("");
    setSelectedIds([]);
    setError(null);
    onClose();
  };

  const togglePiece = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((pieceId) => pieceId !== id) : [...current, id],
    );
  };

  const handleApply = async () => {
    setSending(true);
    setError(null);
    const result = await applyToContest(contestId, pitch, selectedIds);
    setSending(false);
    if (!result.ok) {
      if (result.error === "PRO_REQUIRED") {
        setUpsellOpen(true);
        return;
      }
      setError(result.error);
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Postulación enviada." });
    setPitch("");
    setSelectedIds([]);
    onClose();
    router.refresh();
  };

  return (
    <>
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Postularme a esta convocatoria"
      description="Solo con tu pitch y piezas que ya tienes en tu portafolio — nada de trabajo nuevo sin garantía."
      footer={
        <Row fillWidth gap="8" horizontal="end">
          <Button variant="secondary" size="m" onClick={handleClose} disabled={sending}>
            Cancelar
          </Button>
          <Button variant="primary" size="m" onClick={handleApply} loading={sending} disabled={!pitch.trim()}>
            Enviar postulación
          </Button>
        </Row>
      }
    >
      <Column gap="16" fillWidth paddingTop="12">
        <Textarea
          id="contest-apply-pitch"
          label="Tu pitch"
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          lines={4}
          placeholder="Cuéntale al client por qué eres la persona indicada para esta convocatoria..."
        />

        <Column gap="8" fillWidth>
          <Text variant="label-strong-s" onBackground="neutral-weak">
            Piezas de tu portafolio (opcional)
          </Text>
          {loadingPieces && (
            <Text variant="body-default-s" onBackground="neutral-weak">
              Cargando tus piezas...
            </Text>
          )}
          {!loadingPieces && pieces.length === 0 && (
            <Text variant="body-default-s" onBackground="neutral-weak">
              Todavía no tienes piezas publicadas en tu portafolio.
            </Text>
          )}
          <Column gap="8" fillWidth style={{ maxHeight: 240, overflowY: "auto" }}>
            {pieces.map((piece) => (
              <Row key={piece.id} gap="12" vertical="center" fillWidth>
                {piece.coverUrl ? (
                  <Media
                    src={resolveCoverSrc(piece.coverUrl)}
                    alt={piece.title}
                    radius="s"
                    style={{ width: 48, height: 32, objectFit: "cover" }}
                  />
                ) : (
                  <Column
                    radius="s"
                    background="neutral-alpha-weak"
                    style={{ width: 48, height: 32, flexShrink: 0 }}
                  />
                )}
                <Checkbox
                  isChecked={selectedIds.includes(piece.id)}
                  onToggle={() => togglePiece(piece.id)}
                  label={piece.title}
                />
              </Row>
            ))}
          </Column>
        </Column>

        {error && <Feedback variant="danger" description={error} />}
      </Column>
    </Dialog>
    <ProUpsellModal
      isOpen={upsellOpen}
      onClose={() => setUpsellOpen(false)}
      title="Convocatorias sin límite"
      message="Inscríbete a las convocatorias ilimitadamente con una suscripción Pro"
      benefits={CONTEST_APPLY_UPSELL_BENEFITS}
    />
    </>
  );
}
