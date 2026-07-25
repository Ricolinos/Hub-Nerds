"use client";

import {
  Button,
  Column,
  DateInput,
  Feedback,
  Heading,
  Input,
  NumberInput,
  Row,
  Select,
  Switch,
  Text,
  Textarea,
  useToast,
} from "@once-ui-system/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createContest, publishContest, updateContest } from "@/app/actions/contests";
import type { Prisma } from "@/generated/prisma/client";
import type { ContestBlock } from "@/lib/contestBrief";
import { PROJECT_SUBTYPES, PROJECT_TYPES } from "@/lib/projectTypes";
import { ContestBlockEditor } from "./ContestBlockEditor";

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

export function ContestWizardForm() {
  const router = useRouter();
  const { addToast } = useToast();

  const [title, setTitle] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectSubtype, setProjectSubtype] = useState("");
  const [prizeAmount, setPrizeAmount] = useState(0);
  const [shortlistFee, setShortlistFee] = useState(0);
  const [shortlistSize, setShortlistSize] = useState(5);
  const [limitApplicants, setLimitApplicants] = useState(false);
  const [maxApplicants, setMaxApplicants] = useState(20);
  const [applyDeadline, setApplyDeadline] = useState(() => daysFromNow(14));
  const [submitDeadline, setSubmitDeadline] = useState(() => daysFromNow(28));
  const [resultsDate, setResultsDate] = useState(() => daysFromNow(35));
  const [rightsPolicy, setRightsPolicy] = useState("");
  const [briefBlocks, setBriefBlocks] = useState<ContestBlock[]>([]);
  const [termsBlocks, setTermsBlocks] = useState<ContestBlock[]>([]);

  const [contestId, setContestId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Row fillWidth gap="12" wrap>
          <Column style={{ flex: 1, minWidth: 160 }}>
            <NumberInput
              id="contest-prize-amount"
              label="Premio (MXN)"
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
    </Column>
  );
}
