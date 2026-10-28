import { ButtonLink, PageShell } from "@/components/ui";

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-4xl">🔎</p>
        <h1 className="mt-4 text-xl font-semibold text-zinc-900">Nothing here</h1>
        <p className="mt-1 text-sm text-zinc-500">This agent or page doesn&apos;t exist (it may have been deleted).</p>
        <ButtonLink href="/" className="mt-6">
          Back to your agents
        </ButtonLink>
      </div>
    </PageShell>
  );
}
