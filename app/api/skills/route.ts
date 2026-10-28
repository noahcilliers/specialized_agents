import { createSkill } from "@/lib/db";
import { firstIssue, skillInputSchema } from "@/lib/validate";

export async function POST(req: Request) {
  const parsed = skillInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const skill = await createSkill(parsed.data);
  return Response.json({ skill }, { status: 201 });
}
