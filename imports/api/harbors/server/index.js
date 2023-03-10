import fs from 'fs';
import path from 'path';
import is_git_url from 'is-git-url';
import { copySync } from 'fs-extra';
import cp from 'child_process';
import { promisify } from 'util';
import { Harbors } from '..';
import { Lanes } from '../../lanes';
import { 
  LatestShipment, Shipments,
} from '../../shipments';

const exec = promisify(cp.exec);

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
      if (manifest.shipment_id) {
        console.log(
          `Updating rendered work for shipment: ${manifest.shipment_id}`
        );
        Shipments.update(manifest.shipment_id, {$set: {
          rendered_work_preview: lane.rendered_work_preview
        }});
      }
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
    let files = [];

    if (harbor.registered) {
      let depotpath = path.join(H.depot_dir, harbor._id);
      fs.readdirSync(depotpath).forEach(file => {
        if (
          (
            file.match(harbor._id) && 
            fs.statSync(path.join(depotpath, file)).isDirectory()
          ) ||
          file.match(`${harbor._id}.js`)
        ) { files.push(file); }
      })
      files.forEach(file => {
        let filepath = path.join(depotpath, file);
        let registeredpath = path.join(H.harbors_dir, file);
        console.log(`Adding harbor "${file}" for registration...`)
        copySync(filepath, registeredpath, { overwrite: true });
      });
    }
    else {
      fs.readdirSync(H.harbors_dir).forEach(file => {
        if (file.match(harbor._id)) { files.push(file); }
      });
      files.forEach(file =>{
        let filepath = path.join(H.harbors_dir, file);
        console.log(`Removing recursively: ${filepath}`);
        fs.rmSync(filepath, { recursive: true });
      });
    }

    if (files.length > 0) return H.reload();
    else return 404;
  },

  'Harbors#space_avail': () => {
    return H.space_avail;
  },

  'Harbors#remove': (harbor) => {
    try {
      let depotpath = path.join(H.depot_dir, harbor._id);
      console.log(`Removing ${depotpath}...`);
      Harbors.remove(harbor);
      fs.rmSync(depotpath, { recursive: true });
      console.log(`Successfully removed harbor: ${harbor._id}`);
      H.update_avail_space();
      return true;
    }
    catch (err) { throw err }
  },

  'Harbors#add_harbor_to_depot': async (git_url) => {
    if (! is_git_url(git_url)) return 400;
    const clone_exec_opts = { cwd: H.depot_dir };
    const git_clone_cmd = `git clone ${git_url}`;
    const harbor_name_regex = /\/([a-zA-Z0-9-_]+)\.git/;
    const harbor_name = git_url.match(harbor_name_regex)[1];
    try {
      const { 
        stdout: clone_stdout, 
        stderr: clone_stderr 
      } = await exec(git_clone_cmd, clone_exec_opts);
      console.log(clone_stdout);
      console.warn(clone_stderr);
      H.scan_depot(harbor_name);
    } catch (err) {
      return err;
    }
    return 200;
  }
});

