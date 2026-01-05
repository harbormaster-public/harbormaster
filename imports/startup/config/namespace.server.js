import { Meteor } from 'meteor/meteor';
import { Email } from 'meteor/email';

// Ensure the base namespace exists.
import './namespace';

/* istanbul ignore next */
if (Meteor.isServer) {
  // Server-only: meteor/email is not available as a named export on the client.
  // Attach it to the global namespace for use throughout server code.
  globalThis.H.Email = Email;
}

export default globalThis.H;


