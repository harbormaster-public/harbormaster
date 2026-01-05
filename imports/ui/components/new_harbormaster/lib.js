import { Users } from '../../../api/users';

const on_click = function () {
  // TODO: Abstract these
  let account_email = H.user().emails[0].address;
  let user = Users.findOne(account_email);
  user && (user.harbormaster = true);
  H.call('Users#update', account_email, user, (err, res) => {
    if (err) throw err;
    console.log(`User ${account_email} updated: ${res}`);
  });
};

export {
  on_click,
};


