# AGENTS.md

## Commands

| Task                        | Command            |
| --------------------------- | --------------------|
| Dev server (LAN, port 5173) | `npm run dev`      |
| Build (typecheck + bundle)  | `npm run build`    |
| Preview production build    | `npm run preview`  |
| Type-check only             | `npx tsc --noEmit` |
| Lint check (Biome)          | `npm run lint`     |
| Format codebase (Biome)     | `npm run format`   |

## Rules
- Do not run `npm run build` or `npm run dev` unless asked.
- Keep behavior parity with the pre-migration (vanilla JS) app when refactoring.
- Mistral model is locked to `mistral-medium-2508`.

## Testing & Validation
- Unit tests: Vitest (`npm run test`). Scope is the pure/business logic only — `persist.ts` (with a `localStorage` stub), `state.ts`, `crypto.ts` (WebCrypto via stubbed `window.crypto`), and `toRows` in `state.ts`. DOM-coupled modules (`game.ts`, `editor.ts`, `main.ts`) are intentionally not unit-tested.
- No browser/E2E tests — validate UI changes manually via `npm run dev` and visual check in browser.

## Structure
- **Standalone Vite single-page app** — entry point: `index.html` + `src/main.ts`.
- Source modules under `src/`: `types.ts`, `state.ts`, `csv.ts`, `editor.ts`, `keyStore.ts`, `crypto.ts`, `mistral.ts`, `game.ts`.
- Material Web and PapaParse are npm dependencies bundled by Vite (no CDN).

## Security
- **BYOK is a deliberate design, not a bug.** The app is a single-user static SPA with no backend: the Mistral key stays in browser-controlled storage (`localStorage` plain, or AES-GCM encrypted with a user passphrase; IndexedDB as fallback) and never leaves the user's machine. Do not "fix" this with session-only storage or a backend proxy unless multi-user collaboration or a changed threat model is explicitly requested. XSS render paths are expected to escape all user data (`escapeHtml` before `innerHTML`) — keep it that way.

## Architecture
- **CSV import**: PapaParse-based preview + full parse into `state.rawRows/headerRow/dataRows`.
- **Editable pre-selection**: after AI generation and CSV import, `src/editor.ts` opens an Excel-like table (edit cells, add/delete rows & cols); **Start game** commits into `state` and calls `startRound()`.
- **Game board**: drag & drop pointer events; cards map to `{rowId, colIndex}`; groups are correct when all slots share one row in the selected column order.
- **BYOK Mistral**: key stored in `localStorage` as `mistral_api_key` (plain) or `mistral_encrypted_key` (PBKDF2 + AES-GCM with user PIN/passphrase).
- **Persistence**: per-set snapshots in `localStorage` under `card-match-set-<id>` with a meta index in `card-match-sets` and last-opened id in `card-match-last-set` (see `src/persist.ts`). The last user-chosen rows-per-round value is kept in `card-match-k-pref` as the default for a new/empty board; per-set `k` lives in the snapshot itself.
