"use client";

import { useState, type FormEvent } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { Column, Row, Input, Button, Text, ToggleButton } from "@once-ui-system/core";
import { SocialAuthButtons, type OAuthProviderStrategy } from "./SocialAuthButtons";
import { translateClerkError } from "./clerkErrors";
import { useClerkCaptcha } from "./useClerkCaptcha";
import { AcceptLegalCheckbox } from "@/components/legal/AcceptLegalCheckbox";
import type { Role } from "@/lib/roles";
import { LEGAL_VERSION } from "@/resources";

const TERMS_NOT_ACCEPTED_MSG =
  "Debes aceptar los Términos y Condiciones para crear tu cuenta.";

type Step = "register" | "verify";

interface SignUpFormProps {
  onSuccess?: () => void;
  onSwitchToSignIn?: () => void;
}

export function SignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const { isLoaded, signUp, setActive } = useSignUp();

  const [step, setStep] = useState<Step>("register");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [code, setCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthPending, setOauthPending] = useState<OAuthProviderStrategy | null>(null);

  const captchaVisible = useClerkCaptcha(step === "register");

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !role) return;
    if (!username.trim() || !firstName.trim() || !lastName.trim() || !whatsapp.trim()) {
      setErrorMsg("Completa todos los campos obligatorios.");
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg(TERMS_NOT_ACCEPTED_MSG);
      return;
    }
    setLoading(true);
    setErrorMsg("");

    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
        username: username.trim(),
        unsafeMetadata: {
          role,
          whatsapp: whatsapp.trim(),
          termsAcceptedAt: new Date().toISOString(),
          termsVersion: LEGAL_VERSION,
        },
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setStep("verify");
    } catch (err) {
      setErrorMsg(translateClerkError(err, "Error al crear la cuenta"));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (strategy: OAuthProviderStrategy) => {
    if (!isLoaded) return;
    setErrorMsg("");
    setOauthPending(strategy);

    try {
      await signUp.authenticateWithRedirect({
        strategy,
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err) {
      setOauthPending(null);
      setErrorMsg(translateClerkError(err, "No se pudo continuar con este proveedor"));
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setErrorMsg("");

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        onSuccess?.();
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setErrorMsg(translateClerkError(err, "Código incorrecto"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Column fillWidth gap="l">
      <Text variant="body-default-m" onBackground="neutral-weak" align="center">
        {step === "register"
          ? "Completa tus datos para registrarte."
          : `Ingresa el código enviado a ${email}.`}
      </Text>

      {step === "register" && (
        <SocialAuthButtons
          onSelect={handleOAuth}
          loading={loading}
          disabled={!isLoaded}
          pending={oauthPending}
        />
      )}

      {step === "register" ? (
        <form onSubmit={handleRegister} style={{ width: "100%" }}>
          <Column gap="m">
            <Row gap="m">
              <Input
                id="signup-firstName"
                label="Nombre"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
              <Input
                id="signup-lastName"
                label="Apellido"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </Row>

            <Input
              id="signup-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              id="signup-username"
              label="Nombre de usuario"
              description="Podrás usarlo para iniciar sesión en lugar de tu email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />

            <Input
              id="signup-whatsapp"
              label="WhatsApp"
              type="tel"
              description="Ej. +52 55 1234 5678"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              required
            />

            <Input
              id="signup-password"
              label="Contraseña"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Column gap="s">
              <Text variant="label-default-s" onBackground="neutral-weak">
                Selecciona tu rol
              </Text>
              <Row gap="m">
                <ToggleButton
                  type="button"
                  fillWidth
                  size="l"
                  selected={role === "client"}
                  onClick={() => setRole("client")}
                >
                  Client
                </ToggleButton>
                <ToggleButton
                  type="button"
                  fillWidth
                  size="l"
                  selected={role === "freelancer"}
                  onClick={() => setRole("freelancer")}
                >
                  Freelancer
                </ToggleButton>
              </Row>
            </Column>

            <AcceptLegalCheckbox
              checked={acceptedTerms}
              onToggle={() => setAcceptedTerms((current) => !current)}
            />

            {errorMsg && (
              <Text variant="body-default-s" onBackground="danger-weak">
                {errorMsg}
              </Text>
            )}

            <Column
              fillWidth
              horizontal="center"
              gap="s"
              radius="l"
              padding={captchaVisible ? "m" : undefined}
              background={captchaVisible ? "neutral-alpha-weak" : undefined}
              border={captchaVisible ? "neutral-alpha-medium" : undefined}
            >
              {captchaVisible && (
                <Column fillWidth gap="4" horizontal="center">
                  <Text variant="label-strong-s" align="center">
                    Verificación de seguridad
                  </Text>
                  <Text variant="body-default-s" onBackground="neutral-weak" align="center">
                    Para proteger la plataforma necesitamos confirmar que eres una
                    persona. Marca la casilla para continuar con tu registro.
                  </Text>
                </Column>
              )}
              <div id="clerk-captcha" />
            </Column>
            <Button
              type="submit"
              fillWidth
              loading={loading}
              disabled={
                !isLoaded ||
                !role ||
                !username.trim() ||
                !firstName.trim() ||
                !lastName.trim() ||
                !whatsapp.trim() ||
                !acceptedTerms
              }
            >
              Continuar
            </Button>
          </Column>
        </form>
      ) : (
        <form onSubmit={handleVerify} style={{ width: "100%" }}>
          <Column gap="m">
            <Input
              id="signup-code"
              label="Código de verificación"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />

            {errorMsg && (
              <Text variant="body-default-s" onBackground="danger-weak">
                {errorMsg}
              </Text>
            )}

            <Button type="submit" fillWidth loading={loading}>
              Verificar y continuar
            </Button>

            <Button
              type="button"
              variant="secondary"
              fillWidth
              onClick={() => setStep("register")}
            >
              Volver
            </Button>
          </Column>
        </form>
      )}

      {step === "register" && (
        <Row horizontal="center">
          <Text variant="body-default-s" onBackground="neutral-weak">
            ¿Ya tienes cuenta?{" "}
            {onSwitchToSignIn ? (
              <button
                type="button"
                onClick={onSwitchToSignIn}
                style={{
                  color: "inherit",
                  textDecoration: "underline",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  font: "inherit",
                  padding: 0,
                }}
              >
                Inicia sesión
              </button>
            ) : (
              <a href="/sign-in" style={{ color: "inherit", textDecoration: "underline" }}>
                Inicia sesión
              </a>
            )}
          </Text>
        </Row>
      )}
    </Column>
  );
}
