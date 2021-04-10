<template>
  <div>
    <div v-if="fresh">
      <h1>Welcome to Harbormaster!</h1>
      <h2>You're the first user to sign in.</h2>
      <h3>Please enter your email, and Harbormaster will send you a link to set your password.</h3>
      <form v-on:submit.prevent="onSubmit()" id="new-instance">
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
        <form v-on:submit.prevent="onSubmit()">
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
import { Users } from '../../../../api/users';

export default {
  $subscribe: {
    'Users': [],
  },
  props: {
    fresh: Boolean,
  },
  meteor: {
    is_harbormaster () {
      var user_id = Meteor.user() ? Meteor.user().emails[0].address: '';
      var user = Users.findOne(user_id);

      if (user && user.harbormaster) { return true; }

      return false;
    },
  },
  methods: {
    onSubmit () {
      let { 
        invite_email,
        fresh,
        $route,
        $router,
      } = this;
      
      H.call('Users#invite_user', invite_email, (err, result) => {
        const rootPath = "/";
        
        if (err) { throw err; }

        if (fresh && $route.path != rootPath) $router.push(rootPath)
        else $router.push('/users');

      });
    },
  },
}
</script>