"use client";

import { BlobFx, Modal } from "@once-ui-system/core";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";

export type AuthMode = "sign-in" | "sign-up";

interface AuthModalProps {
  mode: AuthMode | null;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}

export function AuthModal({ mode, onClose, onModeChange }: AuthModalProps) {
  return (
    <Modal
      open={mode !== null}
      onClose={onClose}
      title={mode === "sign-up" ? "Crear cuenta" : "Iniciar sesión"}
      backdrop={<BlobFx position="absolute" fill seed={7} />}
    >
      {mode === "sign-up" ? (
        <SignUpForm onSuccess={onClose} onSwitchToSignIn={() => onModeChange("sign-in")} />
      ) : (
        <SignInForm onSuccess={onClose} onSwitchToSignUp={() => onModeChange("sign-up")} />
      )}
    </Modal>
  );
}
