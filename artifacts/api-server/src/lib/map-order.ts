import type { ordersTable } from "@workspace/db";

export function mapOrder(order: typeof ordersTable.$inferSelect) {
  const { paidAt, printSubmittedAt, ...rest } = order;
  return {
    ...rest,
    ...(paidAt ? { paidAt: paidAt.toISOString() } : {}),
    ...(printSubmittedAt ? { printSubmittedAt: printSubmittedAt.toISOString() } : {}),
    createdAt: order.createdAt.toISOString(),
  };
}
