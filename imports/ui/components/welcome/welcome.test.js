// import methods from './welcome.vue';

// const {
//   methods: {
//     password_login,
//     password_reset,
//     reset_token,
//     set_new_password,
//   },
// } = methods;

describe('Welcome Component', () => {
  describe('#password_login', () => {
    it('attempts to login with email and password');
  });

  describe('#password_reset', () => {
    it('sets the reset property to true on the view');
    it('resets the user passsword');
  });

  describe('#reset_token', () => {
    it('returns the password_reset_token from the Session');
  });

  describe('#set_new_password', () => {
    it('sets the password_reset_token to null');
    it('sets the reset property to false on the view');
  });
});
