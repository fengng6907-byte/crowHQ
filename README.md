# Crow HQ

An interactive pixel office and Malaysian neighbourhood for Bobby and Crow Marketing's AI employee characters: JIAYEE, GREENTEA, and MATTHEW.

## What's inside

- Golden, KLCC-inspired twin towers with an office interior and enter/exit controls.
- Mamak Corner, 7-Eleven, Kedai Kopi Pagi, and a shaded pocket park.
- Animated teammate routines, outdoor breaks, and routes back to their desks.
- Malaysian food illustrations and menus, including roti canai, teh tarik, nasi lemak, kopi, and kaya toast.
- Task assignments, a work board, owner approvals, activity log, and scratchpad.
- Private founder group chat with live AI roles, direct @mentions, task runs, and review submissions.
- Day/evening lighting, pause controls, responsive layouts, and an expanded map view.

## Run locally

Install dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Without a Blob credential, development uses an explicitly labelled local QA room with test responses. Production never uses that test provider. The static map also works with a simple file server, but the chat requires the API.

Validate JavaScript syntax with:

```sh
npm test
npm run build
```

## Vercel deployment

Connect this repository to Vercel and use `main` as the production branch. `vercel.json` installs dependencies, validates the application and serves `dist` plus the Node API in `api/team.js`. Vercel's Git integration automatically deploys pushes.

The map uses the Vercel project's access settings. The original ChatGPT Site's sign-in gate is platform-provided and is not part of these files.

### Founder room access

This version deliberately serves private conversation data only on the exact generated deployment hostname supplied by `VERCEL_URL`. That hostname is protected by the project's existing Vercel Authentication. The public production alias receives no messages and no AI execution access; its Team chat tab offers a link to the protected room. Every new deployment has its own protected URL, while conversation data persists in the same private store.

This relies on keeping Vercel Authentication enabled for generated deployments. Project members or anyone granted access to that protected deployment are trusted as founder-room participants in this version. There is no separate application membership system yet. Do not use the founder-room access mechanism as a community invite system.

### Required services

- A private Vercel Blob store connected to this project (`BLOB_READ_WRITE_TOKEN`, server-side only).
- Vercel AI Gateway access via deployment OIDC, or a server-only `AI_GATEWAY_API_KEY` for local development.
- Available AI Gateway credits and any required account verification.
- Optional `AI_GATEWAY_MODEL` to override the default model. Use an exact, available AI Gateway model ID.

AI requests are capped at 40 room runs per Singapore day, with at most one active run. Provider-side billing controls remain separate.

## Current behaviour

The map and rest routines are animated. The protected team room makes live AI calls for questions and draft assignments. A whole-team run calls JIAYEE, then GREENTEA, then MATTHEW; each receives the preceding replies. An @mention can select an individual employee.

Completed task runs post their draft in the room and add it to the founder's review queue. “Completed” means the in-room AI draft has finished. The employees have no external browsing, file editing, deployment or messaging tools in this version, and cannot claim external work is complete. No food purchases are made. The scheduled ChatGPT report remains separate.

Conversation history and job records are stored privately with conditional writes to prevent concurrent overwrites. A run can continue after its initiating tab closes, up to the server's five-minute execution window. Interrupted runs become retryable failures. Earlier successful replies remain visible after a later provider error. Request IDs prevent accidental duplicate runs on network retries.

Private conversation history and task submissions sync through the room. Map preferences, notes, approvals, and ordinary local tasks remain in localStorage. Chat task submissions are copied onto each browser's board, but later manual edits and approval decisions do not yet sync between browsers. Public and protected hostnames have separate localStorage. Clearing browser data removes local work.

Loaded chat history can be exported from the chat header. Load earlier messages first for a longer export. The room blocks new runs at its explicit history limit rather than silently discarding older messages.

## Invite-only community roadmap

For friends joining Crow HQ, add application-level accounts and invitations, membership-checked API routes, private realtime channels for chat and avatar presence, and distinct founder/member permissions. Keep the employee workroom, client briefs, approvals, and paid AI controls founder-only by default. This membership and multiplayer layer is not implemented in the current release.

## Structure

| File | Purpose |
| --- | --- |
| `dist/index.html` | Dashboard, dialogs, and navigation |
| `dist/app.js` | Workspace state, office illustration, and character animation |
| `dist/neighbourhood.js` | Malaysian neighbourhood, destinations, food art, and travel |
| `dist/style.css` | Core dashboard styling |
| `dist/neighbourhood.css` | Map controls and destination styling |
| `dist/chat.js`, `dist/chat.css` | Group chat, run status, private-room entry and task submissions |
| `api/team.js` | Protected room API and live AI calls |
| `lib/team-room.js` | Role briefs, job orchestration, privacy checks and request validation |
| `lib/blob-room.js` | Private storage with optimistic concurrency |
| `tests/team-room.test.mjs` | Access, CSRF, concurrency, task completion and failure tests |
| `vercel.json` | Static deployment settings |

The pixel artwork is drawn in canvas with application code. The page also uses Google Fonts with local font fallbacks.
