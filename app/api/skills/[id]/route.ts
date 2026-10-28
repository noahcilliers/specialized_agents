import { deleteSkill, updateSkill } from "@/lib/db";
import { firstIssue, skillPatchSchema } from "@/lib/validate";

export async function PATCH(req: Request, ctx: RouteContext<"/api/skills/[id]">) {
  const { id } = await ctx.params;
  const parsed = skillPatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const skill = await updateSkill(id, parsed.data);
  if (!skill) return Response.json({ error: "Skill not found (built-in skills can't be edited)" }, { status: 404 });
  return Response.json({ skill });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/skills/[id]">) {
  const { id } = await ctx.params;
  const ok = await deleteSkill(id);
  if (!ok) return Response.json({ error: "Skill not found (built-in skills can't be deleted)" }, { status: 404 });
  return Response.json({ ok: true });
}
