import {
  update_harbor,
  render_input,
  render_work_preview,
  get_constraints,
  register,
  remove,
  add_harbor_to_depot,
} from './methods';

describe('Harbors', () => {
  describe('#update_harbor', () => {
    it("calls a registered Harbor's update() method");
    it("records the Harbor's updated manifest");
    it("updates a lane's work preview");
    it("records if a Lane has no LatestShipment");
    it("returns the Lane which failed to update on failure");
    it('throws on caught errors');
  });
  describe('#render_input', () => {
    it("doesn't render input for New lanes");
    it("updates a Lane's rendered input and work preview");
    it('returns 404 for any caught errors');
  });
  describe('#render_work_preview', () => {
    it('returns 404 for an unknown harbor type');
    it('updates the rendered_work_preview for a Lane');
    it("updates a historical Shipment's rendered work preview");
    it('returns 404 for any caught errors');
  });
  describe('#get_constraints', () => {
    it("returns an object containing a Harbor's possible constraints");
  });
  describe('#register', () => {
    it("adds a registered harbor's files to the Harbors dir");
    it("removes an unregistered harbors' files from the Harbors dir");
    it("reloads the application if files were modified");
    it("returns 404 if no files were modified");
  });
  describe('#remove', () => {
    it("removes a Harbor's files from the Depot");
    it("updates the available space detected");
  });
  describe('#add_harbor_to_depot', () => {
    it("accepts only valid git urls");
    it("clones the git repo for a Harbor and scans for it");
    it("handles any caught errors");
    it("returns 200 if successful");
  });
});
