<template>
  <div>
    <div v-if="fresh">
      <h1 class="text-5xl my-2">Welcome to Harbormaster!</h1>
      <h2 class="text-2xl my-2 px-2">You're the first user to sign in.</h2>
      <h3 class="text-xl my-2 px-2">Please enter your email, and Harbormaster will send you a link to set your password.</h3>
      <form class="text-2xl my-2 px-2" v-on:submit.prevent="on_submit()" id="new-instance">
        <label>Email:
          <input v-model="invite_email" type=email required class="email-user-invite" placeholder="user@example.com">
        </label>
        <button class="initial-sign-in rounded-sm block my-4">Okay!</button>
      </form>
    </div>
    <div v-else>
      <h1 class="text-5xl my-2">Invite A User</h1>
      <div v-if="is_harbormaster">
        <h2 class="text-2xl my-2 px-2">Enter a user's email address and password to setup an account for them.</h2>
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
          <button class="block rounded-sm my-4 send-invitation">Invite User</button>
        </form>
      </div>
      <div v-else>
        <h2 class="text-2xl my-2 px-2">You need to be a Harbormaster to invite users.</h2>
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

<style>
.send-invitation,
.initial-sign-in {
  width: 100%;
  border-width: 25px;
  height: 0;
  padding: 0;
  line-height: 0;
  border-color: #0af;
  border-right-color: transparent;
  text-align: center;
}

.send-invitation {
  border-color: #333;
  border-right-color: transparent;
}

.send-invitation:hover,
.initial-sign-in:hover {
  color: #333;
  border-color: #ffae00;
  border-right-color: transparent;
}

.email-user-invite {
  width: 100%;
}
</style>