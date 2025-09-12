export async function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  // No scheduled jobs needed with webhook-based syncing
  // Keeping this function for potential future use
  return;
}