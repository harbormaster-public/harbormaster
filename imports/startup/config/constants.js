// Accessible constants

H.AMOUNT_SHOWN = (Meteor.settings.public.AMOUNT_SHOWN || 20);

H.VERSION = require('/package.json').version;
console.log(`Loading Harbormaster version ${H.VERSION}`);
