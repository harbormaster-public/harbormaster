<template>
  <div class="row">
    <div class="small-10 small-centered column">
      <h1>It's your Harbor!</h1>
      <h2>It doesn't look like there are any Harbormasters yet.</h2>
      <p>Since it looks like you're the first one to sign up for this harbormaster instance you'll be made the first Harbormaster.  You can change this, and add other Harbormasters, in the <router-link v-on:click.prevent="onClick" to="/users">Users</router-link> settings.</p>
      <button v-on:click.prevent="onClick" class="button success large acknowledge-new-harbormaster">Okay!</button>
    </div>
  </div>
</template>

<script>
import { Users } from '../../../api/users';

export default {
  methods: {
    onClick () {
      var user_id = Meteor.user().emails[0].address;
      var user = Users.findOne(user_id);

      user.harbormaster = true;

      Meteor.call('Users#update', user_id, user, (err, res) => {
        if (err) throw err;
        console.log(`User ${user_id} updated: ${res}`);
      });
    }
  }
}
</script>