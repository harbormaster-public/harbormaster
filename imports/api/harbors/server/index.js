import fs from 'fs';
import path from 'path';
import { copySync } from 'fs-extra';
// import { disk } from 'diskusage';
// import { os } from 'os';
import { Harbors } from '..';
import { Lanes } from '../../lanes';
import { 
  LatestShipment,
} from '../../shipments';

Meteor.publish('Harbors', function () {
  return Harbors.find();
});

const not_found = (err) => {
  console.error(err);
  return 404;
};

Meteor.methods({
  'Harbors#update': async function update_harbor (lane, values) {
    try {
      let harbor = Harbors.findOne(lane.type);
      let success = H.harbors[lane.type].update(lane, values);
      if (success) {
        harbor.lanes = harbor.lanes || {};
        harbor.lanes[lane._id] = {
          manifest: values,
        };
        await Harbors.update(harbor._id, harbor);
        lane = await Meteor.call('Harbors#render_work_preview', lane, values);
        lane.minimum_complete = success;
      }

      if (success && lane.rendered_work_preview && !lane.last_shipment) {
        lane.last_shipment = { 
          actual: 'Never', 
          start: '',
          shipment_count: 0,
          salvage_runs: 0,
        };
        
        LatestShipment.upsert(
          lane._id, 
          {shipment: lane.last_shipment}
        );
      }

      Lanes.update(lane._id, lane);

      return { lane, success };

    }
    catch (err) {
      console.error(err);
      throw err;
    }
  },

  'Harbors#render_input': async function render_input (lane, manifest) {
    const $newLaneName = 'New';
    if (lane.name == $newLaneName || !lane.type) return false;
    
    try {
      lane.rendered_input = H.harbors[lane.type].render_input(manifest, lane);
      lane.rendered_work_preview = await H
        .harbors
        [lane.type]
        .render_work_preview(manifest, lane)
      ;
      Lanes.update(lane._id, {$set:{
        rendered_input: lane.rendered_input,
        rendered_work_preview: lane.rendered_work_preview,
      }});

      return lane;

    }
    // Have the harbors been loaded successfully?
    // The #render_input method is required.
    catch (err) { return not_found(err); }
  },

  'Harbors#render_work_preview': async function render_work_preview (
    lane, manifest
  ) {
    if (! H.harbors[lane.type]) return 404;
    try {
      lane.rendered_work_preview = await H
        .harbors
        [lane.type]
        .render_work_preview(manifest, lane)
      ;
      Lanes.update(lane._id, {$set: {
        rendered_work_preview: lane.rendered_work_preview
      }});

      return lane;
    }
    catch (err) { return not_found(err); }
  },

  'Harbors#get_constraints': (name) => {
    const key = `constraints.${name}`;
    const constraints = {
      global: [],
      [name]: [],
    };
    Harbors.find({ $or: [
      { 'constraints.global': { $exists: true } },
      { [key]: { $exists: true } },
    ] }).forEach((doc) => {
      if (doc.constraints.global)
        constraints.global = constraints.global.concat(doc.constraints.global);
      if (doc.constraints[name])
        constraints[name] = constraints[name].concat(doc.constraints[name]);
    });

    return constraints;
  },

  'Harbors#register': (harbor) => {
    harbor.registered = !harbor.registered;
    Harbors.update(harbor._id, harbor);
    H.should_reload = false;

    if (harbor.registered) {
      let registered_files = [];
      let depotpath = path.join(H.depot_dir, harbor._id);
      fs.readdirSync(depotpath).forEach(file => {
        if (
          (
            file.match(harbor._id) && 
            fs.statSync(path.join(depotpath, file)).isDirectory()
          ) ||
          file.match(`${harbor._id}.js`)
        ) { registered_files.push(file); }
      })
      registered_files.forEach(file => {
        let filepath = path.join(depotpath, file);
        let registeredpath = path.join(H.harbors_dir, file);
        console.log(`Adding harbor "${file}" for registration...`)
        copySync(filepath, registeredpath, { overwrite: true });
      })
    }
    else {
      let deregistered_files = [];
      fs.readdirSync(H.harbors_dir).forEach(file => {
        if (file.match(harbor._id)) { deregistered_files.push(file); }
      });
      deregistered_files.forEach(file =>{
        let filepath = path.join(H.harbors_dir, file);
        console.log(`Removing recursively: ${filepath}`);
        fs.rmSync(filepath, { recursive: true });
      });
    }

    H.should_reload = true;
    return H.reload();
  }
});

