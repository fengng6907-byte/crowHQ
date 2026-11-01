# Crow HQ

An interactive pixel office and Malaysian neighbourhood for Bobby and Crow Marketing's AI employee characters: JIAYEE, GREENTEA, and MATTHEW.

## What's inside

- Golden, KLCC-inspired twin towers with an office interior and enter/exit controls.
- Mamak Corner, 7-Eleven, Kedai Kopi Pagi, and a shaded pocket park.
- Animated teammate routines, outdoor breaks, and routes back to their desks.
- Malaysian food illustrations and menus, including roti canai, teh tarik, nasi lemak, kopi, and kaya toast.
- Task assignments, a work board, owner approvals, activity log, and scratchpad.
- Day/evening lighting, pause controls, responsive layouts, and an expanded map view.

## Run locally

No build or dependency installation is required. Serve the static files:

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000.

Validate JavaScript syntax with:

```sh
node --check dist/app.js
node --check dist/neighbourhood.js
```

## Vercel deployment

Connect this repository to Vercel and use `main` as the production branch. `vercel.json` selects the `dist` output directory and disables build and install commands. Vercel's Git integration automatically deploys pushes to the connected repository.

The deployment uses the Vercel project's access settings. The original ChatGPT Site's sign-in gate is platform-provided and is not part of these static files.

## Current behaviour

This is a browser-local workspace with simulated employee activity. It does not run AI models, connect to the scheduled ChatGPT report, place food orders, or make purchases. Shops and the KLCC-inspired headquarters form a fictional neighbourhood.

Tasks, notes, decisions, and preferences are stored in browser localStorage. They do not sync between devices or between the ChatGPT Site and a Vercel URL. Clearing browser data removes this local work.

## Structure

| File | Purpose |
| --- | --- |
| `dist/index.html` | Dashboard, dialogs, and navigation |
| `dist/app.js` | Workspace state, office illustration, and character animation |
| `dist/neighbourhood.js` | Malaysian neighbourhood, destinations, food art, and travel |
| `dist/style.css` | Core dashboard styling |
| `dist/neighbourhood.css` | Map controls and destination styling |
| `vercel.json` | Static deployment settings |

The pixel artwork is drawn in canvas with application code. The page also uses Google Fonts with local font fallbacks.
