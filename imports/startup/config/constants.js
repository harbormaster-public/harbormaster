// Accessible constants

H.AMOUNT_SHOWN = (Meteor.settings.public.AMOUNT_SHOWN || 20);

// Injected by Vite via `define` in `vite.config.mjs`.
// istanbul ignore next
H.VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
console.log(`Loading Harbormaster version ${H.VERSION}`);
