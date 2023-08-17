import fs from 'fs';
import path from 'path';
import is_git_url from 'is-git-url';
import fse from 'fs-extra';
import cp from 'child_process';
import { promisify } from 'util';
import { Harbors } from '..';
import { Lanes } from '../../lanes';
import {
  LatestShipment, Shipments,
} from '../../shipments';

H.copySync = fse.copySync;

const not_found = (err) => {
  if (!H.isTest) console.error(err);
  return 404;
};

H.exec = promisify(cp.exec);

const update_harbor = async function (lane, values) {
  try {
    let harbor = Harbors.findOne(lane.type);
    let success = H.harbors[lane.type].update(lane, values);
    if (success) {
      harbor.lanes = harbor.lanes || {};
      harbor.lanes[lane._id] = {
        manifest: values,
      };
      await Harbors.update(harbor._id, harbor);
      lane = await H.call('Harbors#render_work_preview', lane, values);
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
        { shipment: lane.last_shipment }
      );
    }

    if (success) Lanes.update(lane._id, lane);

    return { lane, success };

  }
  catch (err) {
    if (!H.isTest) console.error(err);
    throw err;
  }
};

const render_input = async function (lane, manifest) {
  const new_lane_name = 'New';

  try {
    if (lane.name == new_lane_name || !lane.type) return false;

    lane.rendered_input = H.harbors[lane.type].render_input(manifest, lane);
    lane.rendered_work_preview = await H
      .harbors
    [lane.type]
      .render_work_preview(manifest, lane)
      ;
    Lanes.update(lane._id, {
      $set: {
        rendered_input: lane.rendered_input,
        rendered_work_preview: lane.rendered_work_preview,
      },
    });

    return lane;

  }
  // Have the harbors been loaded successfully?
  // The #render_input method is required.
  catch (err) { return not_found(err); }
};

const render_work_preview = async function (
  lane, manifest
) {
  if (!H.harbors[lane?.type]) return 404;
  try {
    lane.rendered_work_preview = await H
      .harbors[lane.type]
      .render_work_preview(manifest, lane)
      ;
    if (manifest?.shipment_id) {
      if (!H.isTest) console.log(
        `Updating rendered work for shipment: ${manifest.shipment_id}`
      );
      Shipments.update(manifest.shipment_id, {
        $set: {
          rendered_work_preview: lane.rendered_work_preview,
        },
      });
    }
    Lanes.update(lane._id, {
      $set: {
        rendered_work_preview: lane.rendered_work_preview,
      },
    });

    return lane;
  }
  catch (err) { return not_found(err); }
};

const get_constraints = function (name) {
  const key = `constraints.${name}`;
  const constraints = {
    global: [],
    [name]: [],
  };
  constraints[name] = [];
  Harbors.find({
    $or: [
      { 'constraints.global': { $exists: true } },
      { [key]: { $exists: true } },
    ],
  }).forEach((doc) => {
    if (doc.constraints.global)
      constraints.global = constraints.global.concat(doc.constraints.global);
    if (doc.constraints[name])
      constraints[name] = constraints[name].concat(doc.constraints[name]);
  });

  return constraints;
};

const register = function (harbor) {
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
    });
    files.forEach(file => {
      let filepath = path.join(depotpath, file);
      let registeredpath = path.join(H.harbors_dir, file);
      if (!H.isTest) console.log(`Adding harbor "${file}" for registration...`);
      H.copySync(filepath, registeredpath, { overwrite: true });
    });
  }
  else {
    fs.readdirSync(H.harbors_dir).forEach(file => {
      if (file.match(harbor._id)) { files.push(file); }
    });
    files.forEach(file => {
      let filepath = path.join(H.harbors_dir, file);
      if (!H.isTest) console.log(`Removing recursively: ${filepath}`);
      fs.rmSync(filepath, { recursive: true });
    });
  }

  if (files.length > 0) return H.reload();
  return 404;
};

const remove = function (harbor) {
  try {
    let depotpath = path.join(H.depot_dir, harbor._id);
    console.log(`Removing ${depotpath}...`);
    Harbors.remove(harbor);
    fs.rmSync(depotpath, { recursive: true });
    if (!H.isTest) console.log(`Successfully removed harbor: ${harbor._id}`);
    H.update_avail_space();
    return true;
  }
  catch (err) { throw err; }
};

const add_harbor_to_depot = async function (git_url) {
  if (!is_git_url(git_url)) return 400;
  const clone_exec_opts = { cwd: H.depot_dir };
  const git_clone_cmd = `git clone ${git_url}`;
  const harbor_name_regex = /\/([a-zA-Z0-9-_]+)\.git/;
  const harbor_name = git_url.match(harbor_name_regex)[1];
  try {
    const {
      stdout: clone_stdout,
      stderr: clone_stderr,
    } = await H.exec(git_clone_cmd, clone_exec_opts);
    if (!H.isTest) {
      console.log(clone_stdout);
      console.warn(clone_stderr);
    }
    H.scan_depot(harbor_name);
  }
  catch (err) {
    return err;
  }
  return 200;
};

export {
  update_harbor,
  render_input,
  render_work_preview,
  get_constraints,
  register,
  remove,
  add_harbor_to_depot,
};
