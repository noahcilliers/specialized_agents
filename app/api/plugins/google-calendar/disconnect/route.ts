import { disconnect } from "@/lib/plugins/google-calendar/oauth";

export async function POST() {
  await disconnect();
  return Response.json({ ok: true });
}
