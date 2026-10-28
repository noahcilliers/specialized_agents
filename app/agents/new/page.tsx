import { Suspense } from "react";
import { connection } from "next/server";
import { listSkills } from "@/lib/db";
import { getAllPluginStatuses } from "@/lib/plugins/runtime";
import { getOllamaStatus } from "@/lib/ollama";
import { TEMPLATES } from "@/lib/templates";
import { AgentForm } from "@/components/agent-form";
import { PageHeader, PageShell, Skeleton } from "@/components/ui";

export default function NewAgentPage() {
  return (
    <PageShell>
      <PageHeader
        title="New agent"
        description="Give it one job, the know-how it needs, and only the plugins that job requires."
      />
      <Suspense fallback={<Skeleton className="h-[640px]" />}>
        <NewAgentForm />
      </Suspense>
    </PageShell>
  );
}

async function NewAgentForm() {
  await connection();
  const [skills, statuses, ollama] = await Promise.all([listSkills(), getAllPluginStatuses(), getOllamaStatus()]);
  return (
    <AgentForm
      mode="create"
      templates={TEMPLATES}
      skills={skills}
      pluginStatuses={statuses}
      ollama={{ running: ollama.running, models: ollama.models, defaultModel: ollama.defaultModel }}
    />
  );
}
