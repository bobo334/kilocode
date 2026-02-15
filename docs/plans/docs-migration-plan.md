# Migration Plan: `apps/kilocode-docs` → `kilo-org/kilo`

## Current State

| Property | Value |
|----------|-------|
| **Location** | `apps/kilocode-docs` in `kilo-org/kilocode` |
| **Framework** | Next.js 16 + Markdoc + Tailwind CSS 4 |
| **Files** | 342 files, ~12 MB |
| **Git history** | 515 commits, 10+ contributors |
| **Workspace deps** | None — fully self-contained, no `workspace:*` references |
| **Current package name** | `kilocode-docs` |
| **Target package name** | `@kilocode/docs` (follows `@kilocode/*` convention in kilo repo) |
| **Target path** | `apps/kilocode-docs` (same directory name) |

## Package Naming Convention in `kilo-org/kilo`

The `kilo` repo uses two scopes:

- **`@kilocode/*`** — the active convention for new packages (`@kilocode/cli`, `@kilocode/sdk`, `@kilocode/plugin`, `@kilocode/kilo-gateway`, etc.)
- **`@opencode-ai/*`** — legacy packages not yet renamed (`@opencode-ai/app`, `@opencode-ai/ui`, etc.)

Following the current convention, the docs package should be renamed to **`@kilocode/docs`**.

## References to Clean Up in Source Repo (`kilocode`)

After migration, these references need to be removed or updated:

| File | Reference | Action |
|------|-----------|--------|
| `package.json` (root) | `docs:dev`, `docs:build` scripts using `--filter kilocode-docs` | Remove scripts |
| `.github/workflows/markdoc-build.yml` | Entire workflow builds the docs app | Remove workflow (move to target repo) |
| `.vscode/tasks.json` | `docs:start` and `docs:build` task entries | Remove tasks |
| `pnpm-workspace.yaml` | `apps/*` glob (implicitly includes docs) | No change needed once directory is deleted |

## Step-by-Step Plan

### Phase 1: Prepare a filtered clone with docs history

Using `git filter-repo` — the modern replacement for `git filter-branch`. It preserves commit authors, timestamps, and messages for all commits touching the docs directory. Paths are remapped so the filtered history already places files at the correct target location.

```bash
# 1. Create a fresh clone specifically for filtering (NEVER filter in-place on your working copy)
git clone git@github.com:kilo-org/kilocode.git kilocode-docs-export
cd kilocode-docs-export

# 2. Use git filter-repo to isolate apps/kilocode-docs
#    --path: keep only commits touching this directory
#    --path-rename: remap to the target path in the kilo repo
git filter-repo \
  --path apps/kilocode-docs/ \
  --path-rename apps/kilocode-docs/:apps/kilocode-docs/
```

After this step, the filtered clone contains **only** the docs files at `apps/kilocode-docs/`, with full commit history (~515 commits) preserved. Commits that didn't touch docs files are excluded.

### Phase 2: Import into `kilo-org/kilo`

```bash
# 1. Clone the target repo
git clone git@github.com:kilo-org/kilo.git
cd kilo

# 2. Add the filtered repo as a remote
git remote add docs-import ../kilocode-docs-export

# 3. Fetch the filtered history
git fetch docs-import

# 4. Merge with --allow-unrelated-histories
git merge docs-import/main --allow-unrelated-histories --no-commit

# 5. Rename the package in package.json from "kilocode-docs" to "@kilocode/docs"
#    (edit apps/kilocode-docs/package.json)

# 6. Commit the merge
git commit -m "feat: import kilocode-docs with full history from kilocode repo"

# 7. Clean up the temporary remote
git remote remove docs-import
```

Files land at `apps/kilocode-docs/` in the kilo repo with full history attached. Running `git log -- apps/kilocode-docs/` will show the complete commit history from the source repo.

### Phase 3: Validate the migration

```bash
# In the target repo, verify:

# 1. File completeness — compare file counts
find apps/kilocode-docs -type f | wc -l  # Should be ~342

# 2. History preservation — check commit count for the docs path
git log --oneline -- apps/kilocode-docs/ | wc -l  # Should be ~515

# 3. Author attribution — verify top contributors match
git log --format="%aN" -- apps/kilocode-docs/ | sort | uniq -c | sort -rn | head -10

# 4. Build verification — install deps and build
pnpm install
pnpm --filter @kilocode/docs build

# 5. Run tests
pnpm --filter @kilocode/docs test
```

### Phase 4: Post-migration cleanup in `kilocode` repo

```bash
# 1. Remove the docs app directory
rm -rf apps/kilocode-docs

# 2. Remove docs-related scripts from root package.json
#    - "docs:dev"
#    - "docs:build"

# 3. Remove .github/workflows/markdoc-build.yml

# 4. Remove docs tasks from .vscode/tasks.json

# 5. Commit the cleanup
git add -A
git commit -m "chore: remove kilocode-docs after migration to kilo repo"
```

### Phase 5: CI/CD and infrastructure updates

- [ ] Move `.github/workflows/markdoc-build.yml` to `kilo-org/kilo` (adapt paths, update filter to `@kilocode/docs`)
- [ ] Update deployment configuration (DNS, hosting platform) to point to new repo's build output
- [ ] Update Algolia DocSearch crawler config if it references the source repo
- [ ] Transfer or duplicate environment variables/secrets to new repo:
  - `POSTHOG_API_KEY` (used in CI workflow)
  - Algolia keys (used at runtime, likely in Vercel/hosting env)
- [ ] Update any external links or documentation that references the source repo for docs contributions

## Risks and Considerations

### History fidelity
- Commits that touched **both** docs and non-docs files will be included but only show the docs-related changes. The commit message and metadata are preserved but the diff will be narrower. This is expected and acceptable.
- The ~515 commits will be **rewritten** with new SHA hashes. This is inherent to any history rewrite operation.

### Merge commits
- `git filter-repo` handles merge commits well, but some merge commits may become empty (if they only merged non-docs changes) and will be pruned automatically.

### Path assumptions in code
- `next.config.js` sets `basePath: "/docs"` — this continues to work regardless of the repo structure.
- No hardcoded paths reference `apps/kilocode-docs` within the app itself.

### Package rename
- The package will be renamed from `kilocode-docs` to `@kilocode/docs`. Any CI scripts, root `package.json` scripts, or turbo pipeline configs in the kilo repo that reference the package by name need to use the new name.

### Bot commits
- `kiloconnect[bot]` has 36 commits. These will be preserved with the bot as author. Ensure the bot's git identity is recognized in the target repo if author attribution matters.

## Prerequisites

- [ ] `git-filter-repo` installed (`pip install git-filter-repo` or via package manager)
- [ ] Write access to `kilo-org/kilo` repository
- [ ] Confirm package name: `@kilocode/docs`
