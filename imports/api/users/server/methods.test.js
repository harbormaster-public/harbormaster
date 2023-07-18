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

    expect(results).to.eq(false);
  });
});

describe("Users#expire_user", () => {
  const accounts_find_user_by_email = Accounts.findUserByEmail;
  const accounts_set_password = Accounts.setPassword;
  beforeEach(() => {
    resetDatabase(null);
    Accounts.findUserByEmail = () => ({ _id: '' });
    Accounts.setPassword = () => { };
  });
  afterEach(() => {
    Accounts.findUserByEmail = accounts_find_user_by_email;
    Accounts.setPassword = accounts_set_password;
  });

  it("expires the password associated with the email given", () => {
    Accounts.setPassword = (id, password) => {
      expect(typeof password).to.eq('string');
    };
    H.call('Users#expire_user', 'test@harbormaster.io');
  });
  it("returns the email of the account associated with the expiry", () => {
    expect(H.call('Users#expire_user', 'test@harbormaster.io'))
      .to
      .eq('test@harbormaster.io');
  });
  it("sets the user to expired status", () => {
    Factory.create('user', { _id: 'test@harbormaster.io' });
    H.call('Users#expire_user', 'test@harbormaster.io');
    expect(Users.findOne('test@harbormaster.io').expired).to.eq(true);
  });
});

describe("Users#update", () => {
  it("updates a user by looking up their email", () => {
    const users_update = Users.update;
    Users.update = (email) => expect(email).to.eq('test@harbormaster.io');
    resetDatabase(null);
    Factory.create('user');
    expect(H.call('Users#update', 'test@harbormaster.io', {})).to.eq(true);
    Users.update = users_update;
  });
});

describe("Users#reset_password", () => {
  it("returns the email of the account reset", () => {
    expect(H.call('Users#reset_password', 'test@harbormaster.io'))
      .to
      .eq('test@harbormaster.io');
  });
});
