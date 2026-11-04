# Shipment recovery deployment on orphic-lens

This is a coordinated core and Sleep upgrade. Keep MongoDB standalone. Run the
migration with Harbormaster stopped, and install both new artifacts before
restarting it. Do not run a mixture of old and new core processes against this
database during the cutover.

## Changes to persisted data

The collections and existing fields remain in place:

- An active shipment's existing `manifest` now contains its original input. Core
  writes it in the same insert as `actual`, before calling the harbor.
- Optional shipment `dispatch` and `completion` objects describe unfinished
  lifecycle work. Claims renew every 20 seconds and expire after 60 seconds.
  Dispatch metadata and completion instructions are removed when settled;
  `completion.failed` remains as a small accounting receipt.
- Optional lane `shipment_totals` records the offsets needed to preserve its
  existing counters. It is initialized lazily, before the first new shipment or
  completion. Existing history requires no bulk rewrite.
- Partial indexes cover pending work and failed completion receipts. A compound
  lane/start-time/ID index supports latest-history reads. Existing lane indexes
  support source counts. Reconciliation uses indexed counts and monotonic writes;
  its count cost grows with a lane's history, without fetching its manifests.

Previously recorded `sleep_resume` data remains readable and keeps its exact
deadline. New sleeps need no separate settings write. Completion removes old
`sleep_resume` data.

Claims prevent concurrent healthy workers from dispatching the same shipment.
If a process stops renewing its claim after an external effect but before
recording the returned work result, recovery may invoke that harbor again with
the same shipment ID.
External commands and messages need their own idempotency mechanism when that
case matters. Sleep itself is repeatable because every invocation uses the same
saved start time and manifest.

## Verified instance facts

Read-only inspection on 2026-11-04 found:

- Compose: `/var/home/skyler/services/docker-compose.yml`.
- Service/container: `harbormaster`; network: `services_default`.
- Database: `harbormaster` on container `mongo`, running standalone MongoDB 5.
- Harbor bind mount: `/var/home/skyler/strictlyskyler/.harbormaster`, mounted at
  `/root/.harbormaster`. Sleep is `harbors/sleep.js` in that directory.
- Current image ID:
  `e6b1bb3ac558ab9ae4a2d96578ea1c47801d75329ee732a369de82a0dfe97c45`.
- Runtime Node: 22.21.1. The current image retains the core checkout at
  `/opt/harbormaster` and the bundled MongoDB driver under
  `/harbormaster/bundle/programs/server/npm/node_modules/meteor/npm-mongo/node_modules/mongodb`.
- `services-healthcheck.timer` can restart a stopped service; suspend it during
  the maintenance window.
- The preview found three active Sleep lanes: `Wait A Day (Lab Digest)`,
  `Wait Until Between 12pm and 2pm`, and `Wait 5 Minutes (Lab Status)`. None had an
  original manifest or `sleep_resume` snapshot. IDs and deadlines change as the
  loops run; repeat the preview after stopping the instance.

The preview used the checked-in migration planner against the live database and
performed no writes. All three records required estimated settings from their
current lane configuration. Their original upstream manifests are unavailable;
the migration does not fabricate that context. Review the lane settings before
accepting this reconstruction. Overdue work will complete as soon as the upgraded
server recovers it.

## Prepare before the maintenance window

1. Pin the reviewed core and Sleep commits. Build a core image tagged with its
   commit, and retain the previous image locally. Do not depend on `latest` for
   either cutover or rollback. This repository's Dockerfile retains the source
   and migration utility at `/opt/harbormaster`.
2. Test both artifacts against a restored database in an isolated environment.
   Keep production webhooks, startup scripts, and command/email harbors disabled
   there so a restored charter cannot trigger production work.
3. Record the core image ID, Sleep file checksum, Compose file, and current
   restart/healthcheck configuration. Stage the new Sleep file outside the watched
   harbor directory.
4. Capture the existing container's `MONGO_URL` into a mode-0600 temporary env
   file for the migration container. Read it from `podman inspect` programmatically
   and do not print it. Only `MONGO_URL` is needed in that file.

## Stop, back up, and migrate

1. Block new UI/webhook starts and suspend any external producer or automation
   that can recreate the service. Stop the healthcheck timer and its service:

   ```sh
   systemctl --user stop services-healthcheck.timer services-healthcheck.service
   ```

2. Confirm no non-Sleep shipment is still executing, then stop Harbormaster
   gracefully. Keep `mongo` running. Recheck its stopped status before migration.

   ```sh
   podman stop --time 60 harbormaster
   ```

3. Take a consistent `mongodump --archive --gzip` of the `harbormaster` database
   using the Mongo container's existing authentication. Back up the entire harbor
   directory, current Compose configuration, and image metadata. Keep backups and
   the migration env file private. Verify the dump can be restored to an isolated
   database before proceeding.
4. Run the migration preview using the new core image. Substitute the reviewed
   image tag and private env-file path:

   ```sh
   podman run --rm --network services_default \
     --env-file /private/path/migration.env \
     --env MONGO_DRIVER=/harbormaster/bundle/programs/server/npm/node_modules/meteor/npm-mongo/node_modules/mongodb \
     --entrypoint node localhost/harbormaster:CORE_COMMIT \
     /opt/harbormaster/scripts/migrate-sleep.mjs
   ```

   The command only reads the database by default. It validates every active Sleep
   record before producing a write plan. Review every estimated deadline against
   the lane configuration, downtime, and intended next run.
5. Apply the reviewed reconstruction with the same command plus:

   ```text
   --apply --acknowledge-current-settings
   ```

   The migration sets only missing active `manifest` snapshots. It does not change
   `actual`, exit codes, history, saved deadlines, or inactive shipments. Each
   write checks that the shipment is still active and its manifest is unchanged.
   Unexpected skipped records indicate another writer or a stale preview; inspect
   them before restarting.
6. Preview again. It should show no remaining changes. Reapplying is safe, but a
   fresh preview is the verification step; there should be no reason to write
   twice.

## Install and validate

1. With Harbormaster still stopped, install the pinned Sleep file at
   `/var/home/skyler/strictlyskyler/.harbormaster/harbors/sleep.js`. Preserve its
   readable mode and the volume's SELinux labels.
2. Pin the new core image in the `harbormaster` Compose service. Recreate only that
   service, retaining its current environment, network, and mounts. Keep the
   healthcheck timer suspended while validating startup.
3. Inspect logs for registration of all harbors before recovery. Pending work is
   retried every 30 seconds. A claim left by an interrupted new process may need
   up to 60 seconds to expire before the following recovery sweep.
4. Verify the three existing loop lanes resume with their migrated start times
   and produce one logical downstream shipment per completed parent. Check for
   pending `completion.pending` and `dispatch.pending` records and any recovery
   errors. Existing counters should continue from their pre-upgrade values.
5. Use an isolated Sleep test lane with no downstream actions to test a restart
   during a sleep. Confirm its original deadline is retained and it completes
   once. Confirm resetting the test shipment prevents completion.
6. Check `https://harbormaster.skyler.is/`, restore access/producers, and restart
   `services-healthcheck.timer`. Confirm the next healthcheck leaves the pinned
   container intact. Remove the temporary credential file after migration.

## Rollback

Before reopening access, retain the stopped-instance backup and old artifact
pair. If validation fails, block starts and suspend recovery automation again.
Prefer repairing the new version while retaining the durable pending records.

If reverting to old code is necessary, stop the upgraded application first and
inventory any downstream actions already performed. Old code cannot recover the
new pending lifecycle records. Restore the matching database snapshot, old core
image, old Sleep file, and Compose configuration only after deciding how to
handle those actions. Restoring a snapshot cannot undo commands or messages and
can replay an already completed effect. The old Sleep harbor also needs manual
handling for restored active sleeps because it does not recover timers.

Do not run old and new application versions simultaneously against a restored
database. Re-enable the healthcheck timer only after the selected artifact pair
and its database state have been verified.
