import { TrainingData } from './training-data';

export interface PlanSlot {
  drillId: string | null;
  modificationSelections: Record<string, string>;
}

export interface ModificationSelectionMapping {
  [sourceModificationId: string]: {
    targetModificationId: string;
    optionIds: Record<string, string>;
  };
}

export interface StagePlan {
  stageId: string;
  slots: PlanSlot[];
}

export function formatWhatsAppPlan(
  data: TrainingData,
  plans: StagePlan[],
  coachingPointsLabel: string,
): string {
  const stagePlansById = new Map(plans.map((plan) => [plan.stageId, plan]));
  const drillsById = new Map(data.drills.map((drill) => [drill.id, drill]));
  const modificationsById = new Map(
    data.catalog.modifications.map((modification) => [modification.id, modification]),
  );
  const sections: string[] = [];

  for (const stage of [...data.catalog.stages].sort((a, b) => a.order - b.order)) {
    const stagePlan = stagePlansById.get(stage.id);
    if (!stagePlan) {
      continue;
    }

    const drillEntries = stagePlan.slots.flatMap((slot) => {
      if (!slot.drillId) {
        return [];
      }
      const drill = drillsById.get(slot.drillId);
      return drill ? [{ drill, slot }] : [];
    });
    if (drillEntries.length === 0) {
      continue;
    }

    const drillLines = drillEntries.map(({ drill, slot }) => {
      const lines = [`- *${drill.title}*`];
      const description = markdownToWhatsApp(drill.descriptionMarkdown);
      if (description) {
        lines.push(indentContinuation(description));
      }

      const coachingPoints = (drill.coachingPoints ?? [])
        .map((point) => markdownToWhatsApp(point))
        .filter((point) => point.length > 0);
      if (coachingPoints.length > 0) {
        lines.push(`  *${coachingPointsLabel}:*`);
        lines.push(...coachingPoints.map((point) => `  - ${point.replace(/\n/g, '\n    ')}`));
      }

      for (const modificationId of drill.modificationIds) {
        const selectedOptionId = slot.modificationSelections[modificationId];
        if (!selectedOptionId) {
          continue;
        }

        const modification = modificationsById.get(modificationId);
        const option = modification?.options.find((candidate) => candidate.id === selectedOptionId);
        if (modification && option) {
          lines.push(`  - *${modification.label}:* ${option.label}`);
        }
      }

      return lines.join('\n');
    });

    sections.push(`*${stage.label}*\n${drillLines.join('\n\n')}`);
  }

  return sections.join('\n\n');
}

export function markdownToWhatsApp(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => {
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      if (heading) {
        return `*${convertInlineMarkdown(heading[1] ?? '')}*`;
      }

      const bullet = line.match(/^(\s*)[-+*]\s+(.+)$/);
      if (bullet) {
        return `${bullet[1] ?? ''}- ${convertInlineMarkdown(bullet[2] ?? '')}`;
      }

      const orderedListItem = line.match(/^(\s*)(\d+[.)])\s+(.+)$/);
      if (orderedListItem) {
        return `${orderedListItem[1] ?? ''}${orderedListItem[2]} ${convertInlineMarkdown(
          orderedListItem[3] ?? '',
        )}`;
      }

      return convertInlineMarkdown(line);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function whatsAppToMarkdown(message: string): string {
  return message
    .split(/\r?\n/)
    .map((line) => {
      const stage = line.match(/^\*([^*]+)\*$/);
      if (stage) {
        return `## ${stage[1] ?? ''}`;
      }

      const modification = line.match(/^(\s*)- \*([^*]+:)\* (.+)$/);
      if (modification) {
        return `${modification[1] ?? ''}- **${modification[2] ?? ''}** ${modification[3] ?? ''}`;
      }

      const drill = line.match(/^- \*([^*]+)\*$/);
      if (drill) {
        return `- **${drill[1] ?? ''}**`;
      }

      return line.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '**$1**').replace(/~([^~]+)~/g, '~~$1~~');
    })
    .join('\n');
}

function indentContinuation(text: string): string {
  return text
    .split('\n')
    .map((line) => (line ? `  ${line}` : line))
    .join('\n');
}

function convertInlineMarkdown(text: string): string {
  const boldSegments: string[] = [];
  let converted = text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/~~([^~]+)~~/g, '~$1~')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_match, a: string, b: string) => {
      const marker = `\u0000${boldSegments.length}\u0000`;
      boldSegments.push(`*${a ?? b}*`);
      return marker;
    });

  converted = converted.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '_$1_');
  return converted.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => {
    return boldSegments[Number(index)] ?? '';
  });
}
