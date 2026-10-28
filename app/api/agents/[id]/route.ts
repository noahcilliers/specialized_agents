import { deleteAgent, listSkills, updateAgent } from "@/lib/db";
import { agentPatchSchema, firstIssue } from "@/lib/validate";
import type { AgentInput } from "@/lib/types";

export async function PATCH(req: Request, ctx: RouteContext<"/api/agents/[id]">) {
  const { id } = await ctx.params;
  const parsed = agentPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });

  const patch = parsed.data as Partial<AgentInput>;
  if (patch.skillIds) {
    const skills = await listSkills();
    patch.skillIds = patch.skillIds.filter((sid) => skills.some((s) => s.id === sid));
  }

  const agent = await updateAgent(id, patch);
  if (!agent) return Response.json({ error: "Agent not found" }, { status: 404 });
  return Response.json({ agent });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/agents/[id]">) {
  const { id } = await ctx.params;
  const ok = await deleteAgent(id);
  if (!ok) return Response.json({ error: "Agent not found" }, { status: 404 });
  return Response.json({ ok: true });
}
