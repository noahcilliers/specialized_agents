"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock, Plus, Trash2 } from "lucide-react";
import type { AgentInput, Skill } from "@/lib/types";
import type { AgentTemplate } from "@/lib/templates";
import { BLANK_AGENT } from "@/lib/templates";
import { PLUGINS } from "@/lib/plugins/catalog";
import type { LocalModel } from "@/lib/ollama";
import { formatBytes, modelLabel } from "@/lib/format";
import { AGENT_COLORS, COLOR_KEYS } from "@/lib/colors";
import { AgentAvatar } from "./agent-avatar";
import { EmojiPicker } from "./emoji-picker";
import { PluginIcon } from "./plugin-icon";
import { Badge, Button, Card } from "./ui";

export interface OllamaInfo {
  running: boolean;
  models: LocalModel[];
  defaultModel: string | null;
}

export interface PluginStatusLite {
  configured: boolean;
  connected: boolean;
  account: string | null;
}

type Props = {
  skills: Skill[];
  pluginStatuses: Record<string, PluginStatusLite>;
  ollama: OllamaInfo;
} & ({ mode: "create"; templates: AgentTemplate[] } | { mode: "edit"; agentId: string; initial: AgentInput });

export function AgentForm(props: Props) {
  const router = useRouter();
  const initial = props.mode === "edit" ? props.initial : BLANK_AGENT;
  const [form, setForm] = useState<AgentInput>(initial);
  const [templateId, setTemplateId] = useState<string | null>(props.mode === "create" ? "blank" : null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [baseline, setBaseline] = useState(JSON.stringify(initial));

  const dirty = JSON.stringify(form) !== baseline;
  const set = <K extends keyof AgentInput>(key: K, value: AgentInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSavedAt(null);
  };
  const toggleIn = (key: "skillIds" | "pluginIds", id: string) =>
    set(key, form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id]);

  function applyTemplate(t: AgentTemplate | null) {
    setTemplateId(t?.id ?? "blank");
    setForm(t ? structuredClone(t.agent) : BLANK_AGENT);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      // Status is toggled separately in edit mode, so don't send a possibly stale value.
      const { status, ...config } = form;
      const res = await fetch(props.mode === "create" ? "/api/agents" : `/api/agents/${props.agentId}`, {
        method: props.mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(props.mode === "create" ? { ...config, status } : config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the agent");
      if (props.mode === "create") {
        router.push(`/agents/${data.agent.id}`);
        router.refresh(); // the sidebar lives in the layout, which navigation alone doesn't re-render
      } else {
        setBaseline(JSON.stringify(form));
        setSavedAt(Date.now());
        router.refresh();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (props.mode !== "edit") return;
    if (!confirm(`Delete ${form.name}? Its chat history and activity will be removed too.`)) return;
    const res = await fetch(`/api/agents/${props.agentId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      router.refresh();
    }
  }

  const selectedSkills = useMemo(
    () => props.skills.filter((s) => form.skillIds.includes(s.id)),
    [props.skills, form.skillIds],
  );
  const selectedPlugins = PLUGINS.filter((p) => form.pluginIds.includes(p.id));

  return (
    <form onSubmit={submit} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-6">
        {props.mode === "create" ? (
          <Section title="Start from a template" hint="Each template is a specialist with one job. Tweak anything below.">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              {props.templates.map((t) => (
                <TemplateButton
                  key={t.id}
                  active={templateId === t.id}
                  onClick={() => applyTemplate(t)}
                  emoji={t.agent.emoji}
                  color={t.agent.color}
                  name={t.agent.name}
                />
              ))}
              <TemplateButton
                active={templateId === "blank"}
                onClick={() => applyTemplate(null)}
                emoji="✨"
                color="slate"
                name="From scratch"
              />
            </div>
          </Section>
        ) : null}

        <Section title="Identity">
          <div className="flex flex-col gap-5 sm:flex-row">
            <div className="space-y-3">
              <EmojiPicker value={form.emoji} color={form.color} onChange={(v) => set("emoji", v)} />
              <div className="flex w-16 flex-wrap gap-1.5">
                {COLOR_KEYS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set("color", c)}
                    aria-label={`Color ${c}`}
                    className={`h-4 w-4 rounded-full ${AGENT_COLORS[c].dot} ${
                      form.color === c ? "ring-2 ring-zinc-900 ring-offset-2" : "opacity-70 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <Field label="Name">
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Calendar Keeper"
                  maxLength={60}
                  required
                />
              </Field>
              <Field label="Its one job" hint="Shown on the dashboard, and the agent is told to stay within it.">
                <input
                  className={inputClass}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="e.g. Knows your schedule and spots conflicts."
                  maxLength={240}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Instructions"
          hint="The agent's system prompt: how it should think and behave. Skills and plugin notes are added after it automatically."
        >
          <textarea
            className={`${inputClass} min-h-56 resize-y py-3 font-mono text-[13px] leading-6`}
            value={form.systemPrompt}
            onChange={(e) => set("systemPrompt", e.target.value)}
            placeholder={"You are the user's … agent. Your only job is …\n\nWhen the user asks …, you …"}
          />
          <p className="mt-1.5 text-right text-xs text-zinc-400">{form.systemPrompt.length.toLocaleString()} characters</p>
        </Section>

        <Section
          title="Skills"
          hint="Reusable know-how. Each skill adds a block of instructions to the agent."
          action={
            <Link href="/skills" className="flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-zinc-900">
              <Plus className="h-3.5 w-3.5" /> New skill
            </Link>
          }
        >
          <div className="grid gap-2.5 sm:grid-cols-2">
            {props.skills.map((s) => {
              const on = form.skillIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleIn("skillIds", s.id)}
                  aria-pressed={on}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    on ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60"
                  }`}
                >
                  <span className="text-xl leading-none">{s.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
                      {s.name}
                      {!s.builtIn ? <Badge tone="violet">Custom</Badge> : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-4 text-zinc-500">{s.description}</span>
                  </span>
                  <CheckDot on={on} />
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Plugins" hint="Actions the agent can take in the outside world. Give it only what its job needs.">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {PLUGINS.map((p) => {
              const available = p.availability === "available";
              const on = form.pluginIds.includes(p.id);
              const status = props.pluginStatuses[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!available}
                  onClick={() => toggleIn("pluginIds", p.id)}
                  aria-pressed={on}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed ${
                    on
                      ? "border-zinc-900 bg-zinc-50"
                      : available
                        ? "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60"
                        : "border-dashed border-zinc-200 bg-zinc-50/40"
                  }`}
                >
                  <PluginIcon icon={p.icon} muted={!available} />
                  <span className="min-w-0 flex-1">
                    <span className={`flex flex-wrap items-center gap-1.5 text-sm font-medium ${available ? "text-zinc-900" : "text-zinc-400"}`}>
                      {p.name}
                      {!available ? <Badge>Coming soon</Badge> : null}
                      {available && status?.connected ? <Badge tone="green">Connected</Badge> : null}
                      {available && status && !status.connected ? <Badge tone="amber">Not connected</Badge> : null}
                    </span>
                    <span className={`mt-0.5 block text-xs leading-4 ${available ? "text-zinc-500" : "text-zinc-400"}`}>
                      {p.description}
                      {p.access ? ` ${p.access}.` : ""}
                    </span>
                  </span>
                  {available ? <CheckDot on={on} /> : <Lock className="h-3.5 w-3.5 text-zinc-300" />}
                </button>
              );
            })}
          </div>
          {form.pluginIds.some((id) => props.pluginStatuses[id] && !props.pluginStatuses[id].connected) ? (
            <p className="mt-3 text-sm text-amber-700">
              Google Calendar isn&apos;t connected yet. You can still save; connect it on the{" "}
              <Link href="/plugins" className="font-medium underline">
                Plugins page
              </Link>
              .
            </p>
          ) : null}
        </Section>

        <Section
          title="Model"
          hint="Runs on your computer with Ollama. Small specialists work well on small models."
        >
          <ModelPicker
            ollama={props.ollama}
            value={form.model}
            think={form.think}
            needsTools={form.pluginIds.length > 0}
            onChange={(model) => set("model", model)}
            onThinkChange={(think) => set("think", think)}
          />
        </Section>

        {props.mode === "create" ? (
          <Section title="Status">
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-zinc-900">Start running right away</span>
                <span className="block text-sm text-zinc-500">Sleeping agents keep their setup but don&apos;t respond.</span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-emerald-600"
                checked={form.status === "running"}
                onChange={(e) => set("status", e.target.checked ? "running" : "sleeping")}
              />
            </label>
          </Section>
        ) : null}

        <div className="sticky bottom-0 z-20 -mx-1 flex items-center gap-3 border-t border-zinc-200/80 bg-[var(--background)]/95 px-1 py-4 backdrop-blur">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {savedAt && !dirty ? (
            <p className="flex items-center gap-1 text-sm text-emerald-700">
              <Check className="h-4 w-4" /> Saved. Applies from the next message.
            </p>
          ) : null}
          <div className="ml-auto flex gap-2">
            {props.mode === "create" ? (
              <Button variant="secondary" onClick={() => router.back()}>
                Cancel
              </Button>
            ) : (
              <Button variant="secondary" disabled={!dirty || saving} onClick={() => setForm(JSON.parse(baseline))}>
                Discard
              </Button>
            )}
            <Button type="submit" disabled={saving || !form.name.trim() || (props.mode === "edit" && !dirty)}>
              {saving ? "Saving…" : props.mode === "create" ? "Create agent" : "Save changes"}
            </Button>
          </div>
        </div>

        {props.mode === "edit" ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-red-100 p-5">
            <div>
              <p className="text-sm font-medium text-zinc-900">Delete this agent</p>
              <p className="text-sm text-zinc-500">Removes the agent, its chat history and its activity.</p>
            </div>
            <Button variant="danger" onClick={remove}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </Card>
        ) : null}
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-8">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-zinc-500">Preview</p>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <AgentAvatar emoji={form.emoji} color={form.color} status={form.status} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-900">{form.name || "Untitled agent"}</p>
                <p className="text-xs text-zinc-500">{modelLabel(form.model, props.ollama.defaultModel)}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-zinc-600">{form.description || "Describe this agent's one job."}</p>
            <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500">Skills ({selectedSkills.length})</p>
                <div className="flex flex-wrap gap-1">
                  {selectedSkills.length ? (
                    selectedSkills.map((s) => (
                      <Badge key={s.id}>
                        {s.emoji} {s.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-400">None</span>
                  )}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500">Plugins ({selectedPlugins.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedPlugins.length ? (
                    selectedPlugins.map((p) => (
                      <span key={p.id} className="flex items-center gap-1.5 text-xs text-zinc-700">
                        <PluginIcon icon={p.icon} size="sm" /> {p.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-400">None, so it can only chat</span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </aside>
    </form>
  );
}

const inputClass =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-xs outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 h-10";

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-zinc-900">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-zinc-500">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-zinc-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-zinc-500">{hint}</span> : null}
    </label>
  );
}

function CheckDot({ on }: { on: boolean }) {
  return (
    <span
      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
        on ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"
      }`}
    >
      {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

function TemplateButton({
  active,
  onClick,
  emoji,
  color,
  name,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  color: AgentInput["color"];
  name: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3.5 text-center transition-colors ${
        active ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60"
      }`}
    >
      <AgentAvatar emoji={emoji} color={color} size="sm" />
      <span className="text-[13px] font-medium leading-4 text-zinc-800">{name}</span>
    </button>
  );
}

function ModelPicker({
  ollama,
  value,
  think,
  needsTools,
  onChange,
  onThinkChange,
}: {
  ollama: OllamaInfo;
  value: string | null;
  think: boolean;
  needsTools: boolean;
  onChange: (model: string | null) => void;
  onThinkChange: (think: boolean) => void;
}) {
  const resolvedName = value ?? ollama.defaultModel;
  const resolved = ollama.models.find((m) => m.name === resolvedName);
  const notInstalled = Boolean(value) && ollama.running && !resolved;

  return (
    <div className="space-y-4">
      {!ollama.running ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Ollama isn&apos;t running, so your installed models can&apos;t be listed. Open the Ollama app and reload this
          page, or type a model name below.
        </p>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2">
        <ModelOption
          on={value === null}
          onClick={() => onChange(null)}
          title="Default model"
          subtitle={ollama.defaultModel ? `Currently ${ollama.defaultModel}` : "No models installed yet"}
        />
        {ollama.models.map((m) => (
          <ModelOption
            key={m.name}
            on={value === m.name}
            onClick={() => onChange(m.name)}
            title={m.name}
            subtitle={[m.parameterSize, formatBytes(m.sizeBytes)].filter(Boolean).join(" · ")}
            badges={
              <>
                {m.tools ? <Badge tone="green">Tools</Badge> : <Badge>No tools</Badge>}
                {m.thinking ? <Badge tone="violet">Thinking</Badge> : null}
              </>
            }
          />
        ))}
      </div>

      {!ollama.running || notInstalled ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-800">Model name</span>
          <input
            className={inputClass}
            value={value ?? ""}
            placeholder="e.g. qwen3:8b"
            onChange={(e) => onChange(e.target.value.trim() || null)}
          />
        </label>
      ) : null}

      {notInstalled ? (
        <p className="text-sm text-amber-700">
          {value} isn&apos;t installed. Run <code className="font-mono text-xs">ollama pull {value}</code> first.
        </p>
      ) : null}
      {needsTools && resolved && !resolved.tools ? (
        <p className="text-sm text-amber-700">
          {resolved.name} can&apos;t use tools, so this agent won&apos;t be able to use its plugins. Pick a model marked
          &ldquo;Tools&rdquo;.
        </p>
      ) : null}

      {resolved?.thinking ? (
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-zinc-200 p-3">
          <span>
            <span className="block text-sm font-medium text-zinc-900">Think before answering</span>
            <span className="block text-sm text-zinc-500">
              Smarter on tricky requests, but much slower on a laptop. Expect a minute or more per reply.
            </span>
          </span>
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-violet-600"
            checked={think}
            onChange={(e) => onThinkChange(e.target.checked)}
          />
        </label>
      ) : null}

      <p className="text-xs text-zinc-500">
        Install more with <code className="font-mono">ollama pull &lt;name&gt;</code>. Browse models at{" "}
        <a href="https://ollama.com/search?c=tools" target="_blank" rel="noreferrer" className="underline">
          ollama.com
        </a>
        .
      </p>
    </div>
  );
}

function ModelOption({
  on,
  onClick,
  title,
  subtitle,
  badges,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  badges?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-xl border p-3 text-left transition-colors ${
        on ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
      }`}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-900">
        <span className="truncate font-mono text-[13px]">{title}</span>
        <CheckDot on={on} />
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        {subtitle}
        {badges}
      </span>
    </button>
  );
}
