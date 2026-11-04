import H from '../config/namespace';
import { recover_shipments } from '../../api/lanes/server/methods';

const retry_delay = 30000;

const resume_harbor = async (name, harbor) => {
  try {
    await harbor.resume();
  }
  catch (error) {
    console.error(`Unable to resume harbor ${name}:`, error);
    setTimeout(() => resume_harbor(name, harbor), retry_delay);
  }
};

const resume_harbors = async () => {
  for (const [name, harbor] of Object.entries(H.harbors)) {
    if (typeof harbor.resume == 'function') await resume_harbor(name, harbor);
  }
};

const start_shipment_recovery = () => {
  const recover = async () => {
    try {
      await recover_shipments();
    }
    catch (error) {
      console.error('Unable to recover shipments:', error);
    }
    setTimeout(recover, retry_delay);
  };
  return recover();
};

export { resume_harbors, start_shipment_recovery };
