import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { AlertCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { listAgents } from "@/lib/db";
import { getPluginStatus } from "@/lib/plugins/runtime";
import { CALLBACK_PATH } from "@/lib/plugins/google-calendar/oauth";
import { PLUGINS, getPluginInfo } from "@/lib/plugins/catalog";
import { AgentAvatar } from "@/components/agent-avatar";
import { PluginIcon } from "@/components/plugin-icon";
import { DisconnectButton } from "@/components/disconnect-button";
import { Badge, Card, PageHeader, PageShell, Skeleton, buttonClass } from "@/components/ui";

const FLASH: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Google Calendar is connected. Your calendar agents can read your schedule now." },
  cancelled: { ok: false, text: "Connection cancelled. Nothing was changed." },
  invalid_state: { ok: false, text: "That sign-in link expired or didn't match. Please try connecting again." },
  failed: { ok: false, text: "Google sign-in failed. Check the dev server log for details." },
  not_configured: { ok: false, text: "Add your Google OAuth credentials to .env.local first (see the steps below)." },
};

export default function PluginsPage(props: PageProps<"/plugins">) {
  return (
    <PageShell>
      <PageHeader
        title="Plugins"
        description="Plugins let agents act in the outside world. Each agent gets only the plugins its job needs."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Plugins {...props} />
      </Suspense>
    </PageShell>
  );
}

async function Plugins({ searchParams }: PageProps<"/plugins">) {
  await connection();
  const flashKey = (await searchParams).gcal;
  const flash = typeof flashKey === "string" ? FLASH[flashKey] : undefined;
  const [status, agents] = await Promise.all([getPluginStatus("google-calendar"), listAgents()]);
  const gcal = getPluginInfo("google-calendar")!;
  const users = agents.filter((a) => a.pluginIds.includes("google-calendar"));
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  return (
    <>
      {flash ? (
        <div
          className={`mb-6 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            flash.ok ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {flash.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {flash.text}
        </div>
      ) : null}

      <Card className="mb-10 overflow-hidden">
        <div className="flex flex-wrap items-start gap-4 p-6">
          <PluginIcon icon={gcal.icon} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">{gcal.name}</h2>
              <Badge tone="blue">{gcal.access}</Badge>
              {status.connected ? (
                <Badge tone="green">Connected</Badge>
              ) : status.configured ? (
                <Badge tone="amber">Not connected</Badge>
              ) : (
                <Badge tone="amber">Needs setup</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              {status.connected
                ? `Reading calendars for ${status.account ?? "your Google account"}.`
                : "Lets agents look up your calendars and events. They can't create, change or delete anything."}
            </p>
          </div>
          <div className="flex gap-2">
            {status.connected ? (
              <>
                <a href="/api/plugins/google-calendar/connect" className={buttonClass("ghost")}>
                  Reconnect
                </a>
                <DisconnectButton />
              </>
            ) : status.configured ? (
              <a href="/api/plugins/google-calendar/connect" className={buttonClass("primary")}>
                Connect Google Calendar
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid gap-px border-t border-zinc-100 bg-zinc-100 md:grid-cols-2">
          <div className="bg-white p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Tools it gives agents</p>
            <ul className="space-y-2.5">
              {gcal.tools.map((t) => (
                <li key={t.name} className="text-sm">
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-700">{t.name}</code>
                  <span className="mt-0.5 block text-zinc-500">{t.description}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Used by</p>
            {users.length ? (
              <ul className="space-y-2">
                {users.map((a) => (
                  <li key={a.id}>
                    <Link href={`/agents/${a.id}`} className="flex items-center gap-2.5 text-sm text-zinc-800 hover:underline">
                      <AgentAvatar emoji={a.emoji} color={a.color} size="xs" status={a.status} /> {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-400">No agents use this plugin yet.</p>
            )}
          </div>
        </div>

        {!status.configured ? (
          <div className="border-t border-zinc-100 bg-zinc-50/60 p-6">
            <p className="mb-3 font-medium text-zinc-900">One-time setup (about 5 minutes)</p>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-600">
              <li>
                In the{" "}
                <a
                  href="https://console.cloud.google.com/projectcreate"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-zinc-900 underline"
                >
                  Google Cloud console <ExternalLink className="h-3 w-3" />
                </a>
                , create a project (or pick one) and enable the <b>Google Calendar API</b>.
              </li>
              <li>
                Under <b>Google Auth Platform</b>, set up the consent screen: choose <b>External</b>, then add your own Google
                account under <b>Audience → Test users</b>.
              </li>
              <li>
                Under <b>Clients</b>, create an OAuth client of type <b>Web application</b> with this authorized redirect URI:
                <code className="mt-1 block w-fit rounded bg-white px-2 py-1 font-mono text-xs text-zinc-800 ring-1 ring-zinc-200">
                  {appUrl}
                  {CALLBACK_PATH}
                </code>
              </li>
              <li>
                Copy the client ID and secret into <code className="font-mono text-xs">.env.local</code> as{" "}
                <code className="font-mono text-xs">GOOGLE_CLIENT_ID</code> and{" "}
                <code className="font-mono text-xs">GOOGLE_CLIENT_SECRET</code>, then restart the dev server.
              </li>
            </ol>
          </div>
        ) : null}
      </Card>

      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Coming soon</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLUGINS.filter((p) => p.availability === "coming_soon").map((p) => (
          <div key={p.id} className="flex items-start gap-3 rounded-2xl border border-dashed border-zinc-300/80 p-4">
            <PluginIcon icon={p.icon} muted />
            <div>
              <p className="font-medium text-zinc-700">{p.name}</p>
              <p className="mt-0.5 text-sm text-zinc-500">{p.description}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
