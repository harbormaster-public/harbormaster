import H from '../config/namespace';
import { WebApp } from 'meteor/webapp';
import { recover_shipments } from '../../api/lanes/server/methods';

const retry_delay = 30000;

const resume_harbor = async (name, harbor) => {
  try {
    await harbor.resume();
  }
  catch (error) {
    console.error(`Unable to resume harbor ${name}:`, error);
    H.setTimeout(() => resume_harbor(name, harbor), retry_delay);
  }
};

const resume_harbors = () => Promise.all(Object.entries(H.harbors)
  .filter(([, harbor]) => typeof harbor.resume == 'function')
  .map(([name, harbor]) => resume_harbor(name, harbor)));

const start_shipment_recovery = () => {
  const recover = async () => {
    try {
      await recover_shipments();
    }
    catch (error) {
      console.error('Unable to recover shipments:', error);
    }
    H.setTimeout(recover, retry_delay);
  };
  return recover();
};

const start_recovery = () => WebApp.onListening(() => {
  resume_harbors();
  start_shipment_recovery();
});

export { resume_harbors, start_shipment_recovery, start_recovery };
