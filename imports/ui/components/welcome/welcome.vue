<template>
  <div>
    <h1 class="text-5xl my-2">Welcome to Harbormaster!</h1>
    <h2 class="text-2xl my-2 px-2">Please log in.</h2>
    <form @submit.prevent class="login-form">
      <div v-if="!this.reset && !reset_token()">
      <label>Email:
        <input v-model=email type=email required placeholder=you@example.com>
      </label>
        <label>Password:
          <input v-model=password type=password required>
        </label>
        <button @click="password_login" class="rounded-rm block my-2 sign-in">Sign In</button>
        <button @click="password_reset" class="rounded-rm block my-2 forgot-password">Forgot Password</button>
      </div>
      <div v-else-if="!reset_token()">
        <h3 class="text-xl my-2 px-2">Check your email for password reset instructions.</h3>
        <button @click="password_reset" class="rounded-rm block my-2 forgot-password">Forgot Password</button>
      </div>
      <div v-else>
        <h3 class="text-xl my-2 px-2">Enter your new password.</h3>
        <label>Password:
          <input v-model=password type=password required>
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
  },

  mounted () {
    // debugger
  }
}
</script>

<style>
.login-form input {
  width: 100%;
}

.sign-in,
.forgot-password {
  width: 100%;
  border-width: 25px;
  height: 0;
  padding: 0;
  line-height: 0;
  border-color: #666;
  border-right-color: transparent;
  text-align: center;
}

.sign-in:hover,
.forgot-password:hover {
  color: #333;
  border-color: #ffae00;
  border-right-color: transparent;
}

.sign-in {
  border-color: #0af;
  border-right-color: transparent;
}
</style>