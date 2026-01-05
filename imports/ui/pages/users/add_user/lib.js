import { Users } from '../../../../api/users';

const is_harbormaster = async function () {
  var user_id = H.user() && H.user().emails[0].address;
  var user = await Users.findOneAsync(user_id);

  if (user && user.harbormaster) { return true; }

  return false;
};

let invite_email;

const on_submit = function () {
  let {
    fresh,
    $router,
  } = this;
  invite_email = this.invite_email;
  const invite_password = this.invite_password;

  // For the first user, pass password directly to avoid email flow
  const params = fresh && invite_password ?
    [invite_email, invite_password] :
    [invite_email]
    ;

  H.call('Users#invite_user', ...params, (err, result) => {
    const rootPath = "/";
    const safePush = (path) => {
      // Avoid Vue Router NavigationDuplicated errors by only pushing when
      // needed.
      if (!$router || typeof $router.push !== 'function') return;
      if ($router.currentRoute && $router.currentRoute.path === path) return;

      const maybePromise = $router.push(path);
      // Vue Router v3 returns a Promise; suppress NavigationDuplicated
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    };

    /* istanbul ignore next */
    if (err) {
      throw err;
    }

    const dest = fresh ? rootPath : '/users';
    if (fresh && invite_password) {
      H.loginWithPassword(invite_email, invite_password, () => safePush(dest));
    }
    else {
      safePush(dest);
    }

    return result;
  });
};

export {
  is_harbormaster,
  on_submit,
  invite_email,
};
