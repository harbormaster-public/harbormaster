import URL from 'url';
import expandTilde from 'expand-tilde';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

import { Harbors } from '..';
import { Lanes } from '../../lanes';

Meteor.publish('Harbors', function () {
  return Harbors.find();
});

const not_found = (err) => {
  console.error(err);
  return 404;
};

Meteor.methods({
  'Harbors#update': function update_harbor (lane, values) {
    try {
      let harbor = Harbors.findOne(lane.type);
      let success = H.harbors[lane.type].update(lane, values);

      if (success) {
        harbor.lanes = harbor.lanes || {};
        harbor.lanes[lane._id] = {
          manifest: values,
        };
        Harbors.update(harbor._id, harbor);
        lane = Meteor.call('Harbors#render_work_preview', lane, values);
        lane.minimum_complete = success;
      }

      if (success && lane.rendered_work_preview) {
        Lanes.update(lane._id, lane);
      }

      return { lane, success };

    }
    catch (err) {
      console.error(err);
      throw err;
    }
  },

  'Harbors#render_input': function render_input (lane, manifest) {
    try {
      lane.rendered_input = H.harbors[lane.type].render_input(manifest, lane);

      return lane;

    }
    catch (err) { return not_found(err); }
  },

  'Harbors#render_work_preview': function render_work_preview (lane, manifest) {
    if (! H.harbors[lane.type]) return 404;
    try {
      lane.rendered_work_preview = H
        .harbors
        [lane.type]
        .render_work_preview(manifest, lane)
      ;

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

  'Harbors#add': function (repo_url) {
    this.unblock();
    const depot_path = expandTilde('~/.harbormaster/depot');
    const harbors_path = expandTilde('~/.harbormaster/harbors');
    const url = URL.parse(repo_url);
    let repo_name = url.path.split('/');
    repo_name = repo_name[repo_name.length - 1];
    const repo_path = path.normalize(`${depot_path}/${repo_name}`);
    const clone_command = 'git clone';
    const pkg_json = path.normalize(`${repo_path}/package.json`);

    try { fs.statSync(depot_path); }
    catch (e) { fs.mkdirpSync(depot_path); }
    try { fs.statSync(harbors_path); }
    catch (e) { fs.mkdirpSync(harbors_path); }
    try {
      fs.statSync(repo_path);
      fs.removeSync(repo_path);
    }
    catch (e) {}

    execSync(`${clone_command} ${repo_url}`, { cwd: depot_path });

    const pkg = require(pkg_json);
    const harbor_files = [pkg.main];
    if (pkg.components) harbor_files = harbor_files.concat(components);
    harbor_files.forEach((file) => {
      const source_path = path.normalize(`${repo_path}/${file}`);
      const dest_path = path.normalize(`${harbors_path}/${file}`);
      fs.copySync(source_path, dest_path);
    })

    return true;
  },
});

