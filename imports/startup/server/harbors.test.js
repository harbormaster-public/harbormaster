// import {
//   convert_bytes,
//   setup_harbor_dirs,
//   register_harbors
// } from "./harbors";

describe("Harbors startup", () => {
  describe("#convert_bytes", () => {
    it("returns a human readable size of the bytes");
  });

  describe("H.check_avail_space", () => {
    it("returns the amount of available space as a string");
  });

  describe("H.update_avail_space", () => {
    it("updates the space recorded as available");
  });

  describe("H.reload", () => {
    it("reloads if the flag to do so is true");
  });

  describe("#setup_harbor_dirs", () => {
    it("creates a new harbors dir if one is not found");
    it("creates a new depot dir if one is not found");
    it("watches the folder, recursively if possible");
  });

  describe("H.scan_depot", () => {
    it("pulls down the latest version of a git repo");
    it("logs a warning for non-git repos");
    it("updates the Harbors with the harbor added");
  });

  describe("#register_harbors", () => {
    it("loads the harbors found in the .harbors dir");
    it("throws an error if a harbor has no name for registration");
    it("scans for pre-installed dependencies");
    it("installs missing dependencies");
    it("assigns an entrypoint for the harbor");
    it("executes followup instructions for the harbor");
    it("assigns and executes harbor constraints");
    it("registers and updates the harbor");
    it("throws if a harbor is unable to register");
    it("should log at least 4 times for any harbor registered");
  });
});
