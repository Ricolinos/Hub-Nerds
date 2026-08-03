import { Card, Column, Heading } from "@once-ui-system/core";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata = { title: "Crear cuenta" };

export default function SignUpPage() {
  return (
    <Column fillWidth maxWidth="xs" paddingY="80" paddingX="24" horizontal="center">
      <Card fillWidth radius="xl" border="neutral-alpha-weak" shadow="xl" padding="32">
        <Column fillWidth gap="l" horizontal="center">
          <Heading variant="display-strong-s" align="center">
            Crear cuenta
          </Heading>
          <SignUpForm />
        </Column>
      </Card>
    </Column>
  );
}
