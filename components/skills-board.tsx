"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2, X } from "lucide-react";
import type { Skill, SkillInput } from "@/lib/types";
import { Badge, Button } from "./ui";

type Editing = { mode: "new"; draft: SkillInput } | { mode: "edit"; skill: Skill; draft: SkillInput } | { mode: "view"; skill: Skill };

const EMPTY: SkillInput = { name: "", emoji: "💡", description: "", instructions: "" };

export function SkillsBoard({ skills, usage }: { skills: Skill[]; usage: Record<string, string[]> }) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const custom = skills.filter((s) => !s.builtIn);
  const builtIn = skills.filter((s) => s.builtIn);

  const open = (s: Skill) =>
    setEditing(
      s.builtIn
        ? { mode: "view", skill: s }
        : { mode: "edit", skill: s, draft: { name: s.name, emoji: s.emoji, description: s.description, instructions: s.instructions } },
    );

  return (
    <>
      <div className="mb-6 flex justify-end">
        <Button onClick={() => setEditing({ mode: "new", draft: EMPTY })}>
          <Plus className="h-4 w-4" /> New skill
        </Button>
      </div>

      {custom.length ? (
        <SkillGrid title="Your skills" skills={custom} usage={usage} onOpen={open} />
      ) : (
        <div className="mb-10 rounded-2xl border border-dashed border-zinc-300 px-6 py-8 text-center">
          <p className="font-medium text-zinc-900">No custom skills yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Write a skill once (say, &ldquo;how I like my mornings briefed&rdquo;) and give it to any agent that needs it.
          </p>
        </div>
      )}
      <SkillGrid title="Built-in" skills={builtIn} usage={usage} onOpen={open} />

      {editing ? <SkillDialog editing={editing} usage={usage} onClose={() => setEditing(null)} onDuplicate={(s) =>
        setEditing({
          mode: "new",
          draft: { name: `${s.name} (copy)`, emoji: s.emoji, description: s.description, instructions: s.instructions },
        })
      } /> : null}
    </>
  );
}

function SkillGrid({
  title,
  skills,
  usage,
  onOpen,
}: {
  title: string;
  skills: Skill[];
  usage: Record<string, string[]>;
  onOpen: (s: Skill) => void;
}) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((s) => {
          const users = usage[s.id] ?? [];
          return (
            <button
              key={s.id}
              onClick={() => onOpen(s)}
              className="flex flex-col rounded-2xl border border-zinc-200/80 bg-white p-4 text-left shadow-xs transition-all hover:-translate-y-px hover:shadow-md"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 text-lg ring-1 ring-inset ring-zinc-100">
                  {s.emoji}
                </span>
                <span className="font-medium text-zinc-900">{s.name}</span>
              </span>
              <span className="mt-2.5 line-clamp-2 text-sm text-zinc-500">{s.description || "No description."}</span>
              <span className="mt-3 text-xs text-zinc-400">
                {users.length ? `Used by ${users.join(", ")}` : "Not used by any agent"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SkillDialog({
  editing,
  usage,
  onClose,
  onDuplicate,
}: {
  editing: Editing;
  usage: Record<string, string[]>;
  onClose: () => void;
  onDuplicate: (s: Skill) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<SkillInput>(editing.mode === "view" ? EMPTY : editing.draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(editing.mode === "edit" ? `/api/skills/${editing.skill.id}` : "/api/skills", {
      method: editing.mode === "edit" ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Couldn't save the skill");
    router.refresh();
    onClose();
  }

  async function remove() {
    if (editing.mode !== "edit") return;
    const users = usage[editing.skill.id] ?? [];
    const msg = users.length
      ? `Delete “${editing.skill.name}”? It will be removed from ${users.join(", ")}.`
      : `Delete “${editing.skill.name}”?`;
    if (!confirm(msg)) return;
    await fetch(`/api/skills/${editing.skill.id}`, { method: "DELETE" });
    router.refresh();
    onClose();
  }

  const field =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/30 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <p className="font-semibold text-zinc-900">
            {editing.mode === "new" ? "New skill" : editing.mode === "edit" ? "Edit skill" : editing.skill.name}
          </p>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {editing.mode === "view" ? (
          <div className="overflow-y-auto px-6 py-5">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{editing.skill.emoji}</span>
              <Badge>Built-in</Badge>
            </div>
            <p className="mt-3 text-sm text-zinc-600">{editing.skill.description}</p>
            <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-zinc-400">Instructions added to the agent</p>
            <pre className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 font-mono text-[13px] leading-6 text-zinc-700">
              {editing.skill.instructions}
            </pre>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto px-6 py-5">
            <div className="flex gap-3">
              <label className="block w-20">
                <span className="mb-1.5 block text-sm font-medium text-zinc-800">Icon</span>
                <input
                  className={`${field} h-10 text-center text-lg`}
                  value={draft.emoji}
                  maxLength={8}
                  onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                />
              </label>
              <label className="block flex-1">
                <span className="mb-1.5 block text-sm font-medium text-zinc-800">Name</span>
                <input
                  className={`${field} h-10`}
                  value={draft.name}
                  placeholder="e.g. Morning routine"
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  autoFocus
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-800">Short description</span>
              <input
                className={`${field} h-10`}
                value={draft.description}
                placeholder="What this skill teaches an agent"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-800">Instructions</span>
              <textarea
                className={`${field} min-h-56 resize-y py-3 font-mono text-[13px] leading-6`}
                value={draft.instructions}
                placeholder={"When the user asks …, do …\n- Always …\n- Never …"}
                onChange={(e) => setDraft({ ...draft, instructions: e.target.value })}
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Added to the system prompt of every agent with this skill, under its name.
              </span>
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-zinc-100 px-6 py-4">
          {editing.mode === "edit" ? (
            <Button variant="danger" size="sm" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          ) : null}
          <div className="ml-auto flex gap-2">
            {editing.mode === "view" ? (
              <Button variant="secondary" onClick={() => onDuplicate(editing.skill)}>
                <Copy className="h-4 w-4" /> Duplicate to customize
              </Button>
            ) : (
              <>
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saving || !draft.name.trim() || !draft.instructions.trim()}>
                  {saving ? "Saving…" : editing.mode === "new" ? "Create skill" : "Save"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
