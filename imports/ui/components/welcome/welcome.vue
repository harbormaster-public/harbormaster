<template>
  <div>
    <h1 class="text-7xl my-5">Welcome to Harbormaster!</h1>
    <h2 class="text-5xl my-5 px-2">Please log in.</h2>
    <form @submit.prevent class="login-form">
      <div v-if="!this.reset && !reset_token()">
      <label class="px-2 text-4xl">Email:
        <input class="my-2" v-model=email type=email required placeholder=you@example.com>
      </label>
        <label class="px-2 text-4xl">Password:
          <input class="my-2" v-model=password type=password required>
        </label>
        <button @click="password_login" class="rounded-rm block my-5 sign-in">Sign In</button>
        <button @click="password_reset" class="rounded-rm block my-5 forgot-password">Forgot Password</button>
      </div>
      <div v-else-if="!reset_token()">
        <h3 class="text-5xl my-2 px-2">Check your email for password reset instructions.</h3>
        <button @click="password_reset" class="rounded-rm block my-5 forgot-password">Forgot Password</button>
      </div>
      <div v-else>
        <h3 class="text-5xl my-2 px-2">Enter your new password.</h3>
        <label class="px-2 text-4xl">Password:
          <input class="my-2" v-model=password type=password required>
        </label>
        <button @click="set_new_password" class="rounded-rm block my-2 forgot-password">Set New Password</button>
      </div>
    </form>
  </div>
</template>

<script>
import { Accounts } from 'meteor/accounts-base';

Accounts.onResetPasswordLink(function (token, done) {
  Session.set('password_reset_token', token);
});

export default {
  data () {
    return {
      email: '',
      password: '',
      reset: false,
    }
  },

  methods: {
    password_login: function () {
      const { email, password } = this;
      H.loginWithPassword(email, password, err => {if (err) throw err});
    },

    password_reset: function () {
      const { email, password } = this;
      this.reset = true;
      H.call('Users#reset_password', email, err => {if (err) throw err});
    },

    reset_token: function () {
      return Session.get('password_reset_token');
    },

    set_new_password: function () {
      Accounts.resetPassword(
        Session.get('password_reset_token'),
        this.password,
        err => {if (err) throw err},
      );
      Session.set('password_reset_token', null);
      this.reset = false;
    },
  }
}
</script>

<style>
.login-form input {
  width: 100%;
  height: 90px;
}

.sign-in,
.forgot-password {
  font-size: 50px;
  line-height: 1;
  height: initial;
  border-width: 0;
  background: #666;
  padding: 20px 0;
  margin: 20px 0;
  position: relative;
  text-align: center;
  display: inline-block;
  width: 100%;
}

.sign-in:hover,
.forgot-password:hover {
  color: #333;
  background: #ffae00;
}

.sign-in:after,
.forgot-password::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -1px;
  border-color: transparent;
  border-right-color: #333;
  border-width: 45px;
}

.sign-in {
  background: #0af;
}
</style>