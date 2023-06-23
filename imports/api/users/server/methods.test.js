import { resetDatabase } from "cleaner";
import ".";
import { Users } from "..";
import chai from "chai";

const { expect } = chai;
const test_email = require("faker").internet.email();

describe("Users#invite_user", function () {
  beforeEach(function () {
    resetDatabase(null);
  });

  it("creates a new User and Account", function () {
    var invited_user = H.call("Users#invite_user", test_email);
    var user = Users.findOne(test_email);
    var account = H.users.findOne({ _id: invited_user._id });

    expect(user._id).to.equal(test_email);
    expect(account._id).to.equal(invited_user._id);
    expect(account.emails[0].address).to.equal(test_email);
  });

  it("returns the user account if it already exists", function () {
    var user = Factory.create("user", { _id: test_email });
    var invited_user = H.call("Users#invite_user", test_email);
    var existing_user = Users.findOne(user._id);

    expect(invited_user._id).to.equal(user._id);
    expect(existing_user._id).to.equal(user._id);
  });

  it("returns false if no email is passed", function () {
    let results = H.call("Users#invite_user");

    expect(results).to.be.false;
  });
});

describe("Users#expire_user", () => {
  it("expires the password associated with the email given");
  it("returns the email of the account associated with the expiry");
  it("sets the user to expired status");
});

describe("Users#update", () => {
  it("updates a user by looking up their email");
});

describe("Users#reset_password", () => {
  it("returns the email of the account reset");
});
