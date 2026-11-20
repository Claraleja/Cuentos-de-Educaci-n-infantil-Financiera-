import type { ordersTable } from "@workspace/db";

export function mapOrder(order: typeof ordersTable.$inferSelect) {
  const { paidAt, printSubmittedAt, downloadedAt, ...rest } = order;
  return {
    ...rest,
    ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
    ...(printSubmittedAt ? { printSubmittedAt: printSubmittedAt.toISOString() } : {}),
    ...(downloadedAt ? { downloadedAt: downloadedAt.toISOString() } : {}),
    createdAt: order.createdAt.toISOString(),
  };
}
