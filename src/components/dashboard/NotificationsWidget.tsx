"use client";

import {
  Button,
  Column,
  Heading,
  Icon,
  Line,
  Row,
  SmartLink,
  Tag,
  Text,
} from "@once-ui-system/core";
import { useEffect, useState } from "react";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  type NotificationData,
} from "@/app/actions/notifications";
import { TASK_STATUS_LABELS } from "@/lib/projectStatus";
import type { IconName } from "@/resources/icons";

/* ══ Panel de notificaciones (Fase 6b), común a ambos dashboards ═══════
   Polling manual (carga al montar + "cargar más" por cursor), mismo
   patrón client-side que el resto del subsistema de mensajería. ═══════ */

function getPayloadField(payload: NotificationData["payload"], key: string): string | undefined {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

function describeNotification(notification: NotificationData): {
  icon: IconName;
  text: string;
  href: string;
} {
  const projectId = getPayloadField(notification.payload, "projectId");
  switch (notification.type) {
    case "NEW_MESSAGE":
      return {
        icon: "chat",
        text: "Tienes un mensaje nuevo.",
        href: projectId ? `/mensajes?project=${projectId}` : "/mensajes",
      };
    case "TASK_ASSIGNED":
      return {
        icon: "sparkles",
        text: "Te asignaron una tarea nueva.",
        href: projectId ? `/proyectos/${projectId}` : "/mensajes",
      };
    case "TASK_STATUS_CHANGED": {
      const status = getPayloadField(notification.payload, "status");
      const statusLabel = status ? (TASK_STATUS_LABELS[status] ?? status) : null;
      return {
        icon: "check",
        text: statusLabel
          ? `Una tarea cambió de estatus a "${statusLabel}".`
          : "Una tarea cambió de estatus.",
        href: projectId ? `/proyectos/${projectId}` : "/mensajes",
      };
    }
    default:
      return { icon: "bell", text: "Tienes una notificación nueva.", href: "/mensajes" };
  }
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsWidget() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getNotifications(10), getUnreadNotificationCount()]).then(([list, count]) => {
      if (cancelled) return;
      if (list.ok) {
        setNotifications(list.notifications);
        setCursor(list.nextCursor);
      }
      if (count.ok) setUnreadCount(count.count);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLoadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    const result = await getNotifications(10, cursor);
    setLoadingMore(false);
    if (!result.ok) return;
    setNotifications((current) => [...current, ...result.notifications]);
    setCursor(result.nextCursor);
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    const result = await markAllNotificationsRead();
    setMarkingAll(false);
    if (!result.ok) return;
    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        readAt: notification.readAt ?? new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
  };

  return (
    <Column gap="16" fillWidth>
      <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
        <Row gap="8" vertical="center">
          <Heading variant="heading-strong-m">Notificaciones</Heading>
          {unreadCount > 0 && <Tag size="s" scheme="danger" label={String(unreadCount)} />}
        </Row>
        {unreadCount > 0 && (
          <Button
            variant="tertiary"
            size="s"
            onClick={handleMarkAllRead}
            loading={markingAll}
            disabled={markingAll}
          >
            Marcar todas leídas
          </Button>
        )}
      </Row>

      {loading ? (
        <Text variant="label-default-s" onBackground="neutral-weak">
          Cargando...
        </Text>
      ) : notifications.length === 0 ? (
        <Column fillWidth padding="24" border="neutral-alpha-medium" radius="l" horizontal="center">
          <Text variant="body-default-s" onBackground="neutral-weak">
            Sin notificaciones por ahora.
          </Text>
        </Column>
      ) : (
        <Column fillWidth border="neutral-alpha-medium" radius="l" overflow="hidden">
          {notifications.map((notification, index) => {
            const { icon, text, href } = describeNotification(notification);
            const unread = notification.readAt === null;
            return (
              <Column key={notification.id} fillWidth>
                {index > 0 && <Line background="neutral-alpha-weak" />}
                <SmartLink href={href} unstyled fillWidth>
                  <Row
                    fillWidth
                    paddingX="20"
                    paddingY="12"
                    gap="12"
                    vertical="center"
                    {...(unread ? { background: "neutral-alpha-weak" as const } : {})}
                  >
                    <Icon
                      name={icon}
                      size="s"
                      onBackground={unread ? "brand-medium" : "neutral-weak"}
                    />
                    <Column gap="2" style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        variant={unread ? "label-strong-s" : "label-default-s"}
                        onBackground={unread ? "neutral-strong" : "neutral-weak"}
                        style={{ minWidth: 0, overflowWrap: "anywhere" }}
                      >
                        {text}
                      </Text>
                      <Text variant="label-default-s" onBackground="neutral-weak">
                        {formatWhen(notification.createdAt)}
                      </Text>
                    </Column>
                  </Row>
                </SmartLink>
              </Column>
            );
          })}
        </Column>
      )}

      {cursor && (
        <Row fillWidth horizontal="center">
          <Button
            variant="secondary"
            size="s"
            onClick={handleLoadMore}
            loading={loadingMore}
            disabled={loadingMore}
          >
            Cargar más
          </Button>
        </Row>
      )}
    </Column>
  );
}
