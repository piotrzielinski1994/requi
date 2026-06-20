# Plan: Variables & environments (Bruno-style)

**Spec:** [spec.md](spec.md)
**Status:** COMPLETE - all 11 ACs verified by a fresh verifier subagent (verdict: SHIP). All
gates green: 451 frontend tests, 5 cargo tests, typecheck clean, lint 0 errors. The two
non-blocking gaps the verifier flagged (loader env-fallback test, `.env`-survives-reconcile
test) were then closed.

## AC traceability (final)

| AC | Proving test |
| -- | ------------ |
| AC-001 | disk-format-environments: round-trips a folder/request `config.environments` through serialize/deserialize |
| AC-002 | environment: `listEnvironmentNames` union/sort/dedup/empty; env-selector: lists union + "No Environment"; environments-context: `should expose the union of environment names` |
| AC-003 | active-environment: `mergeSettings` keeps string / drops non-string / defaults absent; workspace-loader: `should keep the persisted active environment if it exists`; `should fall back to No Environment if the persisted active env is not in the tree` |
| AC-004 | environment: `parseDotenv` KEY=value / `#` / blank / no-`=` / value-with-`=` / trim |
| AC-005 | interpolate: `should not resolve a bare {{KEY}} from processEnv`; build-request-interpolation: `should leave a bare {{KEY}} untouched if it only exists in process.env` |
| AC-006 | resolve-environments: `should let a plain variable win over the same-scope env block`; `should let a nearer scope plain var override a farther scope env block`; `should let a nearer scope env block override a farther scope env block` |
| AC-007 | resolve-environments: no/undefined/unknown env -> env layer empty; environments-context: `should not resolve an env-only variable if no environment is active`; `should change the resolved env baseUrl if the active environment switches` |
| AC-008 | resolve-environments: `should mark an env-sourced variable's provenance with the env name`; `should keep the plain scope name as provenance for a plain variable` |
| AC-009 | build-request-interpolation: body (POST/PUT/PATCH) + bearer + basic + url/header process.env; environments-context: `should interpolate the active env baseUrl into the sent url`; `should interpolate a {{process.env.X}} token into the sent url` |
| AC-010 | interpolate: recursive var->var / 3-level chain; `should leave a mutually-referential token unresolved and not hang`; self-referential |
| AC-011 | interpolate: `should leave an unknown {{missing}} token verbatim`; `{{process.env.MISSING}}` verbatim |

Edge cases: `.env` never reconciled away (reconcile: `should never remove a root .env even when it is absent from next`); loader fallback (above); cycle no-hang (above).

---

## Addendum: in-UI editing of config + `.env` (2026-06-20)

Reverses the "hand-edit on disk only" stance (ADR) - first in-app config WRITE. Same feature.

**Decisions (user):** raw JSON editor per node; explicit Save (disabled on invalid JSON);
`.env` editable via a raw text editor.

**Surface:** a pencil button on each sidebar `TreeRow` opens that node's **Config editor** in
the content area (view-swap, mirroring the existing Settings tab); a sidebar-header **`.env`**
button opens the workspace `.env` editor. One editor handles folders AND requests uniformly
(folders have no pane today, so a request-pane tab wouldn't cover them).

**Editors:** CodeMirror JSON editor (reuse the Darcula theme + `emptyTolerantJsonLinter`)
seeded with `JSON.stringify(node.config, null, 2)`; **Save** parses -> on success writes,
Save disabled while invalid. `.env` editor = plaintext CodeMirror seeded with the raw file
text.

**Persistence:** node config reuses the existing `onTreeChange`/`writeWorkspace` path (the
drag-move writer); `.env` adds `WorkspaceFs.writeEnv(rootPath, content)` (tauri:
`writeTextFile ${root}/.env` - `$HOME/**` cap already granted; in-memory: set `files[".env"]`).

**Reactivity:** provider holds `tree` (already state) + `processEnv` as STATE (seeded from
prop); `saveNodeConfig(id, config)` updates the tree node + persists; `saveEnv(text)` re-parses
-> updates `processEnv` state + persists, so token preview colors/values update live.

### Files (addendum)

| File | Change |
| ---- | ------ |
| `src/lib/workspace/update-config.ts` (new) | pure `updateNodeConfig(tree, id, config)` -> new tree |
| `src/lib/workspace/fs.ts` | add `writeEnv(rootPath, content): Promise<WriteResult>` to the port |
| `src/lib/workspace/tauri-fs.ts`, `in-memory-fs.ts` | implement `writeEnv` |
| `src/components/workspace/config-editor.tsx` (new) | JSON config editor + Save |
| `src/components/workspace/env-editor.tsx` (new) | `.env` plaintext editor + Save |
| `src/components/workspace/workspace-context.tsx` | edit-target state, `openConfigEditor`/`openEnvEditor`/`closeEditor`, `saveNodeConfig`, `saveEnv`, `processEnv`+`envText` as state |
| `src/components/workspace/content.tsx` | render the active editor when an edit target is set |
| `src/components/workspace/tree-row.tsx` | pencil button -> `openConfigEditor(id)` |
| `src/components/workspace/sidebar.tsx` | `.env` button -> `openEnvEditor()` |
| `src/components/workspace/workspace-loader.tsx` | carry `envRaw` in LoadState; wire `envText` + `onEnvChange` -> `fs.writeEnv` |
| README, ADR, learnings | document in-UI editing + the reversal |

### ACs (addendum)

- AC-012: a node's `config` is editable as raw JSON in the content area; Save writes it to the
  node's `*.req.json`/`folder.json` and the change survives reload.
- AC-013: Save is disabled while the edited JSON is invalid (no write of malformed config).
- AC-014: the workspace `.env` is editable as raw text; Save writes `<workspace>/.env`.
- AC-015: after saving `.env`, `{{process.env.X}}` previews/sends reflect the new values
  without reload (processEnv re-parsed into state).
- AC-016: `updateNodeConfig` is pure - replaces only the target node's config, leaves the rest
  of the tree (and ids) intact.

### AC traceability (addendum, final)

Status: COMPLETE - verified by a fresh verifier subagent (SHIP). 501 frontend tests, 5 cargo,
typecheck + lint clean.

| AC | Proving test |
| -- | ------------ |
| AC-012 | config-edit-context: `should update effectiveConfig if a node's config is saved` + `should call onTreeChange if a node's config is saved`; config-editor: `should call saveNodeConfig with the parsed config if Save is clicked on valid JSON`; edit-ui-integration: `should show the config editor in the content area if a row's edit-config control is clicked` |
| AC-013 | config-editor: `should disable Save if the edited JSON is invalid`; `should disable Save if the JSON parses but is not a config object`; `should not call saveNodeConfig if Save is attempted while the JSON is invalid` |
| AC-014 | in-memory-fs-env: `should store the env content...`, `...leave the existing managed files intact...`, `...latest env content if writeEnv is called twice`; edit-ui-integration: `should show the env editor in the content area if the .env control is clicked` |
| AC-015 | config-edit-context: `should update processEnv if the env text is saved`; `should call onEnvChange with the raw text if the env is saved` |
| AC-016 | update-config: replace-only-target (request/folder/nested), keep-ids, keep-children, unknown-id input-equal, no-mutate, new-array |

## 0. Shape of the work

Pure-first, leaning on what already exists. The hard logic is plain functions in
`lib/workspace` + a new `lib/http` interpolation pass; UI/wiring is thin.

1. **Model**: `ConfigScope.environments?: Record<string, Record<string,string>>` - rides the
   existing opaque-`config` serialize/deserialize, so disk round-trip is free (just a type +
   a parse-tolerance check).
2. **Pure resolution**: extend `resolveConfig(tree, requestId, options?)` to fold each scope's
   active-environment block (low) then its plain `variables` (high) into the variable map,
   nearer scope overriding farther; env-sourced values carry an env-named provenance.
3. **Pure helpers** (`lib/workspace/environment.ts`): `listEnvironmentNames(tree)` (union,
   sorted) and `parseDotenv(raw)` (dotenv -> `process.env` map).
4. **Pure interpolation** (`lib/http/interpolate.ts`): recursive `{{name}}`/`{{process.env.X}}`
   substitution with a cycle guard + unknown-token passthrough; `buildHttpRequest` switches to
   it and extends coverage to auth values + body.
5. **`.env` plumbing**: Tauri FS `collect` also captures a root `.env`; loader parses it ->
   `processEnv`, threads it + the active environment into `WorkspaceProvider`.
6. **Settings**: `activeEnvironment?: string` + `saveActiveEnvironment`.
7. **UI**: env selector reads the real name union + active value, writes the selection;
   provider passes the active env into `resolveConfig` and `processEnv` into send.

TDD per AC: RED (fresh test-writer subagent) -> GREEN -> REFACTOR -> VERIFY (fresh verifier).

## 1. Approach & key decisions

- **Environments in `config`, not files** (user directive). `config.environments` is just more
  opaque config - `serialize`/`deserialize` already persist `config` whole, so no disk-format
  version bump and no new loader. The env-name list is *derived* from the tree, never stored.
- **Two-tier merge inside one scope**: when resolving, push the scope's `environments[active]`
  entries first, then its plain `variables` over them (plain wins within a scope, per
  directive); across scopes, child overrides parent (unchanged fold direction).
- **Interpolation is the real fix, and it's pure.** Today `buildHttpRequest` does a single-pass
  `String.replace`. Replace with `interpolate(text, vars, processEnv)` that loops until no
  `{{...}}` remain or nothing changed (cycle/stable guard, `visited` per token), leaves unknown
  tokens verbatim, and treats `process.env.` as a separate namespace. Reused for URL, headers,
  params, auth (bearer token + basic user/pass), and body.
- **`.env` as the lone dedicated file.** Read it through the existing `WorkspaceFs` by widening
  `collect` to also grab a root `.env` into the FileMap; parse with `parseDotenv`. Reconcile's
  removal regex doesn't match `.env`, so tree-writes never touch it (assert with a test).
- **Active env in settings.json** (`activeEnvironment`), mirroring `workspacePath`: merged
  tolerantly, falls back to No Environment when the name isn't in the current tree's union.

## 2. Files

### Create

| File | Purpose |
| ---- | ------- |
| `src/lib/workspace/environment.ts` | `listEnvironmentNames(tree)`, `parseDotenv(raw)`, `ProcessEnv` type |
| `src/lib/http/interpolate.ts` | recursive `interpolate(text, vars, processEnv)` (cycle guard, passthrough) |
| `src/lib/workspace/__tests__/environment.test.ts` | name-union + dotenv-parse units |
| `src/lib/http/__tests__/interpolate.test.ts` | recursion / cycle / process.env / unknown-token units |

### Modify

| File | Change |
| ---- | ------ |
| `src/lib/workspace/model.ts` | `ConfigScope.environments?: Record<string, Record<string,string>>` |
| `src/lib/workspace/resolve.ts` | `resolveConfig(tree, id, options?: { environment?: string })`; fold env block (env provenance) then plain vars per scope |
| `src/lib/workspace/__tests__/resolve.test.ts` | extend: env layer + precedence + provenance (existing tests stay green - new optional arg) |
| `src/lib/http/build-request.ts` | use `interpolate`; cover auth (bearer/basic) + body; accept `processEnv` |
| `src/lib/http/__tests__/build-request.test.ts` | extend: body/auth interpolation + process.env (existing stay green) |
| `src/lib/workspace/tauri-fs.ts` | `collect` also captures a root `.env` into the FileMap |
| `src/lib/workspace/disk-format.ts` | (only if needed) ensure `config.environments` survives parse - likely no change (opaque config) |
| `src/lib/settings/settings.ts` | `activeEnvironment?: string` + tolerant merge |
| `src/lib/settings/settings-context.tsx` | `saveActiveEnvironment` |
| `src/components/workspace/env-selector.tsx` | real names from context + active value + onChange -> save; "No Environment" |
| `src/components/workspace/workspace-context.tsx` | hold `processEnv` + `activeEnvironment` (props); pass env into `resolveConfig`; pass `processEnv` into `sendRequest`/`buildHttpRequest`; expose `environmentNames` + active + setter |
| `src/components/workspace/workspace-loader.tsx` | parse `files[".env"]` -> processEnv; thread processEnv + activeEnvironment + onActiveEnvironmentChange |
| `src/components/workspace/sidebar.tsx` | (no change - already renders `<EnvSelector/>`) |
| `README.md` | environments-in-config, `.env`, `{{process.env.X}}`, precedence, gitignore `.env` |
| `docs/adr.md`, `docs/learnings.md` | decisions + gotchas |

## 3. Execution order (RED->GREEN per AC)

1. **interpolate** (pure) - AC-009/010/011. RED units (recursion, cycle, process.env, unknown), GREEN.
2. **environment helpers** - AC-002 (name union), AC-004/005 (dotenv parse). RED units, GREEN.
3. **resolveConfig env layer** - AC-006/007/008 (precedence + provenance). RED units, GREEN.
4. **build-request** switch to interpolate + auth/body coverage + processEnv - AC-009. RED, GREEN.
5. **settings** `activeEnvironment` merge + save - AC-003. RED, GREEN.
6. **env-selector** real names/active/onChange - AC-002/003. RED component test, GREEN.
7. **context + loader** wire env into resolve + processEnv into send + `.env` read - AC-001/007/009. RED, GREEN.
8. REFACTOR; VERIFY (fresh subagent); README/docs.

## 4. Tests to write (min one per AC + edge cases)

- interpolate: `{{a}}` from vars; `{{process.env.X}}` from processEnv; recursive var->var and
  var->process.env; cycle (`a<->b`, `a->a`) left unresolved + no hang; unknown `{{x}}` verbatim;
  empty/no-token passthrough.
- environment: `listEnvironmentNames` unions across nested folders, sorts, dedups, empty=`[]`;
  `parseDotenv` handles `KEY=value`, `#` comment, blank, no-`=`, value-with-`=`, trims key.
- resolve: env block contributes a var (provenance = env); plain var in same scope overrides
  env block; nearer scope overrides farther; no-active-env -> env layer empty; unknown active
  env name -> empty.
- build-request: body interpolated; bearer token + basic user/pass interpolated; `process.env`
  token resolved; existing url/header/param tests stay green.
- settings: `activeEnvironment` round-trips through merge; non-string dropped; absent default.
- env-selector: lists union + "No Environment"; shows active; selecting calls save; empty union
  -> only "No Environment".

## 5. Risks

- Regressing existing var substitution: `interpolate` must match today's behavior for the
  single-pass cases (unknown verbatim) - existing build-request tests are the net.
- `resolveConfig` signature change: make `options` optional so all current call sites + the
  large resolve.test.ts keep compiling/passing; only the new env path adds behavior.
- `.env` read widening `collect`: must not let `.env` enter the reconcile *remove* set - it
  isn't matched by reconcile's MANAGED_FILE; add an explicit test asserting a tree-write leaves
  `.env` intact.
- Provenance shape for env vars: Effective tab renders `resolved.from.scopeName`; encode the
  env as part of the scope name (`folder (env)`) so no UI change is needed.

## 6. Acceptance verification

Fresh verifier subagent maps each AC-001..011 to a proving test, runs lint + typecheck + full
Vitest + `cargo test` (Rust untouched but must stay green), and adversarially probes the
edge-case list. AC -> test table written back here once green.
