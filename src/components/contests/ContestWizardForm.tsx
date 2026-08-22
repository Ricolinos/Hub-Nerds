"use client";

import {
  Button,
  Card,
  Column,
  DateInput,
  Dialog,
  Feedback,
  Heading,
  Icon,
  Input,
  NumberInput,
  RadioButton,
  Row,
  Select,
  Switch,
  Tag,
  Text,
  Textarea,
  useToast,
} from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createContest,
  publishContest,
  updateContest,
  type PaymentRequiredResult,
  type QuotaReachedResult,
} from "@/app/actions/contests";
import type { Prisma } from "@/generated/prisma/client";
import type { ContestBlock } from "@/lib/contestBrief";
import type { ContestPaymentKind, ContestStageSummary } from "@/lib/contests";
import { formatContestMoney } from "@/lib/contestPhaseUi";
import { PROJECT_SUBTYPES, PROJECT_TYPES } from "@/lib/projectTypes";
import {
  isInKindPrizeType,
  PRIZE_DESCRIPTION_MAX_LENGTH,
  PRIZE_FEE_PCT,
  type InKindPrizeType,
  type PrizeType,
} from "@/lib/prizeResponsibility";
import { ContestBlockEditor } from "./ContestBlockEditor";
import { ContestPaymentDialog } from "./ContestPaymentDialog";
import { ContestStagesEditor } from "./ContestStagesEditor";
import { PrizeResponsibilityDialog } from "./PrizeResponsibilityDialog";
import { ProUpsellModal } from "@/components/pro/ProUpsellModal";

const CONTEST_CREATE_UPSELL_BENEFITS = [
  "Convocatorias activas sin límite",
  "Publicaciones destacadas en el listado",
  "Prioridad en búsquedas y el feed",
];

/* ══ QUOTA_REACHED — cupo de convocatorias de un client Pro ═══════════════
   Distinto de PRO_REQUIRED: aquí el usuario ya es Pro, solo topó su cupo
   (2 activas simultáneas o 2 publicadas en el trimestre). Shape importado de
   createContest/publishContest (src/app/actions/contests.ts). ═══════════════ */
function isQuotaReachedResult(result: { ok: false; error: string }): result is QuotaReachedResult {
  return result.error === "QUOTA_REACHED";
}

// Mismo gotcha de discriminated union que isQuotaReachedResult: el miembro
// genérico `{ ok: false; error: string }` del retorno de publishContest
// widen-ea "PAYMENT_REQUIRED" a string, así que TS no estrecha con un simple
// `if (result.error === "PAYMENT_REQUIRED")` sin este type guard explícito.
function isPaymentRequiredResult(result: { ok: false; error: string }): result is PaymentRequiredResult {
  return result.error === "PAYMENT_REQUIRED";
}

function formatQuotaDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function quotaReachedMessage(quota: QuotaReachedResult): string {
  if (quota.reason === "simultaneous") {
    return "Tienes 2 convocatorias activas, el máximo de tu plan. Cierra o cancela una para publicar otra.";
  }
  const formattedDate = formatQuotaDate(quota.nextAvailableAt);
  return formattedDate
    ? `Alcanzaste el límite de 2 convocatorias publicadas en los últimos 3 meses. Podrás publicar de nuevo el ${formattedDate}.`
    : "Alcanzaste el límite de 2 convocatorias publicadas en los últimos 3 meses.";
}

/* ══ Wizard de creación de convocatoria (solo clients) ═══════════════════
   "Guardar borrador" llama createContest la primera vez y updateContest en
   los siguientes clicks (mismo contestId ya creado); "Publicar" guarda el
   borrador más reciente y encadena publishContest — sus errores de
   validación (fechas, montos, tamaño de Terna) se muestran tal cual regresa
   el server action, sin duplicar esa validación aquí. ════════════════════ */

const PROJECT_TYPE_OPTIONS = [
  { value: "", label: "Sin categoría" },
  ...PROJECT_TYPES.map((type) => ({ value: type, label: type })),
];

function daysFromNow(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function formatSignedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

/* ══ Premio en especie (Términos §3.5) ═════════════════════════════════
   Solo un Client Pro puede elegir una de las dos modalidades en especie;
   un Client Free las ve deshabilitadas con un candado (Tag "Client Pro")
   que abre el mismo ProUpsellModal del resto del wizard. ══════════════ */
const PRIZE_TYPE_OPTIONS: { value: PrizeType; label: string; description: string }[] = [
  {
    value: "MONETARY",
    label: "Monetario",
    description: "El valor se deposita en custodia y se libera al ganador",
  },
  {
    value: "IN_KIND_DIRECT",
    label: "En especie — entrega directa",
    description: "Tú entregas el premio. Tarifa de plataforma: 8% del valor declarado",
  },
  {
    value: "IN_KIND_PLATFORM",
    label: "En especie — mediante Hub-Nerds",
    description: "Nosotros entregamos el premio. Tarifa: 12% del valor declarado",
  },
];

// Datos de arranque para modo edición (/convocatorias/[slug]/editar): el
// caller (server page) ya resolvió ownership + status DRAFT y deserializó
// brief/terms a bloques (toContestBlocks, src/lib/contestBrief.ts, mismo
// helper que usa el visor público). Con `initialContest` presente, el wizard
// arranca con `contestId`/`slug` ya fijos, así que "Guardar borrador" llama
// updateContest desde el primer click (nunca createContest).
export interface ContestWizardInitialData {
  id: string;
  slug: string;
  title: string;
  projectType: string | null;
  projectSubtype: string | null;
  prizeAmount: number;
  shortlistFee: number;
  shortlistSize: number;
  maxApplicants: number | null;
  applyDeadline: string;
  submitDeadline: string;
  resultsDate: string;
  rightsPolicy: string | null;
  briefBlocks: ContestBlock[];
  termsBlocks: ContestBlock[];
  prizeType: string;
  prizeDescription: string | null;
  responsibilityAcceptedAt: string | null;
  stages: ContestStageSummary[];
}

// `isPro` no viaja en `initialContest`: el estado de plan del client dueño
// se resuelve en el server (dbUser vía getOrCreateUser + isPro, src/lib/plan.ts)
// desde las dos server pages que montan este wizard (nueva/editar) y se pasa
// como prop simple, igual de fresco en ambos modos.
export function ContestWizardForm({
  initialContest,
  isPro,
}: {
  initialContest?: ContestWizardInitialData;
  isPro: boolean;
}) {
  const router = useRouter();
  const { addToast } = useToast();

  const [title, setTitle] = useState(initialContest?.title ?? "");
  const [projectType, setProjectType] = useState(initialContest?.projectType ?? "");
  const [projectSubtype, setProjectSubtype] = useState(initialContest?.projectSubtype ?? "");
  const [prizeAmount, setPrizeAmount] = useState(initialContest?.prizeAmount ?? 0);
  const [shortlistFee, setShortlistFee] = useState(initialContest?.shortlistFee ?? 0);
  const [shortlistSize, setShortlistSize] = useState(initialContest?.shortlistSize ?? 5);
  const [limitApplicants, setLimitApplicants] = useState(initialContest?.maxApplicants != null);
  const [maxApplicants, setMaxApplicants] = useState(initialContest?.maxApplicants ?? 20);
  const [applyDeadline, setApplyDeadline] = useState(() =>
    initialContest ? new Date(initialContest.applyDeadline) : daysFromNow(14),
  );
  const [submitDeadline, setSubmitDeadline] = useState(() =>
    initialContest ? new Date(initialContest.submitDeadline) : daysFromNow(28),
  );
  const [resultsDate, setResultsDate] = useState(() =>
    initialContest ? new Date(initialContest.resultsDate) : daysFromNow(35),
  );
  const [rightsPolicy, setRightsPolicy] = useState(initialContest?.rightsPolicy ?? "");
  const [briefBlocks, setBriefBlocks] = useState<ContestBlock[]>(initialContest?.briefBlocks ?? []);
  const [termsBlocks, setTermsBlocks] = useState<ContestBlock[]>(initialContest?.termsBlocks ?? []);
  const [prizeType, setPrizeType] = useState<PrizeType>((initialContest?.prizeType as PrizeType) ?? "MONETARY");
  const [prizeDescription, setPrizeDescription] = useState(initialContest?.prizeDescription ?? "");
  const [responsibilityAcceptedAt, setResponsibilityAcceptedAt] = useState<string | null>(
    initialContest?.responsibilityAcceptedAt ?? null,
  );

  const [contestId, setContestId] = useState<string | null>(initialContest?.id ?? null);
  const [slug, setSlug] = useState<string | null>(initialContest?.slug ?? null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upsellOpen, setUpsellOpen] = useState(false);
  const [quotaReached, setQuotaReached] = useState<QuotaReachedResult | null>(null);
  const [responsibilityOpen, setResponsibilityOpen] = useState(false);
  const [responsibilityRequiredNotice, setResponsibilityRequiredNotice] = useState(false);
  const [openingResponsibility, setOpeningResponsibility] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{
    contestId: string;
    kind: ContestPaymentKind;
    amountMXN: number;
  } | null>(null);

  const subtypeOptions =
    projectType && projectType in PROJECT_SUBTYPES
      ? [
          { value: "", label: "Sin subtipo" },
          ...PROJECT_SUBTYPES[projectType as keyof typeof PROJECT_SUBTYPES].map((subtype) => ({
            value: subtype,
            label: subtype,
          })),
        ]
      : [];

  const buildInput = () => ({
    title,
    brief: briefBlocks as unknown as Prisma.InputJsonValue,
    terms: termsBlocks as unknown as Prisma.InputJsonValue,
    projectType: projectType || null,
    projectSubtype: projectSubtype || null,
    prizeAmount,
    prizeType,
    prizeDescription: isInKindPrizeType(prizeType) ? prizeDescription.trim() : null,
    shortlistFee,
    shortlistSize,
    maxApplicants: limitApplicants ? maxApplicants : null,
    applyDeadline: applyDeadline.toISOString(),
    submitDeadline: submitDeadline.toISOString(),
    resultsDate: resultsDate.toISOString(),
    rightsPolicy: rightsPolicy || null,
  });

  // Devuelve { id, slug } vigentes (recién creados o ya existentes) tras
  // guardar, o null si falló — para encadenar publishContest sin depender
  // del estado (setState es asíncrono: en el primer guardado+publicado
  // dentro del mismo click, el `slug` de React todavía no se repintó).
  const saveDraft = async (): Promise<{ id: string; slug: string } | null> => {
    setError(null);
    if (!title.trim()) {
      setError("El título es obligatorio.");
      return null;
    }
    const input = buildInput();
    if (!contestId) {
      const result = await createContest(input);
      if (!result.ok) {
        if (result.error === "PRO_REQUIRED") {
          setUpsellOpen(true);
          return null;
        }
        if (isQuotaReachedResult(result)) {
          setQuotaReached(result);
          return null;
        }
        setError(result.error);
        return null;
      }
      setContestId(result.contestId);
      setSlug(result.slug);
      return { id: result.contestId, slug: result.slug };
    }
    const result = await updateContest(contestId, input);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    return { id: contestId, slug: slug ?? "" };
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    const saved = await saveDraft();
    setSaving(false);
    if (saved) addToast({ variant: "success", message: "Borrador guardado." });
  };

  // Elegir una modalidad en especie sin plan Pro abre el upsell en vez de
  // seleccionarla (RadioButton disabled no dispara onToggle, ver el Card
  // clicable que envuelve cada opción bloqueada más abajo). Cambiar de tipo
  // de premio invalida localmente la firma previa (el server hace lo mismo
  // en updateContest si el cambio llega a guardarse).
  const handlePrizeTypeChange = (nextType: PrizeType) => {
    if (isInKindPrizeType(nextType) && !isPro) {
      setUpsellOpen(true);
      return;
    }
    if (nextType === prizeType) return;
    setPrizeType(nextType);
    setResponsibilityAcceptedAt(null);
  };

  // La carta de responsabilidad necesita un contestId real: si el borrador
  // todavía no se guardó (primera vez que el usuario llega a "Premio" y da
  // click en "Leer y firmar"), lo guardamos primero y recién con ese id
  // abrimos el Dialog — transparente para el usuario (nota bajo el botón).
  const handleOpenResponsibilityDialog = async () => {
    setResponsibilityRequiredNotice(false);
    if (contestId) {
      setResponsibilityOpen(true);
      return;
    }
    setOpeningResponsibility(true);
    const saved = await saveDraft();
    setOpeningResponsibility(false);
    if (saved) setResponsibilityOpen(true);
  };

  const handlePublish = async () => {
    setPublishing(true);
    const saved = await saveDraft();
    if (!saved) {
      setPublishing(false);
      return;
    }
    const result = await publishContest(saved.id);
    setPublishing(false);
    if (!result.ok) {
      if (isQuotaReachedResult(result)) {
        setQuotaReached(result);
        return;
      }
      if (result.error === "RESPONSIBILITY_REQUIRED") {
        setResponsibilityRequiredNotice(true);
        setResponsibilityOpen(true);
        return;
      }
      if (isPaymentRequiredResult(result)) {
        setPaymentDialog({ contestId: saved.id, kind: result.kind, amountMXN: result.amountMXN });
        return;
      }
      setError(result.error);
      addToast({ variant: "danger", message: result.error });
      return;
    }
    addToast({ variant: "success", message: "Convocatoria publicada." });
    if (saved.slug) router.push(`/convocatorias/${saved.slug}`);
  };

  return (
    <Column fillWidth gap="24" maxWidth="m">
      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-s">Datos generales</Heading>
        <Input id="contest-title" label="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Row fillWidth gap="12" wrap>
          <Column style={{ flex: 1, minWidth: 200 }}>
            <Select
              id="contest-project-type"
              label="Tipo de proyecto"
              value={projectType}
              onSelect={(value) => {
                setProjectType(value as string);
                setProjectSubtype("");
              }}
              options={PROJECT_TYPE_OPTIONS}
            />
          </Column>
          <Column style={{ flex: 1, minWidth: 200 }}>
            <Select
              id="contest-project-subtype"
              label="Subtipo"
              value={projectSubtype}
              onSelect={(value) => setProjectSubtype(value as string)}
              options={subtypeOptions}
              disabled={subtypeOptions.length === 0}
            />
          </Column>
        </Row>
      </Column>

      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-s">Premio y transparencia</Heading>

        <Column gap="8" fillWidth>
          <Text variant="label-default-s" onBackground="neutral-weak">
            Tipo de premio
          </Text>
          <Column gap="8" fillWidth>
            {PRIZE_TYPE_OPTIONS.map((option) => {
              const locked = isInKindPrizeType(option.value) && !isPro;
              const optionContent = (
                <Row fillWidth gap="12" vertical="start" horizontal="between">
                  <RadioButton
                    name="contest-prize-type"
                    value={option.value}
                    isChecked={prizeType === option.value}
                    onToggle={() => handlePrizeTypeChange(option.value)}
                    disabled={locked}
                    label={option.label}
                    description={option.description}
                  />
                  {locked && <Tag size="s" variant="neutral" prefixIcon="shield" label="Client Pro" />}
                </Row>
              );
              return locked ? (
                <Card
                  key={option.value}
                  fillWidth
                  padding="12"
                  radius="m"
                  border="neutral-alpha-weak"
                  background="neutral-alpha-weak"
                  onClick={() => setUpsellOpen(true)}
                >
                  {optionContent}
                </Card>
              ) : (
                <Row key={option.value} fillWidth padding="12" radius="m" border="neutral-alpha-weak">
                  {optionContent}
                </Row>
              );
            })}
          </Column>
        </Column>

        <Row fillWidth gap="12" wrap>
          <Column style={{ flex: 1, minWidth: 160 }}>
            <NumberInput
              id="contest-prize-amount"
              label={isInKindPrizeType(prizeType) ? "Valor declarado del premio (MXN)" : "Premio (MXN)"}
              value={prizeAmount}
              onChange={setPrizeAmount}
              min={0}
            />
          </Column>
          <Column style={{ flex: 1, minWidth: 160 }}>
            <NumberInput
              id="contest-shortlist-fee"
              label="Fee de Terna por finalista (MXN)"
              value={shortlistFee}
              onChange={setShortlistFee}
              min={0}
            />
          </Column>
          <Column style={{ flex: 1, minWidth: 160 }}>
            <NumberInput
              id="contest-shortlist-size"
              label="Tamaño de la Terna"
              value={shortlistSize}
              onChange={setShortlistSize}
              min={3}
              max={7}
            />
          </Column>
        </Row>

        {isInKindPrizeType(prizeType) && (
          <Column gap="12" fillWidth>
            <Text variant="body-default-s" onBackground="brand-medium">
              Tarifa de plataforma ({PRIZE_FEE_PCT[prizeType]}%):{" "}
              {formatContestMoney((prizeAmount * (PRIZE_FEE_PCT[prizeType] ?? 0)) / 100)} — se paga antes de
              publicar
            </Text>
            <Textarea
              id="contest-prize-description"
              label="Descripción del premio"
              value={prizeDescription}
              onChange={(e) => setPrizeDescription(e.target.value)}
              lines={3}
              maxLength={PRIZE_DESCRIPTION_MAX_LENGTH}
              characterCount
              placeholder="Describe el premio en especie: qué es, sus características y cómo se entrega."
            />

            <Column
              fillWidth
              background="neutral-alpha-weak"
              radius="m"
              padding="16"
              gap="8"
            >
              <Row fillWidth gap="12" vertical="center" horizontal="between" wrap>
                <Row gap="8" vertical="center">
                  <Icon
                    name={responsibilityAcceptedAt ? "check" : "warning"}
                    size="s"
                    onBackground={responsibilityAcceptedAt ? "success-medium" : "warning-medium"}
                  />
                  <Text variant="body-default-s" onBackground="neutral-strong">
                    {responsibilityAcceptedAt
                      ? `Carta firmada el ${formatSignedDate(responsibilityAcceptedAt)}`
                      : "Carta de responsabilidad pendiente"}
                  </Text>
                </Row>
                <Button
                  variant="secondary"
                  size="s"
                  onClick={handleOpenResponsibilityDialog}
                  loading={openingResponsibility}
                >
                  {responsibilityAcceptedAt ? "Ver carta" : "Leer y firmar"}
                </Button>
              </Row>
              {!contestId && (
                <Text variant="body-default-xs" onBackground="neutral-weak">
                  Guardaremos tu borrador para firmar la carta.
                </Text>
              )}
            </Column>
          </Column>
        )}

        <Row gap="12" vertical="center" wrap>
          <Switch
            isChecked={limitApplicants}
            onToggle={() => setLimitApplicants((current) => !current)}
            ariaLabel="Limitar cupo de postulantes"
          />
          <Text variant="body-default-s">Limitar cupo de postulantes</Text>
          {limitApplicants && (
            <Column style={{ width: 140 }}>
              <NumberInput
                id="contest-max-applicants"
                label="Cupo máximo"
                value={maxApplicants}
                onChange={setMaxApplicants}
                min={1}
              />
            </Column>
          )}
        </Row>
      </Column>

      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-s">Fechas</Heading>
        <Row fillWidth gap="12" wrap>
          <Column style={{ flex: 1, minWidth: 180 }}>
            <DateInput
              id="contest-apply-deadline"
              label="Cierre de postulaciones"
              value={applyDeadline}
              onChange={setApplyDeadline}
            />
          </Column>
          <Column style={{ flex: 1, minWidth: 180 }}>
            <DateInput
              id="contest-submit-deadline"
              label="Cierre de entrega (Terna)"
              value={submitDeadline}
              onChange={setSubmitDeadline}
            />
          </Column>
          <Column style={{ flex: 1, minWidth: 180 }}>
            <DateInput
              id="contest-results-date"
              label="Fecha de resultados"
              value={resultsDate}
              onChange={setResultsDate}
            />
          </Column>
        </Row>
      </Column>

      <ContestStagesEditor
        isPro={isPro}
        initialStages={initialContest?.stages ?? []}
        ensureContestId={async () => {
          if (contestId) return contestId;
          const saved = await saveDraft();
          return saved?.id ?? null;
        }}
      />

      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-s">Brief</Heading>
        <ContestBlockEditor
          value={briefBlocks}
          onChange={setBriefBlocks}
          emptyHint="Describe el proyecto, objetivos y entregables esperados."
        />
      </Column>

      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-s">Cláusulas</Heading>
        <ContestBlockEditor
          value={termsBlocks}
          onChange={setTermsBlocks}
          emptyHint="Condiciones del concurso: entregables, criterios de evaluación, plazos."
        />
      </Column>

      <Column gap="16" fillWidth>
        <Heading variant="heading-strong-s">Política de derechos</Heading>
        <Textarea
          id="contest-rights-policy"
          label="Política de derechos"
          value={rightsPolicy}
          onChange={(e) => setRightsPolicy(e.target.value)}
          lines={4}
          placeholder="Solo el ganador cede derechos de su propuesta; los finalistas conservan su trabajo."
        />
      </Column>

      {error && <Feedback variant="danger" description={error} />}

      <Row fillWidth gap="12" horizontal="end">
        <Button variant="secondary" size="m" onClick={handleSaveDraft} loading={saving}>
          Guardar borrador
        </Button>
        <Button variant="primary" size="m" onClick={handlePublish} loading={publishing}>
          Publicar convocatoria
        </Button>
      </Row>

      <ProUpsellModal
        isOpen={upsellOpen}
        onClose={() => setUpsellOpen(false)}
        title="Publica sin límite"
        message="Publica convocatorias ilimitadas y destacadas con Client Pro"
        benefits={CONTEST_CREATE_UPSELL_BENEFITS}
      />

      <Dialog
        isOpen={quotaReached !== null}
        onClose={() => setQuotaReached(null)}
        title="Límite de convocatorias alcanzado"
        maxWidth={24}
        footer={
          <Row fillWidth horizontal="end">
            <Button variant="primary" size="m" onClick={() => setQuotaReached(null)}>
              Entendido
            </Button>
          </Row>
        }
      >
        <Text variant="body-default-m" onBackground="neutral-weak">
          {quotaReached ? quotaReachedMessage(quotaReached) : ""}
        </Text>
      </Dialog>

      {paymentDialog && (
        <ContestPaymentDialog
          isOpen={paymentDialog !== null}
          onClose={() => setPaymentDialog(null)}
          contestId={paymentDialog.contestId}
          kind={paymentDialog.kind}
          amountMXN={paymentDialog.amountMXN}
          feePct={isInKindPrizeType(prizeType) ? PRIZE_FEE_PCT[prizeType] : null}
        />
      )}

      {contestId && isInKindPrizeType(prizeType) && (
        <PrizeResponsibilityDialog
          isOpen={responsibilityOpen}
          onClose={() => {
            setResponsibilityOpen(false);
            setResponsibilityRequiredNotice(false);
          }}
          contestId={contestId}
          prizeType={prizeType as InKindPrizeType}
          showRequiredNotice={responsibilityRequiredNotice}
          onAccepted={(acceptedAt) => {
            setResponsibilityAcceptedAt(acceptedAt);
            setResponsibilityOpen(false);
            setResponsibilityRequiredNotice(false);
          }}
        />
      )}
    </Column>
  );
}
