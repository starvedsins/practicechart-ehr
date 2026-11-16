import { sleep } from "workflow";
export async function sendAppointmentEmails() {
  "use workflow";
  let result = await sendPendingEmails();
  for (let attempt = 0; attempt < 6 && result.remaining > 0; attempt++) {
    await sleep(Math.min(60, 2 ** (attempt + 1)) * 60000);
    result = await sendPendingEmails();
  }
  return result;
}
export async function sendPendingEmails() {
  "use step";
  const { queueEmailReminders, deliverQueuedEmails } =
    await import("../lib/notifications");
  await queueEmailReminders();
  return await deliverQueuedEmails();
}
