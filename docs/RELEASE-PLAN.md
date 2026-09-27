# Bakerhub release candidate — 13 September 2026

This branch prepares the real application for review. It is not a deployment approval.

## Preserved baseline

Verified with Vercel's read-only project/deployment tools on 13 September:
- Production deployment: dpl_FSS7hWNWHWLWoceZmgHZsrXezYEB
- Deployment URL: https://baker-ehh5cmbmx-thebaker-hubs-projects.vercel.app
- Source: RomaricErnst/baker-hub, main, commit 7a118048886dadb572c426d0643db1dedd4f5b80
- Public domains: bakerhub.app and www.bakerhub.app
- Framework Next.js; Vercel project runtime Node 24.x.

A source archive of this exact committed baseline is saved outside the release worktree at outputs/release-reference/bakerhub-live-7a118048.tar.gz. SHA256: 1b14fa675008c8419bf5b716d8370840f282e30ad1a18478da4998595a0782ea. It contains source and tracked assets, not database contents, secrets or a database backup. The separate original worktree retains the previously approved uncommitted fixes.

## Recommended release sequence

1. Finish browser verification of this real application, not only the HTML simulation. Use a separate test origin and test account. Keep production data unchanged.
2. Open a pull request from this candidate branch, after final local changes and tests. Do not merge main yet; the current Git integration deploys production from main.
3. Create a protected preview with the intended environment configuration. Validate OAuth callback origins, public share URLs, asset URLs and Supabase permissions on that origin. Preview authentication alone is not a test of production callbacks.
4. Keep an independent reference deployment of the baseline, preferably a separate protected Vercel project with an isolated test Supabase project. Give it a memorable reference URL after approval. Its purpose is reproducible comparison, not writing old code to live user data.
5. Record the candidate commit, deployment ID, settings, test evidence and current rollback ID. Confirm baseline deployment retention and a usable Supabase backup. Do not put secrets in this document.
6. User reviews the acceptance list and gives explicit GO for the identified deployment. Build against the intended production configuration and verify that exact artifact before assigning production domains. Do not promote a staging build that embeds staging public environment values.
7. Immediately test production start/restore/save/share/recipe flows with the authorized test account. Inspect runtime errors. If a material regression appears, propose rollback to the recorded baseline; do not destroy or restore database data automatically.

## What rollback does and does not protect

Vercel can point production domains back to an eligible previous production deployment. Eligibility depends on plan; the immediately previous production deployment is supported on Hobby, with wider eligible history on Pro/Enterprise. It restores a previous build/configuration and does not undo changes in external databases. See https://vercel.com/docs/instant-rollback.

Deployment retention is configurable; do not assume an old URL lives forever. Verify retention rather than relying solely on that URL. See https://vercel.com/docs/deployment-retention.

Supabase database backups do not include Storage objects (only their metadata). Confirm database recovery and photo/file preservation separately. Prefer additive/backward-compatible schema changes so old code can still run after an application rollback. No schema migration is proposed in this release. See https://supabase.com/docs/guides/platform/backups.

Supabase branches provide isolated test environments; check availability/cost and seed with test data rather than copying private production records by default. See https://supabase.com/docs/guides/deployment/branching.

## Required checks before GO

- Correct public Supabase configuration and required service credentials in their proper environments; no secrets in client bundles.
- Production build, TypeScript and applicable regression tests pass on final candidate commit. Local compilation alone does not verify backend configuration.
- Phone browser: Pizza/Bread entry, both modes, required equipment, Back/Restart/Cancel, persistent navigation, no obscured controls.
- Same-day room fermentation, one cold phase, two cold phases, preferment and starter: ingredient masses, actual timelines, warnings and readiness cues agree.
- Small and oversized mixer batches: Ingredients and Steps use the same split and remainder; completing a batch does not skip the remaining batches.
- Room/fridge water choice remains consistent across Ingredients/Steps, excludes preferment/starter water and does not mark the whole plan stale.
- Signed-out draft survives refresh; login restores it; cloud save succeeds and reopened quantities, toppings, shopping checks and progress agree.
- Save failure leaves the current bake intact, including Save then restart; no false saved indicator.
- Public recipe/shopping links work for a separate recipient; no private data is exposed; restore/rebake and exports work.
- English/French and metric/imperial labels/inputs tested at phone widths.
- Updated asset crops inspected; all six pizza styles use correct new style photos. Full topping catalog was not regenerated.
- Legacy progress compatibility reviewed: old global step checkmarks cannot be reliably assigned to a recipe. Original raw state retained for recovery; do not silently infer it belongs to a new bake.
- Baseline reference deployment and rollback target tested. Database and storage protection confirmed.

## Known scope distinctions

The standalone HTML prototype remains a design simulation with a simplified schedule. This release candidate modifies the actual Next.js application and retains its engine and backend integrations. Passing prototype tests is not acceptance evidence for actual cloud saving or sharing.

The shared water helper currently prepares liquid water separately and requires ice to melt first. It must not be advertised as validated direct-ice-in-spiral guidance. The source model's enriched-bread ingredient limitations and mixer heat calibration require explicit scientific review. No claim of the world's best companion is justified by interface work alone; real bake outcomes and repeat-user evidence are needed.
