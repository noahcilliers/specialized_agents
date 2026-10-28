# Modular: personal agents, one job each

An MVP of a different take on personal AI agents. Instead of one general agent that does everything, you run a crew of small specialists: one watches your calendar, one keeps the groceries stocked, one watches the cameras. Each agent gets:

- **Instructions**: its system prompt, describing its one job.
- **Skills**: reusable know-how (blocks of instructions) you can give to any agent, e.g. "Daily briefing" or "Conflict spotter".
- **Plugins**: actions in the outside world. The first one is **Google Calendar (read-only)**.
- **A local model**: everything runs on your machine through [Ollama](https://ollama.com). No API keys.
- **A status**: running or sleeping. Sleeping agents keep their setup but don't respond.

## Run it

1. Install [Ollama](https://ollama.com/download) and pull a model that supports tool calling:

   ```bash
   ollama pull qwen3:8b
   ```

2. Start the app:

   ```bash
   npm install
   npm run dev
   ```

Open http://localhost:3000. On first run the app seeds four example agents (Calendar Keeper, Event Planner, Grocery Runner, Home Watch). Agents without a model of their own use the default: `OLLAMA_MODEL` if set, otherwise the best installed model with tool support. Each agent can pick a different local model on its Configure tab. Other settings (Ollama host, context size, keep-alive) are in `.env.example`.

**Speed:** with deep thinking off (the default), qwen3:8b on an M-series Mac answers in a few seconds. Deep thinking ("Think before answering" in an agent's settings) is more careful on tricky requests, but can take a minute or more per reply on a laptop.

### Google Calendar (one-time setup, about 5 minutes)

The calendar plugin talks to Google directly from your machine. It needs an OAuth client:

1. In the [Google Cloud console](https://console.cloud.google.com/projectcreate), create a project and enable the **Google Calendar API**.
2. Under **Google Auth Platform**, configure the consent screen as **External** and add your own Google account under **Audience → Test users**.
3. Under **Clients**, create an OAuth client of type **Web application** with the redirect URI
   `http://localhost:3000/api/plugins/google-calendar/callback`.
4. Put the client ID and secret in `.env.local` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, restart, then click **Connect Google Calendar** on the Plugins page.

While the Google app is in "Testing" mode, Google expires its refresh tokens after 7 days; just click **Reconnect** when that happens.

## How it works

| Piece | Where |
| --- | --- |
| Pages: home dashboard, agent builder, agent chat/configure/activity, skills, plugins | `app/` |
| Ollama connection, installed models and their capabilities | `lib/ollama.ts` |
| Agent runtime: streaming tool-use loop on Ollama's chat API | `lib/agent/runtime.ts` |
| System prompt = instructions + role + skills + plugin notes | `lib/agent/prompt.ts` |
| Plugin interface and registry | `lib/plugins/tool.ts`, `lib/plugins/runtime.ts`, `lib/plugins/catalog.ts` |
| Google Calendar plugin (OAuth + `gcal_list_calendars`, `gcal_list_events`) | `lib/plugins/google-calendar/` |
| Built-in skills and agent templates | `lib/skills.ts`, `lib/templates.ts` |
| Storage: a JSON file plus Google tokens, both git-ignored | `.data/` (`lib/db.ts`) |

A few design decisions:

- **Built for small local models.** Each message carries today's and tomorrow's dates, the calendar tool accepts named ranges like `tomorrow` or `next_week` (small models are weak at date math), tool arguments are validated and coerced before running, and old chat history is trimmed to fit the context window.
- **Edits apply right away.** Each turn uses the agent's current instructions, skills and plugins, so you can tweak an agent mid-conversation.
- **Agents stay in their lane.** Every system prompt includes the agent's one job and tells it to send off-topic requests to a different agent.
- **Adding a plugin** means adding an entry to `lib/plugins/catalog.ts` (what the UI shows) and a `PluginRuntime` with its tools to `lib/plugins/runtime.ts` (what agents can call). Each tool has a JSON schema for the model, a zod schema to validate the input, a `run` function, and a one-line `summarize` for the chat UI.

## Not built yet

- Agents only act when you message them. "Running" doesn't yet mean scheduled or background work (e.g. a 7am briefing).
- Plugins besides Google Calendar are placeholders, and Calendar is read-only.
- Single user, local JSON storage, no auth. Fine for a local MVP, not for deployment.
