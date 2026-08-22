"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Column,
  Feedback,
  Heading,
  IconButton,
  Input,
  Line,
  Modal,
  RadioButton,
  Row,
  TagInput,
  Text,
  Textarea,
  ToggleButton,
} from "@once-ui-system/core";
import { updateCvData } from "@/app/actions/cv";
import type { CvData, CvEducation, CvExperience, CvQrTarget, CvSkill } from "@/lib/cvData";
import { BrandModalBackdrop } from "@/components/BrandModalBackdrop";

// ── Editor de CV Live (ventaja Freelancer Pro, ver src/lib/proPlans.ts) ────
// Mismo patrón visual que FreelancerProfileEditDialogs.tsx: navegación
// lateral con ToggleButton (íconos + Line en móvil), Column de contenido por
// sección, guardado con useTransition + updateCvData (src/app/actions/cv.ts).
// Estado local plano (sin merge parcial): "Guardar" manda el objeto CvData
// completo, "Cancelar" descarta el borrador sin tocar el servidor.

const MAX_INTRO_CHARS = 600;
const MAX_LOCATION_CHARS = 200;
const MAX_LANGUAGES = 5;
const MAX_EXPERIENCES = 10;
const MAX_SKILLS = 20;
const MAX_EDUCATION = 6;
const MAX_ACHIEVEMENTS = 10;
const MAX_FIELD_CHARS = 200;

const EDITOR_SECTIONS = [
  {
    key: "general",
    label: "General",
    icon: "infoCircle",
    description: "Tu presentación, ubicación e idiomas.",
  },
  {
    key: "experiencia",
    label: "Experiencia",
    icon: "briefcase",
    description: "Tu trayectoria laboral, de la más reciente a la más antigua.",
  },
  {
    key: "skills",
    label: "Skills",
    icon: "sparkles",
    description: "Tus habilidades y nivel de dominio (1 a 5).",
  },
  {
    key: "formacion",
    label: "Formación",
    icon: "book",
    description: "Estudios y certificaciones.",
  },
  {
    key: "qr",
    label: "QR del CV",
    icon: "link",
    description: "A dónde apunta el QR de la versión imprimible de tu CV.",
  },
] as const;

type EditorSectionKey = (typeof EDITOR_SECTIONS)[number]["key"];

function emptyExperience(): CvExperience {
  return {
    id: crypto.randomUUID(),
    role: "",
    company: "",
    startLabel: "",
    endLabel: null,
    description: "",
    achievements: [],
  };
}

function emptySkill(): CvSkill {
  return { name: "", level: 3 };
}

function emptyEducation(): CvEducation {
  return { id: crypto.randomUUID(), title: "", institution: "", year: "" };
}

const modalBackdrop = <BrandModalBackdrop />;

interface CvEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cvData: CvData;
  // Usado únicamente para mostrar las rutas reales en el selector de QR.
  username: string;
}

export function CvEditorDialog({ isOpen, onClose, cvData, username }: CvEditorDialogProps) {
  const router = useRouter();
  const [section, setSection] = useState<EditorSectionKey>("general");
  const [intro, setIntro] = useState(cvData.intro);
  const [location, setLocation] = useState(cvData.location);
  const [languages, setLanguages] = useState<string[]>(cvData.languages);
  const [qrTarget, setQrTarget] = useState<CvQrTarget>(cvData.qrTarget);
  const [experiences, setExperiences] = useState<CvExperience[]>(cvData.experiences);
  const [skills, setSkills] = useState<CvSkill[]>(cvData.skills);
  const [education, setEducation] = useState<CvEducation[]>(cvData.education);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reabrir el editor debe partir siempre del último CV guardado, no de un
  // borrador previo sin guardar (mismo criterio que FreelancerEditInfoDialog).
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo debe reiniciar el formulario al abrir.
  useEffect(() => {
    if (isOpen) {
      setSection("general");
      setIntro(cvData.intro);
      setLocation(cvData.location);
      setLanguages(cvData.languages);
      setQrTarget(cvData.qrTarget);
      setExperiences(cvData.experiences);
      setSkills(cvData.skills);
      setEducation(cvData.education);
      setError(null);
      setJustSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const handleClose = () => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    onClose();
  };

  const handleSave = () => {
    setError(null);
    setJustSaved(false);
    const data: CvData = { intro, location, languages, qrTarget, experiences, skills, education };
    startTransition(async () => {
      try {
        await updateCvData(data);
        setJustSaved(true);
        router.refresh();
        closeTimeoutRef.current = setTimeout(() => {
          onClose();
        }, 900);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar el CV. Intenta de nuevo.");
      }
    });
  };

  // ── Experiencia ──
  const updateExperience = (index: number, patch: Partial<CvExperience>) => {
    setExperiences((current) => current.map((exp, i) => (i === index ? { ...exp, ...patch } : exp)));
  };
  const addExperience = () => {
    if (experiences.length >= MAX_EXPERIENCES) return;
    setExperiences((current) => [...current, emptyExperience()]);
  };
  const removeExperience = (index: number) => {
    setExperiences((current) => current.filter((_, i) => i !== index));
  };
  const moveExperience = (index: number, direction: -1 | 1) => {
    setExperiences((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const addAchievement = (expIndex: number) => {
    setExperiences((current) =>
      current.map((exp, i) =>
        i === expIndex && exp.achievements.length < MAX_ACHIEVEMENTS
          ? { ...exp, achievements: [...exp.achievements, ""] }
          : exp,
      ),
    );
  };
  const updateAchievement = (expIndex: number, achIndex: number, value: string) => {
    setExperiences((current) =>
      current.map((exp, i) =>
        i === expIndex
          ? { ...exp, achievements: exp.achievements.map((a, j) => (j === achIndex ? value : a)) }
          : exp,
      ),
    );
  };
  const removeAchievement = (expIndex: number, achIndex: number) => {
    setExperiences((current) =>
      current.map((exp, i) =>
        i === expIndex ? { ...exp, achievements: exp.achievements.filter((_, j) => j !== achIndex) } : exp,
      ),
    );
  };

  // ── Skills ──
  const updateSkill = (index: number, patch: Partial<CvSkill>) => {
    setSkills((current) => current.map((skill, i) => (i === index ? { ...skill, ...patch } : skill)));
  };
  const addSkill = () => {
    if (skills.length >= MAX_SKILLS) return;
    setSkills((current) => [...current, emptySkill()]);
  };
  const removeSkill = (index: number) => {
    setSkills((current) => current.filter((_, i) => i !== index));
  };

  // ── Formación ──
  const updateEducation = (index: number, patch: Partial<CvEducation>) => {
    setEducation((current) => current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };
  const addEducation = () => {
    if (education.length >= MAX_EDUCATION) return;
    setEducation((current) => [...current, emptyEducation()]);
  };
  const removeEducation = (index: number) => {
    setEducation((current) => current.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Editar CV Live" backdrop={modalBackdrop}>
      <Column gap="16" fillWidth paddingTop="12">
        {justSaved && <Feedback variant="success" description="CV guardado." />}
        {error && <Feedback variant="danger" description={error} />}

        <Row fillWidth gap="24" vertical="start" s={{ direction: "column" }}>
          {/* ── Navegación lateral (escritorio) ── */}
          <Column gap="4" style={{ flex: "0 0 28%", maxWidth: "28%", minWidth: 0 }} s={{ hide: true }}>
            {EDITOR_SECTIONS.map((s) => (
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

          {/* ── Navegación móvil: solo iconos ── */}
          <Row fillWidth gap="8" horizontal="center" hide s={{ hide: false }}>
            {EDITOR_SECTIONS.map((s) => (
              <Column key={s.key} gap="4" horizontal="center">
                <ToggleButton
                  prefixIcon={s.icon}
                  selected={section === s.key}
                  onClick={() => setSection(s.key)}
                  aria-label={s.label}
                />
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
              const active = EDITOR_SECTIONS.find((s) => s.key === section)!;
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
                <Textarea
                  id="cv-intro"
                  label="Introducción"
                  placeholder="2-3 frases sobre tu experiencia y especialidad."
                  lines={5}
                  value={intro}
                  maxLength={MAX_INTRO_CHARS}
                  characterCount
                  onChange={(e) => setIntro(e.target.value)}
                />
                <Input
                  id="cv-location"
                  label="Ubicación"
                  placeholder="Ciudad, país (ej. Ciudad de México, UTC−6)"
                  value={location}
                  maxLength={MAX_LOCATION_CHARS}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <Column gap="8" fillWidth>
                  <TagInput
                    id="cv-languages"
                    label="Idiomas"
                    placeholder={
                      languages.length >= MAX_LANGUAGES
                        ? "Máximo alcanzado"
                        : "Escribe y presiona Enter para añadir"
                    }
                    value={languages}
                    onChange={(next) => setLanguages(next.slice(0, MAX_LANGUAGES))}
                    disabled={languages.length >= MAX_LANGUAGES}
                  />
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    {languages.length}/{MAX_LANGUAGES} idiomas
                  </Text>
                </Column>
              </Column>
            )}

            {section === "experiencia" && (
              <Column gap="20" fillWidth>
                {experiences.map((exp, index) => (
                  <Column
                    key={exp.id}
                    background="surface"
                    border="neutral-alpha-weak"
                    radius="l"
                    padding="16"
                    gap="12"
                    fillWidth
                  >
                    <Row fillWidth horizontal="between" vertical="center" gap="8">
                      <Text variant="label-strong-s">Experiencia {index + 1}</Text>
                      <Row gap="4" vertical="center">
                        <IconButton
                          icon="chevronUp"
                          size="s"
                          variant="tertiary"
                          tooltip="Subir"
                          disabled={index === 0}
                          onClick={() => moveExperience(index, -1)}
                        />
                        <IconButton
                          icon="chevronDown"
                          size="s"
                          variant="tertiary"
                          tooltip="Bajar"
                          disabled={index === experiences.length - 1}
                          onClick={() => moveExperience(index, 1)}
                        />
                        <IconButton
                          icon="trash"
                          size="s"
                          variant="tertiary"
                          tooltip="Eliminar"
                          onClick={() => removeExperience(index)}
                        />
                      </Row>
                    </Row>

                    <Row fillWidth gap="12" wrap>
                      <Input
                        id={`cv-exp-role-${exp.id}`}
                        label="Puesto"
                        value={exp.role}
                        maxLength={MAX_FIELD_CHARS}
                        onChange={(e) => updateExperience(index, { role: e.target.value })}
                        style={{ flex: "1 1 200px" }}
                      />
                      <Input
                        id={`cv-exp-company-${exp.id}`}
                        label="Empresa"
                        value={exp.company}
                        maxLength={MAX_FIELD_CHARS}
                        onChange={(e) => updateExperience(index, { company: e.target.value })}
                        style={{ flex: "1 1 200px" }}
                      />
                    </Row>

                    <Row fillWidth gap="12" wrap>
                      <Input
                        id={`cv-exp-start-${exp.id}`}
                        label="Desde"
                        placeholder="Ene 2023"
                        value={exp.startLabel}
                        maxLength={MAX_FIELD_CHARS}
                        onChange={(e) => updateExperience(index, { startLabel: e.target.value })}
                        style={{ flex: "1 1 140px" }}
                      />
                      <Input
                        id={`cv-exp-end-${exp.id}`}
                        label="Hasta"
                        placeholder="Presente (déjalo vacío)"
                        value={exp.endLabel ?? ""}
                        maxLength={MAX_FIELD_CHARS}
                        onChange={(e) =>
                          updateExperience(index, { endLabel: e.target.value === "" ? null : e.target.value })
                        }
                        style={{ flex: "1 1 140px" }}
                      />
                    </Row>

                    <Textarea
                      id={`cv-exp-description-${exp.id}`}
                      label="Descripción corta"
                      lines={2}
                      value={exp.description}
                      maxLength={MAX_FIELD_CHARS}
                      characterCount
                      onChange={(e) => updateExperience(index, { description: e.target.value })}
                    />

                    <Column gap="8" fillWidth>
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        Logros
                      </Text>
                      {exp.achievements.map((achievement, achIndex) => (
                        <Row key={`${exp.id}-ach-${achIndex}`} fillWidth gap="8" vertical="center">
                          <Input
                            id={`cv-exp-achievement-${exp.id}-${achIndex}`}
                            value={achievement}
                            maxLength={MAX_FIELD_CHARS}
                            placeholder="Un logro puntual y medible"
                            onChange={(e) => updateAchievement(index, achIndex, e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <IconButton
                            icon="trash"
                            size="s"
                            variant="tertiary"
                            tooltip="Eliminar logro"
                            onClick={() => removeAchievement(index, achIndex)}
                          />
                        </Row>
                      ))}
                      <Row>
                        <Button
                          size="s"
                          variant="secondary"
                          prefixIcon="plus"
                          onClick={() => addAchievement(index)}
                          disabled={exp.achievements.length >= MAX_ACHIEVEMENTS}
                        >
                          Añadir logro
                        </Button>
                      </Row>
                    </Column>
                  </Column>
                ))}

                <Row fillWidth horizontal="between" vertical="center" gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    {experiences.length}/{MAX_EXPERIENCES} experiencias
                  </Text>
                  <Button
                    size="s"
                    variant="secondary"
                    prefixIcon="plus"
                    onClick={addExperience}
                    disabled={experiences.length >= MAX_EXPERIENCES}
                  >
                    Añadir experiencia
                  </Button>
                </Row>
              </Column>
            )}

            {section === "skills" && (
              <Column gap="16" fillWidth>
                {skills.map((skill, index) => (
                  <Row
                    key={`skill-${index}`}
                    fillWidth
                    gap="12"
                    vertical="center"
                    wrap
                    background="surface"
                    border="neutral-alpha-weak"
                    radius="m"
                    padding="12"
                  >
                    <Input
                      id={`cv-skill-name-${index}`}
                      label="Skill"
                      value={skill.name}
                      maxLength={MAX_FIELD_CHARS}
                      onChange={(e) => updateSkill(index, { name: e.target.value })}
                      style={{ flex: "1 1 200px" }}
                    />
                    <Column gap="4">
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        Nivel
                      </Text>
                      <Row gap="4" vertical="center">
                        {[1, 2, 3, 4, 5].map((dot) => (
                          <Row
                            key={dot}
                            width="20"
                            height="20"
                            radius="full"
                            horizontal="center"
                            vertical="center"
                            background={dot <= skill.level ? "brand-strong" : "neutral-alpha-medium"}
                            style={{ cursor: "pointer" }}
                            onClick={() => updateSkill(index, { level: dot as CvSkill["level"] })}
                          />
                        ))}
                      </Row>
                    </Column>
                    <IconButton
                      icon="trash"
                      size="s"
                      variant="tertiary"
                      tooltip="Eliminar skill"
                      onClick={() => removeSkill(index)}
                    />
                  </Row>
                ))}

                <Row fillWidth horizontal="between" vertical="center" gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    {skills.length}/{MAX_SKILLS} skills
                  </Text>
                  <Button
                    size="s"
                    variant="secondary"
                    prefixIcon="plus"
                    onClick={addSkill}
                    disabled={skills.length >= MAX_SKILLS}
                  >
                    Añadir skill
                  </Button>
                </Row>
              </Column>
            )}

            {section === "formacion" && (
              <Column gap="16" fillWidth>
                {education.map((entry, index) => (
                  <Row
                    key={entry.id}
                    fillWidth
                    gap="12"
                    vertical="end"
                    wrap
                    background="surface"
                    border="neutral-alpha-weak"
                    radius="m"
                    padding="12"
                  >
                    <Input
                      id={`cv-edu-title-${entry.id}`}
                      label="Título"
                      value={entry.title}
                      maxLength={MAX_FIELD_CHARS}
                      onChange={(e) => updateEducation(index, { title: e.target.value })}
                      style={{ flex: "1 1 200px" }}
                    />
                    <Input
                      id={`cv-edu-institution-${entry.id}`}
                      label="Institución"
                      value={entry.institution}
                      maxLength={MAX_FIELD_CHARS}
                      onChange={(e) => updateEducation(index, { institution: e.target.value })}
                      style={{ flex: "1 1 200px" }}
                    />
                    <Input
                      id={`cv-edu-year-${entry.id}`}
                      label="Año"
                      value={entry.year}
                      maxLength={MAX_FIELD_CHARS}
                      onChange={(e) => updateEducation(index, { year: e.target.value })}
                      style={{ flex: "1 1 100px" }}
                    />
                    <IconButton
                      icon="trash"
                      size="s"
                      variant="tertiary"
                      tooltip="Eliminar formación"
                      onClick={() => removeEducation(index)}
                    />
                  </Row>
                ))}

                <Row fillWidth horizontal="between" vertical="center" gap="8">
                  <Text variant="label-default-s" onBackground="neutral-weak">
                    {education.length}/{MAX_EDUCATION} entradas
                  </Text>
                  <Button
                    size="s"
                    variant="secondary"
                    prefixIcon="plus"
                    onClick={addEducation}
                    disabled={education.length >= MAX_EDUCATION}
                  >
                    Añadir formación
                  </Button>
                </Row>
              </Column>
            )}

            {section === "qr" && (
              <Column gap="16" fillWidth>
                <Column gap="8" fillWidth>
                  <RadioButton
                    name="cv-qr-target"
                    label={`Mi portafolio (/${username})`}
                    isChecked={qrTarget === "portfolio"}
                    onToggle={() => setQrTarget("portfolio")}
                  />
                  <RadioButton
                    name="cv-qr-target"
                    label={`Mi CV interactivo (/${username}/cv)`}
                    isChecked={qrTarget === "cv"}
                    onToggle={() => setQrTarget("cv")}
                  />
                </Column>
                <Text variant="body-default-s" onBackground="neutral-weak">
                  Aparece en la versión imprimible de tu CV.
                </Text>
              </Column>
            )}
          </Column>
        </Row>

        <Line background="neutral-alpha-weak" />
        <Row fillWidth gap="8" horizontal="end" wrap>
          <Button variant="tertiary" size="m" onClick={handleClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="primary" size="m" onClick={handleSave} loading={isPending}>
            Guardar
          </Button>
        </Row>
      </Column>
    </Modal>
  );
}
