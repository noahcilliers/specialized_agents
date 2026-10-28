import { Suspense } from "react";
import { connection } from "next/server";
import { listAgents, listSkills } from "@/lib/db";
import { SkillsBoard } from "@/components/skills-board";
import { PageHeader, PageShell, Skeleton } from "@/components/ui";

export default function SkillsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Skills"
        description="Reusable know-how you can give any agent. Skills are instructions; plugins are actions."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Skills />
      </Suspense>
    </PageShell>
  );
}

async function Skills() {
  await connection();
  const [skills, agents] = await Promise.all([listSkills(), listAgents()]);
  const usage: Record<string, string[]> = {};
  for (const agent of agents) {
    for (const id of agent.skillIds) (usage[id] ??= []).push(agent.name);
  }
  return <SkillsBoard skills={skills} usage={usage} />;
}
