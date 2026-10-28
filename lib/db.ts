import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  ActivityEntry,
  ActivityKind,
  Agent,
  AgentInput,
  Conversation,
  Database,
  Skill,
  SkillInput,
} from "./types";
import { BUILT_IN_SKILLS } from "./skills";
import { TEMPLATES } from "./templates";

/**
 * A tiny JSON-file database for the MVP. Everything lives in .data/db.json.
 * Writes go through a queue so concurrent requests don't clobber each other.
 */

export const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const MAX_ACTIVITY = 200;

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function seed(): Database {
  const now = new Date();
  const agents: Agent[] = TEMPLATES.map((t, i) => {
    const created = new Date(now.getTime() - (TEMPLATES.length - i) * 60_000).toISOString();
    return { ...t.agent, id: newId("agt"), createdAt: created, updatedAt: created, lastActiveAt: null };
  });
  const activity: ActivityEntry[] = agents.map((a) => ({
    id: newId("act"),
    agentId: a.id,
    at: a.createdAt,
    kind: "created",
    summary: `${a.name} was set up`,
  }));
  return { version: 2, agents, skills: [], conversations: {}, activity: activity.reverse() };
}

/**
 * v1 used the Claude API: agents named Claude models and chats were stored in
 * Claude's message format. v2 runs on local Ollama models.
 */
function migrate(db: Database | (Omit<Database, "version"> & { version: 1 })): Database {
  if (db.version === 2) return db;
  return {
    ...db,
    version: 2,
    agents: db.agents.map((a) => ({
      ...a,
      model: typeof a.model === "string" && !a.model.startsWith("claude-") ? a.model : null,
      think: a.think ?? false,
    })),
    conversations: {},
  };
}

async function readDb(): Promise<Database> {
  let raw: string;
  try {
    raw = await fs.readFile(DB_FILE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    await seedOnce();
    raw = await fs.readFile(DB_FILE, "utf8");
  }
  const db = JSON.parse(raw);
  if (db.version === 2) return db as Database;
  const migrated = migrate(db);
  await writeDb(migrated);
  return migrated;
}

/** Create the database on first run. Safe when several requests race to do it. */
async function seedOnce(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = tmpPath();
  await fs.writeFile(tmp, JSON.stringify(seed(), null, 2), "utf8");
  try {
    await fs.link(tmp, DB_FILE); // atomic, and fails if another request already seeded
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  } finally {
    await fs.rm(tmp, { force: true });
  }
}

function tmpPath(): string {
  return `${DB_FILE}.${randomUUID()}.tmp`;
}

async function writeDb(db: Database): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = tmpPath();
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_FILE);
}

let queue: Promise<unknown> = Promise.resolve();

/** Read-modify-write the database, one change at a time. */
function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const result = await fn(db);
    await writeDb(db);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

async function snapshot(): Promise<Database> {
  // Wait for pending writes so reads see the latest state.
  await queue;
  return readDb();
}

function pushActivity(db: Database, agentId: string, kind: ActivityKind, summary: string, detail?: string) {
  db.activity.unshift({ id: newId("act"), agentId, at: new Date().toISOString(), kind, summary, detail });
  if (db.activity.length > MAX_ACTIVITY) db.activity.length = MAX_ACTIVITY;
}

// ---------- Agents ----------

export async function listAgents(): Promise<Agent[]> {
  return (await snapshot()).agents;
}

export async function getAgent(id: string): Promise<Agent | null> {
  return (await snapshot()).agents.find((a) => a.id === id) ?? null;
}

export function createAgent(input: AgentInput): Promise<Agent> {
  return mutate((db) => {
    const now = new Date().toISOString();
    const agent: Agent = { ...input, id: newId("agt"), createdAt: now, updatedAt: now, lastActiveAt: null };
    db.agents.push(agent);
    pushActivity(db, agent.id, "created", `${agent.name} was created`);
    return agent;
  });
}

export function updateAgent(id: string, patch: Partial<AgentInput>): Promise<Agent | null> {
  return mutate((db) => {
    const agent = db.agents.find((a) => a.id === id);
    if (!agent) return null;
    const statusChanged = patch.status !== undefined && patch.status !== agent.status;
    const configKeys = Object.keys(patch).filter((k) => k !== "status");
    Object.assign(agent, patch, { updatedAt: new Date().toISOString() });
    if (statusChanged) {
      pushActivity(
        db,
        id,
        agent.status === "running" ? "woke" : "slept",
        agent.status === "running" ? `${agent.name} woke up` : `${agent.name} went to sleep`,
      );
    }
    if (configKeys.length > 0) pushActivity(db, id, "updated", `${agent.name}'s setup was updated`);
    return agent;
  });
}

export function deleteAgent(id: string): Promise<boolean> {
  return mutate((db) => {
    const before = db.agents.length;
    db.agents = db.agents.filter((a) => a.id !== id);
    delete db.conversations[id];
    db.activity = db.activity.filter((e) => e.agentId !== id);
    return db.agents.length < before;
  });
}

// ---------- Skills ----------

export async function listSkills(): Promise<Skill[]> {
  return [...BUILT_IN_SKILLS, ...(await snapshot()).skills];
}

export function createSkill(input: SkillInput): Promise<Skill> {
  return mutate((db) => {
    const skill: Skill = { ...input, id: newId("skl"), builtIn: false, createdAt: new Date().toISOString() };
    db.skills.push(skill);
    return skill;
  });
}

export function updateSkill(id: string, patch: Partial<SkillInput>): Promise<Skill | null> {
  return mutate((db) => {
    const skill = db.skills.find((s) => s.id === id);
    if (!skill) return null;
    Object.assign(skill, patch);
    return skill;
  });
}

export function deleteSkill(id: string): Promise<boolean> {
  return mutate((db) => {
    const before = db.skills.length;
    db.skills = db.skills.filter((s) => s.id !== id);
    for (const agent of db.agents) agent.skillIds = agent.skillIds.filter((s) => s !== id);
    return db.skills.length < before;
  });
}

// ---------- Conversations ----------

export async function getConversation(agentId: string): Promise<Conversation | null> {
  return (await snapshot()).conversations[agentId] ?? null;
}

export function saveConversation(agentId: string, conversation: Conversation): Promise<void> {
  return mutate((db) => {
    db.conversations[agentId] = conversation;
  });
}

export function clearConversation(agentId: string): Promise<void> {
  return mutate((db) => {
    delete db.conversations[agentId];
  });
}

/** Record a finished chat turn: activity entry plus the agent's "last active" time. */
export function recordTurn(agentId: string, kind: ActivityKind, summary: string, detail?: string): Promise<void> {
  return mutate((db) => {
    const agent = db.agents.find((a) => a.id === agentId);
    if (!agent) return;
    agent.lastActiveAt = new Date().toISOString();
    pushActivity(db, agentId, kind, summary, detail);
  });
}

// ---------- Activity ----------

export async function listActivity(opts: { agentId?: string; limit?: number } = {}): Promise<ActivityEntry[]> {
  const all = (await snapshot()).activity;
  const filtered = opts.agentId ? all.filter((e) => e.agentId === opts.agentId) : all;
  return filtered.slice(0, opts.limit ?? 50);
}
