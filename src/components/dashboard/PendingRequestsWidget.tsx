"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Column, Feedback, Heading, Line, Row, Text } from "@once-ui-system/core";
import type { FreelancerConnectionData } from "@/lib/collab";
import { respondContactRequest } from "@/app/actions/collab";

interface PendingRequestsWidgetProps {
  requests: FreelancerConnectionData[];
}

// Widget client: el freelancer acepta/rechaza solicitudes de contacto
// pendientes directamente desde su dashboard (mismo patrón de manejo de
// loading/error que CollabProjectView.tsx).
export function PendingRequestsWidget({ requests }: PendingRequestsWidgetProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRespond = async (connectionId: string, accept: boolean) => {
    setBusyId(connectionId);
    setError(null);
    const result = await respondContactRequest(connectionId, accept);
    if (!result.ok) {
      setError(result.error);
    } else {
      router.refresh();
    }
    setBusyId(null);
  };

  return (
    <Column gap="16" fillWidth>
      <Heading variant="heading-strong-m">Solicitudes de contacto pendientes</Heading>

      {error && (
        <Feedback variant="danger" description={error} onClose={() => setError(null)} showCloseButton fillWidth />
      )}

      <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
        {requests.map((request, index) => {
          const initials = (request.client.name?.[0] ?? request.client.username?.[0] ?? "U").toUpperCase();
          const busy = busyId === request.id;
          return (
            <Column key={request.id} fillWidth>
              {index > 0 && <Line background="neutral-alpha-weak" />}
              <Row
                fillWidth
                paddingX="20"
                paddingY="16"
                horizontal="between"
                vertical="center"
                gap="16"
                wrap
              >
                <Row gap="12" vertical="center" style={{ minWidth: 0 }}>
                  <Avatar
                    size="s"
                    {...(request.client.imageUrl ? { src: request.client.imageUrl } : { value: initials })}
                  />
                  <Text
                    variant="label-default-m"
                    onBackground="neutral-strong"
                    style={{ minWidth: 0, overflowWrap: "anywhere" }}
                  >
                    {request.client.name ?? request.client.username ?? "Client"}
                  </Text>
                </Row>
                <Row gap="8" vertical="center">
                  <Button
                    variant="danger"
                    size="s"
                    loading={busy}
                    disabled={busy}
                    onClick={() => handleRespond(request.id, false)}
                  >
                    Rechazar
                  </Button>
                  <Button
                    variant="success"
                    size="s"
                    loading={busy}
                    disabled={busy}
                    onClick={() => handleRespond(request.id, true)}
                  >
                    Aceptar
                  </Button>
                </Row>
              </Row>
            </Column>
          );
        })}
      </Column>
    </Column>
  );
}
