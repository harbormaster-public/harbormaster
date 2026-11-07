import H from '../config/namespace';
import { WebApp } from 'meteor/webapp';
import { recover_shipments } from '../../api/lanes/server/methods';
import { retry } from './retry';

const resume_harbor = async (name, harbor) => {
  try {
    await harbor.resume();
  }
  catch (error) {
    console.error(`Unable to resume harbor ${name}:`, error);
    retry(`harbor:${name}`, () => harbor.resume());
  }
};

const resume_harbors = () => Promise.all(Object.entries(H.harbors)
  .filter(([, harbor]) => typeof harbor.resume == 'function')
  .map(([name, harbor]) => resume_harbor(name, harbor)));

const start_shipment_recovery = () => {
  return recover_shipments().catch(error => {
    console.error('Unable to recover shipments:', error);
    retry('shipment scan', () => recover_shipments().then(() => undefined));
  });
};

const start_recovery = () => WebApp.onListening(() => {
  resume_harbors();
  start_shipment_recovery();
});

export { resume_harbors, start_shipment_recovery, start_recovery };
