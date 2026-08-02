"use client";

import { Checkbox, Row, Text } from "@once-ui-system/core";
import { LEGAL_ROUTES } from "@/resources";

// Clic en los enlaces embebidos en el label del Checkbox: el label completo
// es clickeable (togglea la casilla), así que hay que frenar la propagación
// para que abrir Términos/Privacidad no marque/desmarque la casilla. Sin
// anotación de tipo explícita: el `as="a"` polimórfico de Text tipa el
// MouseEventHandler de forma rara (no resuelve a HTMLAnchorElement), así que
// dejamos que TS infiera el tipo por contexto en cada uso.
function stopLinkPropagation(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

interface AcceptLegalCheckboxProps {
  checked: boolean;
  onToggle: () => void;
}

// Casilla de aceptación de Términos y Privacidad compartida entre el alta
// por email (SignUpForm) y el gate de OAuth (complete-profile), para que el
// texto legal viva en un solo lugar y no diverja entre los dos formularios.
//
// GOTCHA: nunca pasar `id` a este Checkbox. En
// node_modules/@once-ui-system/core/dist/components/Checkbox.js el render
// hace `<InteractiveDetails disabled id={checkboxId} {...props} .../>` — el
// spread va DESPUÉS de `id`, así que un `id` propio pisa el `checkboxId`
// generado con `useId()` y deja el `aria-labelledby` del `[role="checkbox"]`
// apuntando a un elemento inexistente: la casilla queda sin nombre
// accesible, en silencio y sin fallar el typecheck.
export function AcceptLegalCheckbox({ checked, onToggle }: AcceptLegalCheckboxProps) {
  return (
    <Row fillWidth>
      <Checkbox
        style={{ alignItems: "flex-start" }}
        isChecked={checked}
        onToggle={onToggle}
        label={
          <>
            He leído y acepto los{" "}
            <Text
              as="a"
              href={LEGAL_ROUTES.terms}
              target="_blank"
              rel="noopener noreferrer"
              onBackground="brand-medium"
              onClick={stopLinkPropagation}
            >
              Términos y Condiciones
            </Text>{" "}
            y la{" "}
            <Text
              as="a"
              href={LEGAL_ROUTES.privacy}
              target="_blank"
              rel="noopener noreferrer"
              onBackground="brand-medium"
              onClick={stopLinkPropagation}
            >
              Política de Privacidad
            </Text>{" "}
            de Hub-Nerds.
          </>
        }
      />
    </Row>
  );
}
