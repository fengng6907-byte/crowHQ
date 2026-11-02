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
- Invitation-code entry for guests, with no member database or Supabase dependency.

## Run locally

Install dependencies and start the development server:

```sh
npm ci
npm run dev
```

Open http://localhost:4173. Local QA uses the explicitly labelled demonstration invitation `CROW-DEMO-2026-ONLY`; it is not a production code. The development server applies the same guest routing checks. Without a Blob credential, the employee room also has a separate local QA provider; no live AI model is called by that provider. Production never uses the test code or provider.

Validate JavaScript syntax with:

```sh
npm test
npm run build
```

## Vercel deployment

Connect this repository to Vercel and use `main` as the production branch. `vercel.json` installs dependencies, validates the application, serves `dist` plus the Node APIs, and registers `proxy.js` as framework-independent routing middleware. Vercel's Git integration automatically deploys pushes.

The main site uses the application invitation gate described below. The original ChatGPT Site's sign-in gate is platform-provided and is not part of these files.

### Guest invitation access

Share `https://crow-hq.vercel.app/` with friends. The existing Vercel domain is sufficient; a purchased custom domain is optional. Visitors enter the code that Bobby shares with them. No guest email, password, account, or member record is collected.

Required server-only environment settings:

- `CROW_INVITE_CODE`: a high-entropy founder-managed shared code.
- `CROW_INVITE_SESSION_SECRET`: a cryptographically random signing key of at least 32 characters.

Never place these values in client JavaScript, Git, or query strings. Bobby uses “Founder sign-in” on the main site, completes existing Vercel Authentication, and returns to a remembered founder session on `crow-hq.vercel.app`. The invitation desk at `/founder.html` accepts this verified founder session; guest sessions cannot read its invitation response.

A valid code creates a signed, anonymous, HttpOnly/Secure/SameSite browser cookie with no server-side expiry (browser cookies last up to 400 days and renew on return). Middleware checks that cookie before serving the map or its app assets. Sensitive API routes enforce their own access checks too. Logout clears the cookie. Changing the code or signing key and redeploying invalidates existing guest sessions. A missing or invalid configuration fails closed.

The code is reusable and can be forwarded; it does not establish a person's identity. There is no attendance list, individual account revocation, or one-time-use invitation claim in this database-free version. The in-process failed-code cooldown is supplemental, not a distributed rate limiter. Hosting services may retain their ordinary request logs.

Guests can create a named pixel character, choose a working or break location, and chat with other invited humans. Presence and recent messages use a separate private Blob snapshot; the client polls every five seconds. Guest sessions cannot access employee conversations or paid AI runs.

### Founder room access

Private employee conversations accept the existing Vercel-authenticated deployment host or a verified, signed founder cookie on the main site. Founder sign-in starts on the fixed community origin, sets a ten-minute HttpOnly browser nonce, and redirects to the exact protected deployment hostname from `VERCEL_URL`. Only that protected host can issue a two-minute signed reclaim ticket. The main site's callback verifies its signature, audience, deployment issuer, expiry, and the hash of the original browser nonce before setting a separate founder cookie. A ticket alone cannot be used from another browser. The callback clears the claim nonce and guest session; guest tokens cannot become founder tokens. No additional auth provider, database, invitation secret in URLs, or protection-setting change is needed.

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

## Optional community roadmap

For real shared presence, add a realtime transport and explicit visitor identity. Persistent accounts, personal invitations, or community history would require additional state if wanted later. They are not required for the current invitation-code gate. No Supabase integration is used.

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
| `proxy.js`, `lib/invitation.js` | Map gate, signed guest sessions and founder/guest separation |
| `api/invitation.js` | Code validation, session status, logout and protected invitation retrieval |
| `dist/join.html`, `dist/join.css`, `dist/join.js` | Invitation entrance and pixel illustration |
| `dist/founder.html`, `dist/founder.js` | Protected founder invitation desk |
| `dist/access.js`, `dist/access.css` | Guest-facing controls and founder navigation |
| `tests/invitation.test.mjs` | Entry, tampering, expiry, isolation and logout tests |
| `vercel.json` | Static deployment settings |

The pixel artwork is drawn in canvas with application code. The page also uses Google Fonts with local font fallbacks.

## Human community

Invited guests choose a display name and a generated pixel character. The verified founder automatically reclaims Bobby Ng and his original pixel appearance, using one stable founder identity across browsers and deployments. A signed HttpOnly browser profile is bound to the invitation identity. Display names never confer founder privileges. The shared community room uses its own private Blob object, separate from employee conversations. No Supabase or guest account database is required.

The browser polls every five seconds while visible, sends a heartbeat about every 40 seconds, and polls less often in the background. Presence disappears after three minutes without a heartbeat; closing a tab attempts to leave immediately. Browsers can suspend background tabs, so online presence is best-effort while the tab remains open. The invitation itself has no scheduled server expiry. Cookies are renewed on visits and community activity, with a 400-day browser lifetime; clearing cookies, browser retention rules, explicitly signing out, or invitation/key rotation can require the code again. Existing unexpired three-day sessions migrate to the new format on return.

Messages appear above the sender for 15 seconds and in the room for 15 minutes, capped at 100 messages. Stale entries are excluded on reads and pruned on the next write; an idle private Blob object can physically retain its last snapshot until the next update. This is a small private room, bounded to 40 concurrent people, with conditional writes to preserve simultaneous sends. It uses polling rather than a WebSocket service. Multiple tabs for one identity count as one person. The same browser on different devices has separate anonymous identities.

Human chat never calls an AI model. Guest requests cannot access the private employee workroom. The founder signs in through the existing protected Vercel deployment once per browser, then returns to the main site with a remembered founder session. Founder sessions survive deploys and renew on return. Signing out removes that browser’s cookie; rotating the signing key invalidates founder tokens. The founder desk exposes the AI room, work board, approvals, scratchpad, invitation desk and a shortcut to Bobby on the community map. Guests see the neighbourhood and human chat. A new browser/device still needs the guest code or founder sign-in: there is no cross-device guest account recovery service.

For local visual QA only, the founder-sign-in entry simulates reclaim when `VERCEL !== "1"`, `CROW_LOCAL_QA === "1"`, and the request host is localhost or the preview host. This branch cannot run in production; tests enforce that boundary.
