import fs from "fs";
import child_process from "child_process";
import { expect } from "chai";
import {
  convert_bytes,
  setup_harbor_dirs,
  register_harbors,
  update_avail_space,
  scan_depot,
  ensure_depot_dir,
  ensure_harbors_dir,
  ensure_harbormaster_dir,
  ensure_harbors_upstream_dir,
  ensure_harbors_upstream_packages,
  isModuleNotFoundError,
  isValidPackageName,
  customRequire,
  resolveModulePath,
  initHarborsGlobals,
} from "./harbors";
import expandTilde from "expand-tilde";
import mkdirp from "mkdirp";
import path from "path";
import Module from "module";
import { resetDatabase } from "../../test-helpers/reset-database";
import { Harbors } from "../../api/harbors";
import {
  setupInMemoryCollection,
} from "../../test-helpers/setup-collection-stubs";

const module_require = Module.prototype.require;
const harbors_dir = expandTilde("~/.harbormaster/harbors");
const depot_dir = expandTilde("~/.harbormaster/depot");
const harbormaster_dir = expandTilde("~/.harbormaster");
const harbors_upstream_dir = path.join(harbormaster_dir, "node_modules");
const harbors_upstream_packages = path.join(
  harbormaster_dir,
  "package.json",
);
const fs_readdir = fs.readdir;
const fs_stat_sync = fs.statSync;
const fs_read_file = fs.readFile;
const fs_watch = fs.watch;
const fs_write_file_sync = fs.writeFileSync;
const exec_sync = child_process.execSync;
const exec_async = child_process.exec;
const fs_exists_sync = fs.existsSync;
const mkdirp_sync = mkdirp.sync;

describe("Harbors startup", () => {
  describe("#initHarborsGlobals", () => {
    it("sets expected H globals", () => {
      const originalHarborsDir = H.harbors_dir;
      const originalDepotDir = H.depot_dir;
      const originalShouldReload = H.should_reload;
      try {
        H.harbors_dir = undefined;
        H.depot_dir = undefined;
        H.should_reload = undefined;

        initHarborsGlobals();

        expect(H.harbors_dir).to.eq(harbors_dir);
        expect(H.depot_dir).to.eq(depot_dir);
        expect(H.should_reload).to.eq(true);
      }
      finally {
        H.harbors_dir = originalHarborsDir;
        H.depot_dir = originalDepotDir;
        H.should_reload = originalShouldReload;
      }
    });
  });

  describe("#isValidPackageName", () => {
    it("accepts valid unscoped names", () => {
      expect(isValidPackageName("lodash")).to.eq(true);
      expect(isValidPackageName("hm-pkg")).to.eq(true);
      expect(isValidPackageName("hm.pkg")).to.eq(true);
      expect(isValidPackageName("hm_pkg")).to.eq(true);
    });

    it("rejects invalid unscoped names", () => {
      expect(isValidPackageName("")).to.eq(false);
      expect(isValidPackageName("_bad")).to.eq(false);
      expect(isValidPackageName(".bad")).to.eq(false);
      expect(isValidPackageName("BadCaps")).to.eq(false);
    });

    it("handles scoped names", () => {
      expect(isValidPackageName("@scope/pkg")).to.eq(true);
      expect(isValidPackageName("@scope/")).to.eq(false);
      expect(isValidPackageName("@scope/pkg/extra")).to.eq(false);
      expect(isValidPackageName("@_scope/pkg")).to.eq(false);
      expect(isValidPackageName("@scope/_pkg")).to.eq(false);
    });
  });

  describe("#convert_bytes", () => {
    it("returns a human readable size of the bytes", () => {
      expect(convert_bytes(0)).to.eq("n/a");
      expect(convert_bytes(10)).to.eq("10 B");
      expect(convert_bytes(1024)).to.eq("1.00 KB");
      expect(convert_bytes(1048576)).to.eq("1.00 MB");
      expect(convert_bytes(1073741824)).to.eq("1.00 GB");
      expect(convert_bytes(1099511627776)).to.eq("1.00 TB");
    });
  });

  describe("H.check_avail_space", () => {
    it("returns the amount of available space as a string", () => {
      expect(typeof H.check_avail_space()).to.eq("string");
    });
  });

  describe("#update_avail_space", () => {
    it("updates the space recorded as available", () => {
      update_avail_space();
      expect(H.space_avail).to.eq(H.check_avail_space());
    });

    it("logs available space when not in test mode", () => {
      const originalIsTest = H.isTest;
      const originalConsoleLog = console.log;
      let logged = "";
      try {
        H.isTest = false;
        console.log = (msg) => { logged = String(msg); };
        update_avail_space();
        expect(logged).to.include("available.");
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalConsoleLog;
      }
    });
  });

  describe("H.reload", () => {
    it("reloads if the flag to do so is true", () => {
      const originalIsTest = H.isTest;
      const originalShouldReload = H.should_reload;
      const originalExit = process.exit;
      const originalArgv = process.argv;
      const originalSpawn = child_process.spawn;

      let exitHandler;
      try {
        // Ensure we don't accidentally spawn a real detached process when the
        // mocha/meteor process exits at the end of the suite.
        H.isTest = false;
        H.should_reload = true;
        process.argv = ["node", "server.js"];

        child_process.spawn = () => { };
        const existingExitHandlers = new Set(process.listeners("exit"));
        process.exit = (code) => expect(code).to.eq(10);

        H.reload();

        const newExitHandlers = process.listeners("exit")
          .filter((h) => !existingExitHandlers.has(h));
        exitHandler = newExitHandlers[newExitHandlers.length - 1];
        expect(exitHandler).to.be.a("function");
      }
      finally {
        if (exitHandler) process.removeListener("exit", exitHandler);
        H.isTest = originalIsTest;
        H.should_reload = originalShouldReload;
        process.exit = originalExit;
        process.argv = originalArgv;
        child_process.spawn = originalSpawn;
      }
    });

    it("does nothing if the flag to do so is false", () => {
      const originalShouldReload = H.should_reload;
      const process_exit = process.exit;
      let exited = false;
      try {
        H.should_reload = false;
        process.exit = () => { exited = true; };
        H.reload();
        expect(exited).to.eq(false);
      }
      finally {
        H.should_reload = originalShouldReload;
        process.exit = process_exit;
      }
    });

    // eslint-disable-next-line max-len
    it("spawns a detached process via exit handler when not in test mode", () => {
      const originalIsTest = H.isTest;
      const originalShouldReload = H.should_reload;
      const originalConsoleLog = console.log;
      const originalSpawn = child_process.spawn;
      const originalExit = process.exit;
      const originalArgv = process.argv;

      let spawnArgs;
      let exitCode;
      let logLines = [];
      try {
        H.isTest = false;
        H.should_reload = true;
        process.argv = ["node", "server.js", "--flag"];

        const existingExitHandlers = new Set(process.listeners("exit"));
        console.log = (msg) => { logLines.push(String(msg)); };
        child_process.spawn = (...args) => { spawnArgs = args; };
        process.exit = (code) => { exitCode = code; };

        H.reload();

        const newExitHandlers = process.listeners("exit")
          .filter((h) => !existingExitHandlers.has(h));
        const exitHandler = newExitHandlers[newExitHandlers.length - 1];

        expect(exitCode).to.eq(10);
        expect(exitHandler).to.be.a("function");
        expect(logLines.join("\n")).to.include(
          "*** HARBORS CHANGED, EXITING. ***",
        );

        // Simulate process exiting so the handler runs and spawns.
        exitHandler();
        expect(spawnArgs).to.be.an("array");
        expect(spawnArgs[0]).to.eq("node");
        expect(spawnArgs[1]).to.deep.eq(["server.js", "--flag"]);
        expect(spawnArgs[2]).to.include({
          detached: true,
          stdio: "inherit",
        });
        expect(spawnArgs[2].cwd).to.eq(process.cwd());

        // Cleanup: prevent handler accumulation across tests.
        process.removeListener("exit", exitHandler);
      }
      finally {
        H.isTest = originalIsTest;
        H.should_reload = originalShouldReload;
        console.log = originalConsoleLog;
        child_process.spawn = originalSpawn;
        process.exit = originalExit;
        process.argv = originalArgv;
      }
    });
  });

  describe("ensure_depot_dir and ensure_harbors_dir", () => {
    afterEach(() => {
      fs.existsSync = fs_exists_sync;
      mkdirp.sync = mkdirp_sync;
    });

    it("creates depot dir when missing", () => {
      let called;
      fs.existsSync = (p) => (p === depot_dir ? false : true);
      mkdirp.sync = (p) => { called = p; };
      ensure_depot_dir();
      expect(called).to.eq(depot_dir);
    });

    it("creates harbors dir when missing", () => {
      let called;
      fs.existsSync = (p) => (p === harbors_dir ? false : true);
      mkdirp.sync = (p) => { called = p; };
      ensure_harbors_dir();
      expect(called).to.eq(harbors_dir);
    });
  });

  describe("harbormaster directory initialization", () => {
    afterEach(() => {
      fs.existsSync = fs_exists_sync;
      mkdirp.sync = mkdirp_sync;
      fs.writeFileSync = fs_write_file_sync;
    });

    it("creates harbormaster dir when missing", () => {
      let called;
      fs.existsSync = (p) => (p === harbormaster_dir ? false : true);
      mkdirp.sync = (p) => { called = p; };
      ensure_harbormaster_dir();
      expect(called).to.eq(harbormaster_dir);
    });

    it("creates harbors_upstream_dir when missing", () => {
      let called;
      fs.existsSync = (p) => (p === harbors_upstream_dir ? false : true);
      mkdirp.sync = (p) => { called = p; };
      ensure_harbors_upstream_dir();
      expect(called).to.eq(harbors_upstream_dir);
    });

    it("creates package.json when missing", () => {
      let writeFileCalled = false;
      let writeFilePath;
      let writeFileContent;
      fs.existsSync = (p) =>
        (p === harbors_upstream_packages ? false : true);
      fs.writeFileSync = (filePath, content) => {
        writeFileCalled = true;
        writeFilePath = filePath;
        writeFileContent = content;
      };
      ensure_harbors_upstream_packages();
      expect(writeFileCalled).to.eq(true);
      expect(writeFilePath).to.eq(harbors_upstream_packages);
      expect(JSON.parse(writeFileContent).name)
        .to.eq("harbormaster-upstream");
    });
  });

  describe("#setup_harbor_dirs", () => {
    afterEach(() => {
      fs.existsSync = fs_exists_sync;
      fs.watch = fs_watch;
      mkdirp.sync = mkdirp_sync;
    });

    // Directory creation behavior is covered by ensure_* tests above
    it("watches the folder, recursively if possible", () => {
      fs.existsSync = () => true;
      fs.watch = ($path, opts) => {
        expect($path).to.eq(harbors_dir);
        expect(opts.recursive).to.eq(true);
      };
      setup_harbor_dirs();
    });

    it("creates missing directories and logs when not in test mode", () => {
      const originalIsTest = H.isTest;
      const originalConsoleLog = console.log;
      const created = [];
      const logs = [];
      try {
        H.isTest = false;
        console.log = (msg) => { logs.push(String(msg)); };
        fs.existsSync = (p) => {
          if (p === harbors_dir) return false;
          if (p === depot_dir) return false;
          return true;
        };
        mkdirp.sync = (p) => { created.push(p); };
        fs.watch = () => { };

        setup_harbor_dirs();

        expect(created).to.include(harbors_dir);
        expect(created).to.include(depot_dir);
        expect(logs.join("\n")).to.include("No harbors directory found");
        expect(logs.join("\n")).to.include("Harbors directory created.");
        expect(logs.join("\n")).to.include("No depot directory found");
        expect(logs.join("\n")).to.include("Depot directory created.");
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalConsoleLog;
      }
    });

    // eslint-disable-next-line max-len
    it("falls back to non-recursive watch when recursive fs.watch throws", () => {
      const originalIsTest = H.isTest;
      const originalConsoleLog = console.log;
      let nonRecursiveCalled = false;
      const logs = [];
      try {
        H.isTest = false;
        console.log = (msg) => { logs.push(String(msg)); };
        fs.existsSync = () => true;
        fs.watch = ($path, opts) => {
          if (opts.recursive) throw new Error("no recursive watch");
          expect($path).to.eq(harbors_dir);
          expect(opts.recursive).to.eq(false);
          nonRecursiveCalled = true;
        };
        setup_harbor_dirs();
        expect(nonRecursiveCalled).to.eq(true);
        expect(logs.join("\n")).to.include("*non*-recursively");
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalConsoleLog;
      }
    });
  });

  describe("#scan_depot", () => {
    let harborsStub;
    const fs_readdir_sync = fs.readdirSync;

    beforeEach(async () => {
      await resetDatabase();
      harborsStub = setupInMemoryCollection(Harbors);
    });

    afterEach(async () => {
      fs.readdir = fs_readdir;
      fs.readdirSync = fs_readdir_sync;
      fs.statSync = fs_stat_sync;
      child_process.execSync = exec_sync;
      child_process.exec = exec_async;
      await resetDatabase();
      if (harborsStub) harborsStub.restore();
    });

    it("pulls down the latest version of a git repo", async () => {
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
        else {
          cmd2 = cmd;
        }
        return "";
      };
      await scan_depot("test");
      expect(depot_path).to.eq(path.join(depot_dir, "test"));
      expect(cwd).to.eq(path.join(depot_dir, "test"));
      expect(cmd1).to.eq("git rev-parse --short HEAD");
      expect(cmd2).to.eq("git config --get remote.origin.url");
      // ensure it can enumerate without error (no assert on readdir path)
      fs.readdir = (dir, cb) => cb(null, []);
      await scan_depot();
    });

    it("logs a warning for non-git repos", async () => {
      let called = "";
      const expected = 'Unable to determine origin for "test"';
      const console_log = console.log;
      fs.statSync = () => ({ isDirectory: () => true });
      child_process.execSync = () => { throw new Error(); };
      console.log = (warning) => { called = warning; };
      await scan_depot("test");
      expect(called.match(expected)[0]).to.eq(expected);
      console.log = console_log;
    });

    it("updates the Harbors with the harbor added", async () => {
      await resetDatabase();
      fs.statSync = () => ({ isDirectory: () => true });
      child_process.execSync = () => "";
      await scan_depot("test");
      expect((await Harbors.findOneAsync("test"))._id).to.eq("test");
    });

    it(
      "logs when adding a new harbor or enumerating the depot in non-test mode",
      async () => {
        const originalIsTest = H.isTest;
        const originalConsoleLog = console.log;
        const logs = [];
        try {
          H.isTest = false;
          console.log = (msg) => { logs.push(String(msg)); };
          fs.statSync = () => ({ isDirectory: () => true });
          child_process.execSync = () => "";
          fs.readdirSync = () => [];

          await scan_depot("test");
          await scan_depot();

          expect(logs.join("\n")).to.include("Adding new harbor");
          expect(logs.join("\n")).to.include(
            "Enumerating Harbors found in depot",
          );
        }
        finally {
          H.isTest = originalIsTest;
          console.log = originalConsoleLog;
        }
      },
    );
  });

  describe("#isModuleNotFoundError", () => {
    it("returns true for MODULE_NOT_FOUND code", () => {
      expect(isModuleNotFoundError({ code: "MODULE_NOT_FOUND" }))
        .to.eq(true);
    });

    it("returns true for 'Cannot find module' message", () => {
      expect(isModuleNotFoundError({ message: "Cannot find module xyz" }))
        .to.eq(true);
    });

    it("returns false for other errors", () => {
      expect(isModuleNotFoundError({ code: "OTHER_ERROR" })).to.eq(false);
      expect(isModuleNotFoundError({ message: "Some other error" }))
        .to.eq(false);
      expect(isModuleNotFoundError({})).to.eq(false);
      expect(isModuleNotFoundError({
        code: undefined,
        message: undefined,
      })).to.eq(false);
    });
  });

  describe("#customRequire", () => {
    it("uses default empty cache when cache not provided", () => {
      try {
        customRequire("nonexistent-module");
      }
      catch (e) {
        expect(isModuleNotFoundError(e)).to.eq(true);
      }
    });

    it("re-throws non-MODULE_NOT_FOUND errors", () => {
      const testModuleDir = path.join(
        harbors_upstream_dir,
        "test-rethrow-module",
      );
      const testModuleFile = path.join(testModuleDir, "index.js");
      const originalExistsSync = fs.existsSync;
      const originalMkdirpSync = mkdirp.sync;
      const originalWriteFileSync = fs.writeFileSync;
      const originalUnlinkSync = fs.unlinkSync;
      const originalRmdirSync = fs.rmdirSync;
      try {
        if (!originalExistsSync(testModuleDir)) {
          originalMkdirpSync(testModuleDir);
        }
        originalWriteFileSync(testModuleFile, "{{{ invalid syntax");
        const cache = {};
        let errorCaught = false;
        let caughtError;
        try {
          customRequire("test-rethrow-module", cache);
        }
        catch (e) {
          errorCaught = true;
          caughtError = e;
        }
        expect(errorCaught).to.eq(true);
        if (!isModuleNotFoundError(caughtError)) {
          expect(caughtError.code).to.not.eq("MODULE_NOT_FOUND");
          expect(caughtError.message).to.not.include("Cannot find module");
        }
      }
      finally {
        fs.existsSync = originalExistsSync;
        mkdirp.sync = originalMkdirpSync;
        fs.writeFileSync = originalWriteFileSync;
        if (originalExistsSync(testModuleFile)) {
          originalUnlinkSync(testModuleFile);
        }
        if (originalExistsSync(testModuleDir)) {
          originalRmdirSync(testModuleDir);
        }
      }
    });
  });

  describe("#register_harbors", () => {
    let originalConsoleError;
    let harborsStub;
    let originalPackageJson;
    let packageJsonExisted;
    let registerHarborsStderrWrite;
    let suppressingEmailError;
    beforeEach(async () => {
      fs.readdir = (dir, cb) => cb(null, ["test.js"]);
      fs.watch = () => { };
      fs.statSync = () => ({
        isDirectory: () => false,
        isFile: () => true,
      });
      fs.readFile = (p, enc, cb) => cb(null, "");
      H.harbors = {};
      child_process.execSync = () => { };
      originalConsoleError = console.error;
      registerHarborsStderrWrite = process.stderr.write;

      // Suppress email-related warnings in tests
      suppressingEmailError = false;
      const emailErrorSuppressor = (chunk, encoding, fd) => {
        if (typeof chunk === 'string') {
          const isEmailErrorStart = chunk.includes(
            'Email.send is no longer recommended',
          ) || (chunk.includes('ECONNREFUSED') &&
                chunk.includes('127.0.0.1:25'));
          // Check if this is the start of an email error
          if (isEmailErrorStart) {
            suppressingEmailError = true;
            return true;
          }
          // Continue suppressing if we're in the middle of an email error
          if (suppressingEmailError) {
            // Stop suppressing when we see the closing brace
            if (chunk.trim() === '}') {
              suppressingEmailError = false;
            }
            return true;
          }
        }
        return registerHarborsStderrWrite.call(
          process.stderr,
          chunk,
          encoding,
          fd,
        );
      };
      process.stderr.write = emailErrorSuppressor;
      // Save original package.json if it exists
      packageJsonExisted = fs.existsSync(harbors_upstream_packages);
      if (packageJsonExisted) {
        originalPackageJson = fs.readFileSync(
          harbors_upstream_packages,
          "utf8",
        );
      }
      await resetDatabase();
      harborsStub = setupInMemoryCollection(Harbors);
    });

    afterEach(async () => {
      fs.readdir = fs_readdir;
      fs.statSync = fs_stat_sync;
      fs.readFile = fs_read_file;
      fs.watch = fs_watch;
      fs.writeFileSync = fs_write_file_sync;
      child_process.execSync = exec_sync;
      Module.prototype.require = module_require;
      console.error = originalConsoleError;
      if (registerHarborsStderrWrite) {
        process.stderr.write = registerHarborsStderrWrite;
      }
      suppressingEmailError = false;
      // Restore original package.json
      if (packageJsonExisted && originalPackageJson) {
        fs.writeFileSync(harbors_upstream_packages, originalPackageJson);
      }
      else if (fs.existsSync(harbors_upstream_packages)) {
        // Delete it if it didn't exist before
        fs.unlinkSync(harbors_upstream_packages);
      }
      if (harborsStub) harborsStub.restore();
    });

    it("returns undefined for a non-match", async () => {
      fs.statSync = () => ({
        isDirectory: () => true,
        isFile: () => false,
      });
      fs.readdir = (dir, cb) => cb(null, ["test.foo"]);
      expect(await register_harbors()).to.eq(undefined);
    });

    it(
      "loads the harbors found in the ~/.harbormaster/harbors dir",
      async () => {
        let expected_folder;
        fs.readdir = (folder, cb) => {
          expected_folder = folder;
          cb(null, []);
        };
        await register_harbors();
        expect(expected_folder).to.eq(harbors_dir);
      },
    );

    it("logs an error if reading harbors dir fails", async () => {
      let called = false;
      console.error = () => { called = true; };
      fs.readdir = (dir, cb) => cb(new Error("boom"));
      await register_harbors();
      expect(called).to.eq(true);
    });

    it("logs an error if a harbor has no name for registration", async () => {
      fs.readFile = (p, enc, cb) => cb(
        null,
        "module.exports = { register: () => ({}) }",
      );
      const console_error = console.error;
      let called = false;
      console.error = () => { called = true; };
      await register_harbors();
      expect(called).to.eq(true);
      console.error = console_error;
    });

    it("logs an error if reading harbor file fails", async () => {
      const originalError = console.error;
      let called = false;
      try {
        console.error = () => { called = true; };
        fs.readFile = (p, enc, cb) => cb(new Error("bad"));
        await register_harbors();
        expect(called).to.eq(true);
      }
      finally {
        console.error = originalError;
      }
    });

    it(
      "keeps going if upstream package.json cleanup cannot be written",
      async () => {
        const originalExistsSync = fs.existsSync;
        const originalReadFileSync = fs.readFileSync;
        const originalWriteFileSync = fs.writeFileSync;

        const originalError = console.error;
        let sawError = false;
        try {
          // This test intentionally triggers an error path; don't spam stderr.
          console.error = () => { sawError = true; };

          fs.existsSync = (p) => {
            if (p === harbors_upstream_packages) return true;
            return originalExistsSync(p);
          };
          fs.readFileSync = (p, enc) => {
            if (p === harbors_upstream_packages) {
              return JSON.stringify({
                name: "hm-test",
                dependencies: { test: "1.0.0" },
              });
            }
            return originalReadFileSync(p, enc);
          };

          // The cleanup path writes the sanitized JSON; simulate failure
          // and ensure register_harbors doesn't crash.
          fs.writeFileSync = (p) => {
            if (p === harbors_upstream_packages) throw new Error("nope");
            // eslint-disable-next-line prefer-rest-params
            originalWriteFileSync.apply(fs, arguments);
          };

          fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
            register: () => ({ pkgs: [], name: 'test' }),
            render_input: async () => ({})
          };`);

          await register_harbors();
          expect(await Harbors.findOneAsync("test")).to.be.an("object");
          expect(sawError).to.eq(true);
        }
        finally {
          console.error = originalError;
          fs.existsSync = originalExistsSync;
          fs.readFileSync = originalReadFileSync;
          fs.writeFileSync = originalWriteFileSync;
        }
      },
    );

    it(
      "logs when upstream package.json cannot be read during install",
      async () => {
        const originalExistsSync = fs.existsSync;
        const originalReadFileSync = fs.readFileSync;
        const originalWriteFileSync = fs.writeFileSync;
        const originalExecSync = child_process.execSync;
        const originalError = console.error;

        const missingPkg = "hm-pkg-install-read-error";
        let installCmd;
        let errorOutput = "";

        try {
          fs.existsSync = (p) => {
            if (p === harbors_upstream_packages) return true;
            return originalExistsSync(p);
          };
          fs.readFileSync = (p, enc) => {
            if (p === harbors_upstream_packages) {
              throw new Error("boom");
            }
            return originalReadFileSync(p, enc);
          };
          fs.writeFileSync = (p, content) => {
            if (p === harbors_upstream_packages) return;
            originalWriteFileSync(p, content);
          };
          fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
            register: () => ({ pkgs: ['${missingPkg}'], name: 'test' }),
            render_input: async () => ({})
          };`);
          child_process.execSync = (cmd) => {
            installCmd = cmd;
            return "";
          };
          console.error = (msg) => { errorOutput += String(msg); };

          await register_harbors();

          expect(errorOutput).to.include("Error reading");
          expect(installCmd).to.include(missingPkg);
        }
        finally {
          fs.existsSync = originalExistsSync;
          fs.readFileSync = originalReadFileSync;
          fs.writeFileSync = originalWriteFileSync;
          child_process.execSync = originalExecSync;
          console.error = originalError;
        }
      },
    );
    it("installs missing dependencies", async () => {
      const missingPkg = 'hm-missing-pkg';
      const expected =
        `npm i --save-prod --save-exact ${missingPkg} --no-fund --prefix ` +
        `${harbormaster_dir}`;
      let called;
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      fs.existsSync = (p) => {
        if (p === harbors_upstream_packages) return true;
        return originalExistsSync(p);
      };
      fs.readFileSync = (p, enc) => {
        if (p === harbors_upstream_packages) {
          return JSON.stringify({ name: 'hm-test', dependencies: {} });
        }
        return originalReadFileSync(p, enc);
      };
      fs.writeFileSync = (p, content) => {
        if (p === harbors_upstream_packages) return;
        originalWriteFileSync(p, content);
      };
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: ['${missingPkg}'], name: 'test' }),
        render_input: () => {}
      };`);
      child_process.execSync = (cmd) => {
        called = cmd;
        return "";
      };
      await register_harbors();
      expect(called).to.eq(expected);
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
    });

    it(
      "installs git+ packages even when they are not valid package names",
      async () => {
        const gitPkg = 'git+hm-test-not-a-git-url';
        const expected =
        `npm i --save-prod --save-exact ${gitPkg} --no-fund --prefix ` +
        `${harbormaster_dir}`;
        let called;

        const originalExistsSync = fs.existsSync;
        const originalReadFileSync = fs.readFileSync;
        const originalWriteFileSync = fs.writeFileSync;
        const originalExecSync = child_process.execSync;

        try {
          fs.existsSync = (p) => {
            if (p === harbors_upstream_packages) return true;
            return originalExistsSync(p);
          };
          fs.readFileSync = (p, enc) => {
            if (p === harbors_upstream_packages) {
              return JSON.stringify({ name: 'hm-test', dependencies: {} });
            }
            return originalReadFileSync(p, enc);
          };
          fs.writeFileSync = (p, content) => {
            if (p === harbors_upstream_packages) return;
            originalWriteFileSync(p, content);
          };
          fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => ({ pkgs: ['${gitPkg}'], name: 'test' }),
          render_input: () => {}
        };`);
          child_process.execSync = (cmd) => {
            called = cmd;
            return "";
          };

          await register_harbors();
          expect(called).to.eq(expected);
        }
        finally {
          fs.existsSync = originalExistsSync;
          fs.readFileSync = originalReadFileSync;
          fs.writeFileSync = originalWriteFileSync;
          child_process.execSync = originalExecSync;
        }
      },
    );

    it("handles missing package.json file", async () => {
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      fs.existsSync = (p) => {
        if (p === harbors_upstream_packages) return false;
        return originalExistsSync(p);
      };
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        render_input: () => {}
      };`);
      child_process.execSync = () => "";
      await register_harbors();
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
    });

    it("handles package.json without dependencies property", async () => {
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      fs.existsSync = (p) => {
        if (p === harbors_upstream_packages) return true;
        return originalExistsSync(p);
      };
      fs.readFileSync = (p, enc) => {
        if (p === harbors_upstream_packages) {
          return JSON.stringify({ name: "test" });
        }
        return originalReadFileSync(p, enc);
      };
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        render_input: () => {}
      };`);
      child_process.execSync = () => "";
      await register_harbors();
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
    });

    it("handles package.json parse errors", async () => {
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      let errorLogged = false;
      console.error = () => { errorLogged = true; };
      fs.existsSync = (p) => {
        if (p === harbors_upstream_packages) return true;
        return originalExistsSync(p);
      };
      fs.readFileSync = (p, enc) => {
        if (p === harbors_upstream_packages) {
          throw new Error("Parse error");
        }
        return originalReadFileSync(p, enc);
      };
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        render_input: () => {}
      };`);
      child_process.execSync = () => "";
      await register_harbors();
      expect(errorLogged).to.eq(true);
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
      console.error = originalConsoleError;
    });
    it("does not throw errors from package installation", async () => {
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      const originalExecSync = child_process.execSync;
      const installError = new Error("Install failed");
      fs.existsSync = (p) => {
        if (p === harbors_upstream_packages) return true;
        return originalExistsSync(p);
      };
      fs.readFileSync = (p, enc) => {
        if (p === harbors_upstream_packages) {
          return JSON.stringify({ dependencies: {} });
        }
        return originalReadFileSync(p, enc);
      };
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: ['hm-install-fails'], name: 'test' }),
        render_input: () => {}
      };`);
      child_process.execSync = () => {
        throw installError;
      };
      await register_harbors();
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
      child_process.execSync = originalExecSync;
    });

    it('logs cache + package registration in non-test mode', async () => {
      const originalIsTest = H.isTest;
      const originalLog = console.log;
      const originalError = console.error;

      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      const originalExistsSync = fs.existsSync;
      const originalReaddir = fs.readdir;
      const originalReadFile = fs.readFile;

      const cachedPkg = 'hm-cached-pkg';
      const missingPkg = 'hm-missing-cache-pkg';
      const cachedPkgDir = path.join(harbors_upstream_dir, cachedPkg);
      const cachedPkgPkgJson = path.join(cachedPkgDir, 'package.json');
      const cachedPkgIndex = path.join(cachedPkgDir, 'index.js');

      let logs = [];
      let errors = [];
      try {
        H.isTest = false;
        console.log = (msg) => { logs.push(String(msg)); };
        console.error = (msg) => { errors.push(String(msg)); };

        // Real module on disk so require(customRequire) can load it.
        mkdirp.sync(cachedPkgDir);
        fs.writeFileSync(
          cachedPkgPkgJson,
          JSON.stringify({ name: cachedPkg, main: 'index.js' }),
        );
        fs.writeFileSync(cachedPkgIndex, 'module.exports = { ok: true };');

        fs.existsSync = (p) => {
          if (p === harbors_upstream_packages) return true;
          return originalExistsSync(p);
        };
        fs.readFileSync = (p, enc) => {
          if (p === harbors_upstream_packages) {
            return JSON.stringify({
              name: 'hm-test',
              dependencies: { [cachedPkg]: '1.0.0', [missingPkg]: '1.0.0' },
            });
          }
          return originalReadFileSync(p, enc);
        };

        // Ensure we get into the register_harbors() try block and packages log.
        fs.readdir = (dir, cb) => cb(null, ['test.js']);
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => ({ pkgs: ['${cachedPkg}'], name: 'harbor' }),
          render_input: async () => ({})
        };`);

        await register_harbors();

        const allLogs = logs.join('\n');
        const allErrors = errors.join('\n');
        expect(allLogs).to.include(`Cached upstream found: ${cachedPkg}`);
        expect(allErrors).to.include(
          `Unable to load cache for upstream: ${missingPkg}`,
        );
        expect(allLogs).to.include('Packages registered:');
      }
      finally {
        H.isTest = originalIsTest;
        console.log = originalLog;
        console.error = originalError;
        fs.readFileSync = originalReadFileSync;
        fs.writeFileSync = originalWriteFileSync;
        fs.existsSync = originalExistsSync;
        fs.readdir = originalReaddir;
        fs.readFile = originalReadFile;

        if (fs.existsSync(cachedPkgIndex)) fs.unlinkSync(cachedPkgIndex);
        if (fs.existsSync(cachedPkgPkgJson)) fs.unlinkSync(cachedPkgPkgJson);
        if (fs.existsSync(cachedPkgDir)) fs.rmdirSync(cachedPkgDir);
      }
    });

    it('deletes bogus "test" dependency before installing', async () => {
      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      const originalExistsSync = fs.existsSync;
      const originalExecSync = child_process.execSync;

      const missingPkg = 'hm-pkg-for-delete-test-dep';
      let writtenPackageJson;
      try {
        fs.existsSync = (p) => {
          if (p === harbors_upstream_packages) return true;
          return originalExistsSync(p);
        };
        fs.readFileSync = (p, enc) => {
          if (p === harbors_upstream_packages) {
            return JSON.stringify({
              name: 'hm-test',
              dependencies: { test: '0.0.1' },
            });
          }
          return originalReadFileSync(p, enc);
        };
        fs.writeFileSync = (p, content) => {
          if (p === harbors_upstream_packages) {
            writtenPackageJson = JSON.parse(String(content));
            return;
          }
          originalWriteFileSync(p, content);
        };
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => ({ pkgs: ['${missingPkg}'], name: 'harbor' }),
          render_input: async () => ({})
        };`);
        child_process.execSync = () => '';

        await register_harbors();

        expect(writtenPackageJson).to.be.an('object');
        expect(writtenPackageJson.dependencies).to.be.an('object');
        expect(writtenPackageJson.dependencies.test).to.eq(undefined);
        // register_harbors writes '*' to let npm resolve latest.
        expect(writtenPackageJson.dependencies[missingPkg]).to.be.a('string');
        expect(writtenPackageJson.dependencies[missingPkg]).to.not.eq('');
      }
      finally {
        fs.readFileSync = originalReadFileSync;
        fs.writeFileSync = originalWriteFileSync;
        fs.existsSync = originalExistsSync;
        child_process.execSync = originalExecSync;
      }
    });

    it('logs install failure details in non-test mode', async () => {
      const originalIsTest = H.isTest;
      const originalError = console.error;
      const originalReadFileSync = fs.readFileSync;
      const originalExistsSync = fs.existsSync;
      const originalExecSync = child_process.execSync;

      const missingPkg = 'hm-pkg-install-fail-logs';
      let errors = [];
      try {
        H.isTest = false;
        console.error = (msg) => { errors.push(String(msg)); };

        fs.existsSync = (p) => {
          if (p === harbors_upstream_packages) return true;
          return originalExistsSync(p);
        };
        fs.readFileSync = (p, enc) => {
          if (p === harbors_upstream_packages) {
            return JSON.stringify({ name: 'hm-test', dependencies: {} });
          }
          return originalReadFileSync(p, enc);
        };
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => ({ pkgs: ['${missingPkg}'], name: 'harbor' }),
          render_input: async () => ({})
        };`);
        const err = new Error('Install failed');
        err.stdout = 'STDOUT';
        err.stderr = 'STDERR';
        child_process.execSync = () => { throw err; };

        await register_harbors();

        const joined = errors.join('\n');
        expect(joined).to.include('Failed to install packages');
        expect(joined).to.include('Command: npm i --save-prod --save-exact');
        expect(joined).to.include('Error: Install failed');
        expect(joined).to.include('stdout: STDOUT');
        expect(joined).to.include('stderr: STDERR');
      }
      finally {
        H.isTest = originalIsTest;
        console.error = originalError;
        fs.readFileSync = originalReadFileSync;
        fs.existsSync = originalExistsSync;
        child_process.execSync = originalExecSync;
      }
    });
    it("skips adding packages that already exist in dependencies", async () => {
      const existingPkg = 'hm-existing-pkg';
      const originalExistsSync = fs.existsSync;
      const originalReadFileSync = fs.readFileSync;
      const originalWriteFileSync = fs.writeFileSync;
      const originalExecSync = child_process.execSync;
      const originalReadFile = fs.readFile;
      let writtenPackageJson;
      fs.existsSync = (p) => {
        if (p === harbors_upstream_packages) return true;
        return originalExistsSync(p);
      };
      fs.readFileSync = (p, enc) => {
        if (p === harbors_upstream_packages) {
          return JSON.stringify({ dependencies: { [existingPkg]: "1.0.0" } });
        }
        return originalReadFileSync(p, enc);
      };
      fs.writeFileSync = (p, content) => {
        if (p === harbors_upstream_packages) {
          writtenPackageJson = JSON.parse(content);
        }
        return originalWriteFileSync(p, content);
      };
      fs.readFile = (p, enc, cb) => {
        if (p.includes('harbors')) {
          return cb(null, `module.exports = {
            register: () => ({ pkgs: ['${existingPkg}'], name: 'test' }),
            render_input: () => {}
          };`);
        }
        return originalReadFile(p, enc, cb);
      };
      child_process.execSync = () => "";
      await register_harbors();
      expect(writtenPackageJson.dependencies[existingPkg]).to.eq("1.0.0");
      fs.existsSync = originalExistsSync;
      fs.readFileSync = originalReadFileSync;
      fs.writeFileSync = originalWriteFileSync;
      fs.readFile = originalReadFile;
      child_process.execSync = originalExecSync;
    });
    it("assigns an entrypoint for the harbor", async () => {
      const eval_string = `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        render_input: () => {}
      };`;
      fs.readFile = (p, enc, cb) => cb(null, eval_string);
      await register_harbors();
      expect(H.harbors.test && H.harbors.test.register().name).to.eq("test");
    });

    it("executes followup instructions for the harbor", async () => {
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        render_input: () => {},
        next: () => H.harbors.test.called = true
      };`);
      await register_harbors();
      expect(H.harbors.test && H.harbors.test.called).to.eq(true);
    });

    it("assigns and executes harbor constraints", async () => {
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        render_input: () => {},
        next: () => {},
        constraints: () => H.harbors.test.constraints = true
      };`);
      await register_harbors();
      expect(H.harbors.test && H.harbors.test.constraints).to.eq(true);
    });

    it("registers and updates the harbor", async () => {
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        render_input: () => {}
      };`);
      await register_harbors();
      const rec = await Harbors.findOneAsync("test");
      expect(rec && rec.registered).to.eq(true);
    });

    it("does not throw when next() throws", async () => {
      const originalError = console.error;
      try {
        console.error = () => {};
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => ({ pkgs: [], name: 'test' }),
          next: () => { throw new Error('boom'); },
          render_input: async () => ({})
        };`);
        await register_harbors();
        const rec = await Harbors.findOneAsync("test");
        expect(rec && rec.registered).to.eq(true);
      }
      finally {
        console.error = originalError;
      }
    });

    it("defaults rendered_input when render_input is missing", async () => {
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' })
      };`);

      await register_harbors();
      const rec = await Harbors.findOneAsync("test");
      expect(rec).to.be.an("object");
      expect(rec.rendered_input).to.include("No render_input() provided");
    });

    it("sets constraints to {} when constraints throws", async () => {
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => ({ pkgs: [], name: 'test' }),
        constraints: () => { throw new Error('boom'); },
        render_input: async () => ({})
      };`);

      await register_harbors();
      const rec = await Harbors.findOneAsync("test");
      expect(rec).to.be.an("object");
      expect(rec.constraints).to.deep.eq({});
    });

    it(
      "sets rendered_input to an error string when render_input throws",
      async () => {
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => ({ pkgs: [], name: 'test' }),
          render_input: async () => { throw new Error('boom'); }
        };`);

        await register_harbors();
        const rec = await Harbors.findOneAsync("test");
        expect(rec).to.be.an("object");
        expect(rec.rendered_input).to.include("Error rendering input for test");
      },
    );
    it("returns null when module path does not exist", async () => {
      const nonExistentModulePath = path.resolve(
        harbors_upstream_dir,
        "nonexistent-module",
      );
      fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
        register: () => {
          try {
            require('nonexistent-module');
          } catch (e) {
            // Expected to fail - resolveModulePath returns null
            // when module path doesn't exist, so original error is thrown
          }
          return ({ pkgs: [], name: 'test' });
        },
        render_input: () => {}
      };`);
      await register_harbors();
      expect(nonExistentModulePath).to.be.a('string');
      expect(await Harbors.findOneAsync('test')).to.be.an('object');
    });
    describe("module resolution", () => {
      // Use path.resolve to match how resolveModulePath normalizes paths
      const testModulePath = path.resolve(harbors_upstream_dir, "test-module");
      const packageJsonPath = path.resolve(testModulePath, "package.json");
      const mainPath = path.resolve(testModulePath, "main.js");
      const indexPath = path.resolve(testModulePath, "index.js");

      let moduleConfig;
      let originalExistsSync;
      let originalReadFileSync;
      let originalStderrWrite;

      beforeEach(() => {
        originalExistsSync = fs.existsSync;
        originalReadFileSync = fs.readFileSync;
        originalStderrWrite = process.stderr.write;

        // Suppress MODULE_NOT_FOUND errors from Meteor's require system
        // These are expected and caught by customRequire
        const errorSuppressor = (chunk, encoding, fd) => {
          if (typeof chunk === 'string' && chunk.includes('MODULE_NOT_FOUND') &&
              chunk.includes('Cannot find module')) {
            // Suppress this specific error - it's expected in tests
            return true;
          }
          return originalStderrWrite.call(process.stderr, chunk, encoding, fd);
        };
        process.stderr.write = errorSuppressor;

        // Default config - tests can override
        moduleConfig = moduleConfig || {
          packageJsonExists: true,
          packageJsonContent: {},
          mainExists: false,
          indexExists: false,
          customPaths: {},
          readFileSyncOverride: null,
        };

        // Normalize all paths for comparison - cache normalized paths
        const normalize = (p) => p ? path.resolve(p) : p;
        const normTestModule = normalize(testModulePath);
        const normPkgJson = normalize(packageJsonPath);
        const normMain = normalize(mainPath);
        const normIndex = normalize(indexPath);

        const existsMap = {
          [normTestModule]: true,
          [normPkgJson]: moduleConfig.packageJsonExists,
          [normMain]: moduleConfig.mainExists,
          [normIndex]: moduleConfig.indexExists,
        };

        // Add custom paths (normalized)
        Object.keys(moduleConfig.customPaths || {}).forEach(key => {
          existsMap[normalize(key)] = moduleConfig.customPaths[key];
        });

        fs.existsSync = (p) => {
          const normalized = normalize(p);
          return existsMap[normalized] ?? originalExistsSync(p);
        };

        fs.readFileSync = (p, enc) => {
          const normalized = normalize(p);

          if (moduleConfig.readFileSyncOverride) {
            const result = moduleConfig.readFileSyncOverride(p, enc);
            if (result !== undefined) return result;
          }

          if (normalized === normPkgJson && moduleConfig.packageJsonExists) {
            return typeof moduleConfig.packageJsonContent === 'string'
              ? moduleConfig.packageJsonContent
              : JSON.stringify(moduleConfig.packageJsonContent);
          }

          if (normalized === normMain && moduleConfig.mainExists) {
            return "module.exports = {};";
          }

          if (normalized === normIndex && moduleConfig.indexExists) {
            return "module.exports = {};";
          }

          return originalReadFileSync(p, enc);
        };
      });

      afterEach(() => {
        fs.existsSync = originalExistsSync;
        fs.readFileSync = originalReadFileSync;
        process.stderr.write = originalStderrWrite;
        moduleConfig = null; // Reset for next test
      });

      it("resolves module with package.json main entry", async () => {
        moduleConfig = {
          packageJsonExists: true,
          packageJsonContent: { main: "main.js" },
          mainExists: true,
        };
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => {
            require('test-module');
            return ({ pkgs: [], name: 'test' });
          },
          render_input: () => {}
        };`);
        await register_harbors();
      });

      it(
        "resolves module with package.json main entry without extension",
        async () => {
          const mainPathNoExt = path.resolve(testModulePath, "main");
          moduleConfig = {
            packageJsonExists: true,
            packageJsonContent: { main: "main" },
            mainExists: true,
            customPaths: { [mainPathNoExt]: false },
          };
          fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
            register: () => {
              require('test-module');
              return ({ pkgs: [], name: 'test' });
            },
            render_input: () => {}
          };`);
          await register_harbors();
        },
      );

      it(
        "falls back to index.js when package.json main entry not found",
        async () => {
          moduleConfig = {
            packageJsonExists: true,
            packageJsonContent: { main: "main.js" },
            mainExists: false,
            indexExists: true,
          };
          fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
            register: () => {
              require('test-module');
              return ({ pkgs: [], name: 'test' });
            },
            render_input: () => {}
          };`);
          await register_harbors();
        },
      );

      it("handles package.json parse errors gracefully", async () => {
        moduleConfig = {
          packageJsonExists: true,
          indexExists: true,
          readFileSyncOverride: (p) => {
            if (p === packageJsonPath) throw new Error("Invalid JSON");
          },
        };
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => {
            require('test-module');
            return ({ pkgs: [], name: 'test' });
          },
          render_input: () => {}
        };`);
        await register_harbors();
      });

      it(
        "falls back to index.js when package.json does not exist",
        async () => {
          moduleConfig = {
            packageJsonExists: false,
            indexExists: true,
          };
          fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
            register: () => {
              require('test-module');
              return ({ pkgs: [], name: 'test' });
            },
            render_input: () => {}
          };`);
          await register_harbors();
        },
      );

      it(
        "uses index.js fallback when package.json main is missing",
        async () => {
          moduleConfig = {
            packageJsonExists: true,
            packageJsonContent: {},
            indexExists: true,
          };
          fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
            register: () => {
              require('test-module');
              return ({ pkgs: [], name: 'test' });
            },
            render_input: () => {}
          };`);
          await register_harbors();
        },
      );

      it("returns null when index.js does not exist", async () => {
        moduleConfig = {
          packageJsonExists: true,
          packageJsonContent: {},
          indexExists: false,
        };
        fs.readFile = (p, enc, cb) => cb(null, `module.exports = {
          register: () => {
            try {
              require('test-module');
            } catch (e) {
              // Expected to fail - resolveModulePath returns null
              // when index.js doesn't exist
            }
            return ({ pkgs: [], name: 'test' });
          },
          render_input: () => {}
        };`);
        await register_harbors();
      });
    });

    it(
      "re-throws errors that are not MODULE_NOT_FOUND and lack " +
      "'Cannot find module' message",
      async () => {
        const testModuleDir = path.join(
          harbors_upstream_dir,
          "test-syntax-error-module",
        );
        const testModuleFile = path.join(testModuleDir, "index.js");
        const originalExistsSync = fs.existsSync;
        const originalMkdirpSync = mkdirp.sync;
        const originalWriteFileSync = fs.writeFileSync;
        const originalUnlinkSync = fs.unlinkSync;
        const originalRmdirSync = fs.rmdirSync;
        try {
          if (!originalExistsSync(testModuleDir)) {
            originalMkdirpSync(testModuleDir);
          }
          originalWriteFileSync(testModuleFile, "{{{ invalid syntax");
          const requireCache = {};
          let errorCaught = false;
          let caughtError;
          try {
            customRequire("test-syntax-error-module", requireCache);
          }
          catch (e) {
            errorCaught = true;
            caughtError = e;
          }
          expect(errorCaught).to.eq(true);
          if (!isModuleNotFoundError(caughtError)) {
            expect(caughtError.code).to.not.eq("MODULE_NOT_FOUND");
            expect(caughtError.message)
              .to.not.include("Cannot find module");
          }
        }
        finally {
          fs.existsSync = originalExistsSync;
          mkdirp.sync = originalMkdirpSync;
          fs.writeFileSync = originalWriteFileSync;
          if (originalExistsSync(testModuleFile)) {
            originalUnlinkSync(testModuleFile);
          }
          if (originalExistsSync(testModuleDir)) {
            originalRmdirSync(testModuleDir);
          }
        }
      },
    );
    describe("#resolveModulePath", () => {
      it("returns mainPath when it exists", () => {
        const originalExistsSync = fs.existsSync;
        const originalReadFileSync = fs.readFileSync;

        const moduleName = "returns-mainpath-module";
        const modulePath = path.resolve(harbors_upstream_dir, moduleName);
        const pkgPath = path.join(modulePath, "package.json");
        const mainPath = path.resolve(modulePath, "main.js");

        try {
          fs.existsSync = (p) => {
            const normalized = path.resolve(p);
            if (normalized === modulePath) return true;
            if (normalized === pkgPath) return true;
            if (normalized === mainPath) return true;
            return originalExistsSync(p);
          };
          fs.readFileSync = (p, enc) => {
            if (path.resolve(p) === path.resolve(pkgPath)) {
              return JSON.stringify({ main: "main.js" });
            }
            return originalReadFileSync(p, enc);
          };

          const resolved = resolveModulePath(moduleName);
          expect(resolved).to.eq(mainPath);
        }
        finally {
          fs.existsSync = originalExistsSync;
          fs.readFileSync = originalReadFileSync;
        }
      });

      // eslint-disable-next-line max-len
      it("warns with .js fallback paths when main has no extension (non-test mode)", () => {
        const originalIsTest = H.isTest;
        const originalWarn = console.warn;
        const originalExistsSync = fs.existsSync;
        const originalReadFileSync = fs.readFileSync;

        const moduleName = "warn-missing-main-noext-module";
        const modulePath = path.resolve(harbors_upstream_dir, moduleName);
        const pkgPath = path.join(modulePath, "package.json");
        const mainPath = path.resolve(modulePath, "missing-main");
        const mainPathJs = `${mainPath}.js`;
        const indexPath = path.resolve(modulePath, "index.js");

        let warned = "";
        try {
          H.isTest = false;
          console.warn = (msg) => { warned += String(msg); };

          fs.existsSync = (p) => {
            const normalized = path.resolve(p);
            if (normalized === modulePath) return true;
            if (normalized === pkgPath) return true;
            if (normalized === mainPath) return false;
            if (normalized === mainPathJs) return false;
            if (normalized === indexPath) return true;
            return originalExistsSync(p);
          };
          fs.readFileSync = (p, enc) => {
            if (path.resolve(p) === path.resolve(pkgPath)) {
              return JSON.stringify({ main: "missing-main" });
            }
            return originalReadFileSync(p, enc);
          };

          const resolved = resolveModulePath(moduleName);
          expect(resolved).to.eq(indexPath);
          expect(warned).to.include(`${mainPath} and ${mainPath}.js`);
        }
        finally {
          H.isTest = originalIsTest;
          console.warn = originalWarn;
          fs.existsSync = originalExistsSync;
          fs.readFileSync = originalReadFileSync;
        }
      });
      // eslint-disable-next-line max-len
      it("warns when package.json main entry path does not exist (non-test mode)", () => {
        const originalIsTest = H.isTest;
        const originalWarn = console.warn;
        const originalExistsSync = fs.existsSync;
        const originalReadFileSync = fs.readFileSync;

        const moduleName = "warn-missing-main-module";
        const modulePath = path.resolve(harbors_upstream_dir, moduleName);
        const pkgPath = path.join(modulePath, "package.json");
        const mainPath = path.resolve(modulePath, "missing-main.js");
        const indexPath = path.resolve(modulePath, "index.js");

        let warned = "";
        try {
          H.isTest = false;
          console.warn = (msg) => { warned += String(msg); };

          fs.existsSync = (p) => {
            const normalized = path.resolve(p);
            if (normalized === modulePath) return true;
            if (normalized === pkgPath) return true;
            if (normalized === mainPath) return false;
            if (normalized === indexPath) return true;
            return originalExistsSync(p);
          };
          fs.readFileSync = (p, enc) => {
            if (path.resolve(p) === path.resolve(pkgPath)) {
              return JSON.stringify({ main: "missing-main.js" });
            }
            return originalReadFileSync(p, enc);
          };

          const resolved = resolveModulePath(moduleName);
          expect(resolved).to.eq(indexPath);
          expect(warned).to.include("Package.json main entry point not found");
        }
        finally {
          H.isTest = originalIsTest;
          console.warn = originalWarn;
          fs.existsSync = originalExistsSync;
          fs.readFileSync = originalReadFileSync;
        }
      });

      it("warns when package.json cannot be parsed (non-test mode)", () => {
        const originalIsTest = H.isTest;
        const originalWarn = console.warn;
        const originalExistsSync = fs.existsSync;
        const originalReadFileSync = fs.readFileSync;

        const moduleName = "warn-bad-pkgjson-module";
        const modulePath = path.resolve(harbors_upstream_dir, moduleName);
        const pkgPath = path.join(modulePath, "package.json");
        const indexPath = path.resolve(modulePath, "index.js");

        let warned = "";
        try {
          H.isTest = false;
          console.warn = (msg) => { warned += String(msg); };

          fs.existsSync = (p) => {
            const normalized = path.resolve(p);
            if (normalized === modulePath) return true;
            if (normalized === pkgPath) return true;
            if (normalized === indexPath) return true;
            return originalExistsSync(p);
          };
          fs.readFileSync = (p, enc) => {
            if (path.resolve(p) === path.resolve(pkgPath)) {
              return "{ this is not json";
            }
            return originalReadFileSync(p, enc);
          };

          const resolved = resolveModulePath(moduleName);
          expect(resolved).to.eq(indexPath);
          expect(warned).to.include("Failed to parse package.json");
        }
        finally {
          H.isTest = originalIsTest;
          console.warn = originalWarn;
          fs.existsSync = originalExistsSync;
          fs.readFileSync = originalReadFileSync;
        }
      });

      it("returns null when index.js does not exist", () => {
        const testModulePath = path.resolve(
          harbors_upstream_dir,
          "no-index-module",
        );
        const packageJsonPath = path.resolve(testModulePath, "package.json");
        const indexPath = path.resolve(testModulePath, "index.js");
        const originalExistsSync = fs.existsSync;

        fs.existsSync = (p) => {
          const normalized = path.resolve(p);
          if (normalized === testModulePath) return true;
          if (normalized === packageJsonPath) return false;
          if (normalized === indexPath) return false;
          return originalExistsSync(p);
        };

        const result = resolveModulePath("no-index-module");
        expect(result).to.eq(null);

        fs.existsSync = originalExistsSync;
      });
      it("returns indexPath when index.js exists", () => {
        const testModulePath = path.resolve(
          harbors_upstream_dir,
          "has-index-module",
        );
        const indexPath = path.resolve(testModulePath, "index.js");
        const originalExistsSync = fs.existsSync;

        fs.existsSync = (p) => {
          if (p === testModulePath) return true;
          if (p === indexPath) return true;
          return originalExistsSync(p);
        };

        const result = resolveModulePath("has-index-module");
        expect(result).to.eq(indexPath);

        fs.existsSync = originalExistsSync;
      });
    });
  });
});
