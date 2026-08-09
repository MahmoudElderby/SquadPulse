import type { FollowUpCycle } from '../contracts/follow-up-cycle.js';

export function renderDeliverySummary(cycle: FollowUpCycle): string {
  const deliveries = cycle.deliveries ?? [];
  const lines: string[] = ['*Delivery summary*'];

  if (deliveries.length === 0) {
    lines.push('No messages were sent in this batch.');
    return lines.join('\n');
  }

  for (const d of deliveries) {
    const statusLabel =
      d.deliveryStatus === 'sent'
        ? 'sent'
        : d.deliveryStatus === 'skipped'
          ? `skipped (${d.failureReason ?? 'unknown'})`
          : `failed (${d.failureReason ?? 'unknown'})`;
    lines.push(`• Proposal ${d.proposalIndex}: ${statusLabel}`);
  }

  const sent = deliveries.filter((d) => d.deliveryStatus === 'sent').length;
  const skipped = deliveries.filter((d) => d.deliveryStatus === 'skipped').length;
  const failed = deliveries.filter((d) => d.deliveryStatus === 'failed').length;

  lines.push('');
  lines.push(`Total: ${sent} sent, ${skipped} skipped, ${failed} failed.`);

  const allIgnored =
    cycle.proposals.length > 0 &&
    cycle.proposals.every((p) => p.status === 'ignored');
  if (allIgnored) {
    lines.push('All proposals were ignored — no DMs sent.');
  }

  return lines.join('\n');
}

export function countDeliveryStats(cycle: FollowUpCycle): {
  messagesSent: number;
  messagesSkipped: number;
  messagesFailed: number;
} {
  const deliveries = cycle.deliveries ?? [];
  return {
    messagesSent: deliveries.filter((d) => d.deliveryStatus === 'sent').length,
    messagesSkipped: deliveries.filter((d) => d.deliveryStatus === 'skipped').length,
    messagesFailed: deliveries.filter((d) => d.deliveryStatus === 'failed').length,
  };
}
