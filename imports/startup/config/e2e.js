import { Meteor } from 'meteor/meteor';

// E2E mode is opt-in via settings
// (loaded before app code with `meteor --settings`).
// Keeping this out of `startup/config/namespace.js` avoids mixing test concerns
// with production namespace wiring.
//
// e.g. `private/e2e-settings.json`:
// { "public": { "e2e": true } }
globalThis.H = globalThis.H || Meteor;
globalThis.H.isE2E = Boolean(Meteor?.settings?.public?.e2e);

export default globalThis.H.isE2E;


