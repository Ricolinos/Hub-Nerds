import { Column, Line, Row, SmartLink, Text } from "@once-ui-system/core";
import { LEGAL_DOCS } from "@/resources";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Column as="main" fillWidth horizontal="center" paddingY="80" paddingX="24">
      <Column fillWidth maxWidth="s" gap="48" minWidth={0}>
        {children}

        <Line background="neutral-alpha-weak" />

        <Row fillWidth horizontal="center" gap="24" wrap s={{ direction: "column", horizontal: "center" }}>
          <SmartLink href={LEGAL_DOCS.terms.href}>
            <Text variant="label-default-s" onBackground="neutral-weak">
              {LEGAL_DOCS.terms.shortTitle}
            </Text>
          </SmartLink>
          <SmartLink href={LEGAL_DOCS.privacy.href}>
            <Text variant="label-default-s" onBackground="neutral-weak">
              {LEGAL_DOCS.privacy.shortTitle}
            </Text>
          </SmartLink>
        </Row>
      </Column>
    </Column>
  );
}
