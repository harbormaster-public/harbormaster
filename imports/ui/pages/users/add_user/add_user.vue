<template>
  <div id=add-user-page>
    <div v-if="fresh">
      <h1 class="text-7xl my-5">Welcome to Harbormaster!</h1>
      <h2 class="text-5xl my-5 px-2">You're the first user to sign in.</h2>
      <h3 class="text-4xl my-5 px-2">Harbormaster will send you a link to set your password.</h3>
      <form class="my-5 px-4" v-on:submit.prevent="on_submit()" id="new-instance">
        <label class="text-4xl">Email:
          <input v-model="invite_email" type=email required class="email-user-invite my-2" placeholder="user@example.com">
        </label>
        <button class="initial-sign-in rounded-sm block my-4">Okay!</button>
      </form>
    </div>
    <div v-else>
      <h1 class="text-5xl my-2">Invite A User</h1>
      <div v-if="is_harbormaster">
        <h2 class="text-2xl my-2 px-2">Enter a user's email address to send them
        an account setup email.</h2>
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
          <button class="block rounded-sm my-4 send-invitation">Send Invite</button>
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
  invite_email,
} from './lib';

export default {
  props: {
    fresh: Boolean,
  },

  data () {
    return {
      invite_email
    }
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
.initial-sign-in,
.send-invitation {
  height: 50px;
  line-height: 1;
  border-width: 0;
  background: #333;
  margin: 20px 0;
  position: relative;
  width: 100%;
}

.initial-sign-in:after,
.send-invitation:after {
  content: '';
  position: absolute;
  right: -2px;
  top: 0;
  border-color: transparent;
  border-right-color: #333;
  border-width: 25px;
}

.send-invitation:after {
  border-right-color: #666;
}

.send-invitation:hover,
.initial-sign-in:hover {
  color: #333;
  background: #ffae00;
}

.send-invitation:active,
.initial-sign-in:active {
  background: #fff;
}

.email-user-invite {
  width: 100%;
}

#new-instance input {
  height: 90px;
}


@media all 
  and (min-device-width: 280px)
  and (max-device-width: 800px) {

  .initial-sign-in,
  .send-invitation {
    height: 100px;
  }

  .initial-sign-in:after,
  .send-invitation:after {
    border-width: 50px;
  }
  
  #add-user-page {
    font-size: 50px;
  }

  #add-user-page h2 {
    font-size: 50px;
    line-height: 1;
  }
}
</style>