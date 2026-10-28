import { clearConversation, getAgent } from "@/lib/db";

/** Start a fresh chat. The next message freezes the agent's current setup. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/agents/[id]/conversation">) {
  const { id } = await ctx.params;
  if (!(await getAgent(id))) return Response.json({ error: "Agent not found" }, { status: 404 });
  await clearConversation(id);
  return Response.json({ ok: true });
}
