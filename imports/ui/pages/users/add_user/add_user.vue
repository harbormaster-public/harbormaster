<template>
  <div>
    <div v-if="fresh">
      <h1>Welcome to Harbormaster!</h1>
      <h2>You're the first user to sign in.</h2>
      <h3>Please enter your email, and Harbormaster will send you a link to set your password.</h3>
      <form v-on:submit.prevent="on_submit()" id="new-instance">
        <label>Email:
          <input v-model="invite_email" type=email required class="email-user-invite" placeholder="user@example.com">
        </label>
        <button class="button initial-sign-in">Okay!</button>
      </form>
    </div>
    <div v-else>
      <h1>Invite A User</h1>
      <div v-if="is_harbormaster">
        <h2>Enter a user's email address and password to setup an account for them.</h2>
        <form v-on:submit.prevent="on_submit()">
          <label>Email:
            <input 
            type=email 
            required 
            class="email-user-invite" 
            placeholder="user@example.com"
            v-model="invite_email"
          >
          </label>
          <button class="button send-invitation">Invite User</button>
        </form>
      </div>
      <div v-else>
        <h2>You need to be a Harbormaster to invite users.</h2>
      </div>
    </div>
  </div>
</template>

<script>
import {
  is_harbormaster,
  on_submit,
} from './lib';

export default {
  props: {
    fresh: Boolean,
  },
  meteor: {
    $subscribe: {
      'Users': [],
    },
    is_harbormaster,
  },
  methods: {
    on_submit,
  },
}
</script>