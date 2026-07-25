import { Avatar, Column, Row, SmartLink, Text } from "@once-ui-system/core";
import { CustomMDX } from "@/components";
import type { ContestUserSummary } from "@/lib/contests";
import { contestBlocksToMarkdown, toContestBlocks } from "@/lib/contestBrief";
import { formatDate } from "@/utils/formatDate";

/* ══ Entrega renderizada de un finalista (Server Component) ══════════════
   Reusado en tres lugares: la propia entrega del finalista (fase
   "production"/"judging"), la galería del panel de fallo del client
   (ContestJudgingPanel, como children pasados desde el Server Component
   page.tsx) y el resultado público del ganador (fase "awarded"). Nunca
   invocable desde un Client Component ("use client") — mismo motivo que
   CustomMDX (async Server Component, ver src/components/mdx.tsx). ════════ */

export function ContestEntryView({
  freelancer,
  submittedAt,
  contentBlocks,
  showAuthor = true,
}: {
  freelancer: ContestUserSummary;
  submittedAt: string | null;
  contentBlocks: unknown;
  showAuthor?: boolean;
}) {
  const markdown = contestBlocksToMarkdown(toContestBlocks(contentBlocks));
  const authorName = freelancer.name ?? freelancer.username ?? "Freelancer";

  return (
    <Column fillWidth gap="16" background="surface" border="neutral-alpha-weak" radius="l" padding="24">
      {showAuthor && (
        <Row fillWidth horizontal="between" vertical="center" gap="12" wrap>
          <Row gap="12" vertical="center" minWidth={0}>
            <Avatar size="s" {...(freelancer.imageUrl ? { src: freelancer.imageUrl } : { value: authorName[0]?.toUpperCase() ?? "P" })} />
            {freelancer.username ? (
              <SmartLink href={`/${freelancer.username}`} unstyled>
                <Text variant="label-strong-s" onBackground="neutral-strong">
                  {authorName}
                </Text>
              </SmartLink>
            ) : (
              <Text variant="label-strong-s" onBackground="neutral-strong">
                {authorName}
              </Text>
            )}
          </Row>
          {submittedAt && (
            <Text variant="body-default-s" onBackground="neutral-weak">
              Entregado el {formatDate(submittedAt)}
            </Text>
          )}
        </Row>
      )}
      {markdown ? (
        <Column as="article" gap="16">
          <CustomMDX source={markdown} />
        </Column>
      ) : (
        <Text variant="body-default-s" onBackground="neutral-weak">
          Esta entrega no tiene contenido todavía.
        </Text>
      )}
    </Column>
  );
}
