import fs from 'fs';
import child_process from 'child_process';
import { expect } from "chai";
import {
  convert_bytes,
  setup_harbor_dirs,
  register_harbors,
  update_avail_space,
  scan_depot,
} from "./harbors";
import expandTilde from 'expand-tilde';
import mkdirp from 'mkdirp';
import path from 'path';
import Module from 'module';
import { resetDatabase } from 'cleaner';
import { Harbors } from '../../api/harbors';

const module_require = Module.prototype.require;
const harbors_dir = expandTilde('~/.harbormaster/harbors');
const depot_dir = expandTilde('~/.harbormaster/depot');
const upstream_dir = expandTilde('~/.harbormaster/upstream');
const fs_readdir_sync = fs.readdirSync;
const fs_stat_sync = fs.statSync;
const fs_read_file_sync = fs.readFileSync;
const fs_watch = fs.watch;
const exec_sync = child_process.execSync;
let fs_exists_sync = fs.existsSync;
let mkdirp_sync = mkdirp.sync;

describe("Harbors startup", () => {
  describe("#convert_bytes", () => {
    it("returns a human readable size of the bytes", () => {
      expect(convert_bytes(0)).to.eq('n/a');
      expect(convert_bytes(10)).to.eq('10 B');
      expect(convert_bytes(1024)).to.eq('1.00 KB');
      expect(convert_bytes(1048576)).to.eq('1.00 MB');
      expect(convert_bytes(1073741824)).to.eq('1.00 GB');
      expect(convert_bytes(1099511627776)).to.eq('1.00 TB');
    });
  });

  describe("H.check_avail_space", () => {
    it("returns the amount of available space as a string", () => {
      expect(typeof H.check_avail_space()).to.eq('string');
    });
  });

  describe("#update_avail_space", () => {
    it("updates the space recorded as available", () => {
      update_avail_space();
      expect(H.space_avail).to.eq(H.check_avail_space());
    });
  });

  describe("H.reload", () => {
    it("reloads if the flag to do so is true", () => {
      const process_exit = process.exit;
      process.exit = (code) => expect(code).to.eq(10);
      H.reload();
      process.exit = process_exit;
    });
  });

  describe("#setup_harbor_dirs", () => {

    afterEach(() => {
      fs.existsSync = fs_exists_sync;
      fs.watch = fs_watch;
      mkdirp.sync = mkdirp_sync;
    });

    it("creates a new harbors dir if one is not found", () => {
      let called = false;
      fs.existsSync = ($path) => {
        if (called) return called;
        expect($path).to.eq(harbors_dir);
        called = true;
        return called;
      };
      mkdirp.sync = ($path) => expect($path).to.eq(harbors_dir);
      fs.watch = () => { };
      setup_harbor_dirs();
    });
    it("creates a new depot dir if one is not found", () => {
      let first_call = true;
      let second_call = false;
      fs.existsSync = ($path) => {
        if (first_call) {
          first_call = false;
          return true;
        }
        if (second_call) return second_call;
        expect($path).to.eq(depot_dir);
        second_call = true;
        return second_call;
      };
      mkdirp.sync = ($path) => expect($path).to.eq(depot_dir);
      fs.watch = () => { };
      setup_harbor_dirs();
    });
    it("watches the folder, recursively if possible", () => {
      fs.existsSync = () => true;
      fs.watch = ($path, opts) => {
        expect($path).to.eq(harbors_dir);
        expect(opts.recursive).to.eq(true);
      };
      setup_harbor_dirs();
    });
  });

  describe("#scan_depot", () => {

    afterEach(() => {
      fs.readdirSync = fs_readdir_sync;
      fs.statSync = fs_stat_sync;
      child_process.exec_sync = exec_sync;
      resetDatabase(null);
    });

    it("pulls down the latest version of a git repo", () => {
      let called = false;
      let cmd1;
      let cmd2;
      let cwd;
      let depot_path;
      fs.statSync = (path_arg) => {
        depot_path = path_arg;
        return { isDirectory: () => true };
      };
      child_process.execSync = (cmd, opts) => {
        cwd = opts.cwd;
        if (!called) {
          cmd1 = cmd;
          called = true;
        }
        else cmd2 = cmd;
        return '';
      };
      scan_depot('test');
      expect(depot_path).to.eq(path.join(depot_dir, 'test'));
      expect(cwd).to.eq(path.join(depot_dir, 'test'));
      expect(cmd1).to.eq('git rev-parse --short HEAD');
      expect(cmd2).to.eq('git config --get remote.origin.url');
      called = false;
      fs.readdirSync = () => {
        called = true;
        return [];
      };
      scan_depot();
      expect(called).to.eq(true);
    });
    it("logs a warning for non-git repos", () => {
      let called = '';
      const expected_length = 128;
      const console_log = console.log;
      fs.statSync = () => ({ isDirectory: () => true });
      child_process.execSync = () => { throw new Error(); };
      console.log = (warning) => called = warning;
      scan_depot('test');
      expect(called.length).to.eq(expected_length);
      console.log = console_log;
    });
    it("updates the Harbors with the harbor added", () => {
      resetDatabase(null);
      fs.statSync = () => ({ isDirectory: () => true });
      child_process.execSync = () => '';
      scan_depot('test');
      expect(Harbors.findOne('test')._id).to.eq('test');
    });
  });

  describe("#register_harbors", () => {
    beforeEach(() => {
      fs.readdirSync = () => ['test.js'];
      fs.watch = () => { };
      fs.statSync = () => ({
        isDirectory: () => false,
        isFile: () => true,
      });
      child_process.execSync = () => { };
    });

    afterEach(() => {
      fs.readdirSync = fs_readdir_sync;
      fs.statSync = fs_stat_sync;
      fs.readFileSync = fs_read_file_sync;
      fs.watch = fs_watch;
      child_process.exec_sync = exec_sync;
      Module.prototype.require = module_require;
      resetDatabase(null);
    });

    it("returns undefined for a non-match", () => {
      fs.statSync = () => ({
        isDirectory: () => true,
        isFile: () => false,
      });
      fs.readdirSync = () => ['test.foo'];
      expect(register_harbors()).to.eq(undefined);
    });
    it("loads the harbors found in the .harbors dir", () => {
      let expected_folder;
      fs.readdirSync = (folder) => {
        expected_folder = folder;
        return [];
      };
      register_harbors();
      expect(expected_folder).to.eq(harbors_dir);
    });
    it("logs an error if a harbor has no name for registration", () => {
      fs.readFileSync = () => ('module.exports = { register: () => ({}) }');
      const console_error = console.error;
      let called = false;
      console.error = () => called = true;
      register_harbors();
      expect(called).to.eq(true);
      console.error = console_error;
    });
    it("scans for pre-installed dependencies", () => {
      fs.readFileSync = () => (`module.exports = {
        register: () => ({
          pkgs: ['test'],
          name: 'test',
        }),
        render_input: () => {},
      }`);
      let called = false;
      Module.prototype.require = () => called = true;
      register_harbors();
      expect(called).to.eq(true);
    });
    it("installs missing dependencies", () => {
      const expected = `npm i --save -P -E test --no-fund --prefix ${
        upstream_dir
      }`;
      let called;
      fs.readFileSync = () => (`module.exports = {
        register: () => ({
          pkgs: ['test'],
          name: 'test',
        }),
        render_input: () => {},
      }`);
      child_process.execSync = cmd => called = cmd;
      register_harbors();
      expect(called).to.eq(expected);
    });
    it("assigns an entrypoint for the harbor", () => {
      const eval_string = `module.exports = {
        register: () => ({
          pkgs: ['test'],
          name: 'test',
        }),
        render_input: () => {},
      }`;
      fs.readFileSync = () => eval_string;
      register_harbors();
      expect(H.harbors.test.register().name)
        .to
        .eq(eval(eval_string).register().name);
    });
    it("executes followup instructions for the harbor", () => {
      fs.readFileSync = () => (`module.exports = {
        register: () => ({
          pkgs: ['test'],
          name: 'test',
        }),
        render_input: () => {},
        next: () => H.harbors.test.called = true,
      }`);
      register_harbors();
      expect(H.harbors.test.called).to.eq(true);
    });
    it("assigns and executes harbor constraints", () => {
      fs.readFileSync = () => (`module.exports = {
        register: () => ({
          pkgs: ['test'],
          name: 'test',
        }),
        render_input: () => {},
        constraints: () => H.harbors.test.constraints = true,
      }`);
      register_harbors();
      expect(H.harbors.test.constraints).to.eq(true);

    });
    it("registers and updates the harbor", () => {
      fs.readFileSync = () => (`module.exports = {
        register: () => ({
          pkgs: ['test'],
          name: 'test',
        }),
        render_input: () => {},
      }`);
      register_harbors();
      expect(Harbors.findOne('test').registered).to.eq(true);
    });
  });
});
