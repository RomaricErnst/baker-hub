# Migration preview — 20 September 2026

Branch: codex/prototype-migration-20260920. This is a review preview, not a completed production acceptance sign-off.

## Preserved reference
Production remains at commit 7a118048886dadb572c426d0643db1dedd4f5b80, deployment dpl_FSS7hWNWHWLWoceZmgHZsrXezYEB. Both original working copies and Git history have verified archives in the parent project backups/migration-20260920 directory. Database and Storage are not part of these code archives. No schema changes made.

## Migrated
244 pictured branded flours, 12 generic types, explicit archived lookup records; 156 approved pizza photos; audited bilingual ingredient/preparation data; ingredient ANY/ALL matching; compact setup progress without the mode label; selection stays visible before Continue; recipe water details are read-only; step browsing and completion are separate.

## Verification
31 engine/persistence/guide tests pass. Two catalogue integrity tests pass. French translation-key parity passes. Vercel preview build validates compiled application. Browser automation timed out; complete responsive visual, account login/save/restore and shared-link checks remain outstanding. Temporary Vercel access links are available, but a non-browser fetch still reached sign-in; do not promise login-free mobile access until checked in a browser.

## Remaining acceptance
Compare every prototype route against migrated screens, particularly share, kitchen setup, ingredient alternatives and full guide copy/visuals. Test real account save/restore, English/French, metric/imperial and mobile layout. Keep main and production domains on baseline until acceptance.
