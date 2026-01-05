/**
 * Entrypoint for the Meteor *client bundle*.
 *
 * IMPORTANT:
 * - This file is intentionally empty. Meteor must NOT import your Vue app entry
 *   directly, because Meteor cannot execute `.vue` SFC imports.
 *   (Vite owns that.)
 * - The client app is booted by the Vite integration
 *   (jorgenvatle:vite / meteor-vite),
 *   which injects a module script that loads:
 *     `/vite/_vite-bundle/client/_entry.mjs`
 *   and that module, in turn, imports your real client entry:
 *     `client/main.js`
 *
 * Think of this file as the "handoff boundary"
 * where Meteor stops and Vite starts.
 */


