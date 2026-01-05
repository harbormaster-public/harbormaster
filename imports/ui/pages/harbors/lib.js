import is_git_url from 'is-git-url';
import { Harbors } from '../../../api/harbors';

const reload_timeout_ms = 10000;

const add_new_harbor = function (evt) {
  const url = evt?.target?.elements?.harbor_url?.value;
  let git_url_not_recognized = `The url:\n${url}\n`;
  git_url_not_recognized += "Doesn't appear to be a proper git url.";
  let warn = `This will add the following Harbor to the Depot:\n\n${url}`;
  warn += '\n\nThen the page will reload.  Ok?';

  if (!is_git_url(url)) {
    H.alert(git_url_not_recognized);
    return;
  }
  if (!H.confirm(warn)) return;

  H.call('Harbors#add_harbor_to_depot', url, (err, res) => {
    if (err) H.alert(err);
    else if (res.stderr) H.alert(res.stderr);
    else H.window.location.reload();
  });
};

const currently_registered = function () {
  return Harbors.find({ registered: true });
};

const found_in_depot = function () {
  return Harbors.find({ in_depot: true });
};

const get_space_avail = function () {
  H.call('Harbors#space_avail', (err, res) => {
    console.log(`Detected ${res} space available.`);
    this.space_avail = res;
  });
};

const registration_button_title = function (harbor) {
  return harbor.registered
    ? `Deregister "${harbor._id}"`
    : `Register "${harbor._id}"`;
};

const register = function (harbor) {
  let warn = `Confirm you want to ${
    ((harbor.registered && 'de') || '')
  }register `;
  warn += `the "${harbor._id}" harbor?`;
  warn += '\n\nThe server will restart, any unsaved work will be lost.';
  warn += '\n\nThis will force the page to reload in a few moments.';

  if (!H.confirm(warn)) return;

  H.call('Harbors#register', harbor, (err, res) => {
    let harbor_registration_error_msg = 'Error!\n\n';
    harbor_registration_error_msg += 'Check the console for details.';
    let harbor_file_not_found_msg =
      `Unable to (de)register harbor:\n\n${harbor._id}\n\n`;
    harbor_file_not_found_msg += 'Make sure the harbor file is present, ';
    harbor_file_not_found_msg += 'and named correctly.';
    if (err) {
      H.alert(harbor_registration_error_msg);
      throw err;
    }
    if (res == 404) H.alert(harbor_file_not_found_msg);
  });

  // TODO Add heartbeat check for status code, reload on 200
  if (!H.isTest) setTimeout(() => {
    console.log('Reloading...');
    H.window.location.reload();
  }, reload_timeout_ms);
};

const remove = function (harbor) {
  let warn = `Confirm you want to delete ${harbor._id} from the Depot?`;
  warn += '\n\nThis will reload the page.';

  if (!H.confirm(warn)) return;

  H.call('Harbors#remove', harbor, (err, res) => {
    if (err) H.alert(err);
    else if (res) {
      /* istanbul ignore next */
      if (!H.isTest) console.log(
        `Harbor ${harbor._id} removed, reloading.`,
      );
      H.window.location.reload();
    }
  });
};

export {
  add_new_harbor,
  currently_registered,
  found_in_depot,
  get_space_avail,
  registration_button_title,
  register,
  remove,
};


