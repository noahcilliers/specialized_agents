import { createAgent, listSkills } from "@/lib/db";
import { agentInputSchema, firstIssue } from "@/lib/validate";
import type { AgentInput } from "@/lib/types";

export async function POST(req: Request) {
  const parsed = agentInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const skills = await listSkills();
  const input = parsed.data as AgentInput;
  input.skillIds = input.skillIds.filter((id) => skills.some((s) => s.id === id));

  const agent = await createAgent(input);
  return Response.json({ agent }, { status: 201 });
}
