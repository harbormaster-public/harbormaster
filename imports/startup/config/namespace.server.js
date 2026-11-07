import { Meteor } from 'meteor/meteor';
import { Email } from 'meteor/email';
import { retry } from '../server/retry';

// Ensure the base namespace exists.
import './namespace';

/* istanbul ignore next */
if (Meteor.isServer) {
  // Server-only: meteor/email is not available as a named export on the client.
  // Attach it to the global namespace for use throughout server code.
  globalThis.H.Email = Email;
  globalThis.H.retry = retry;
}

export default globalThis.H;


