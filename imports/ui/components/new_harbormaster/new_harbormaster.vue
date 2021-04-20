<template>
  <div>
    <h1 class="text-5xl my-2">It's your Harbor!</h1>
    <h2 class="text-2xl my-2 px-2">It doesn't look like there are any Harbormasters yet.</h2>
    <p>You'll be made the first Harbormaster.  You can change this, and add other Harbormasters, in the <router-link class="py-1 rounded-sm" v-on:click.prevent="onClick" to="/users">Users</router-link> settings.</p>
    <button v-on:click.prevent="onClick" class="block rounded-2 my-4 acknowledge-new-harbormaster">Okay!</button>
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

<style>
.acknowledge-new-harbormaster {
  width: 100%;
  border-width: 25px;
  height: 0;
  padding: 0;
  line-height: 0;
  border-color: #0af;
  border-right-color: transparent;
  text-align: center;
}

.acknowledge-new-harbormaster:hover {
  color: #333;
  border-color: #ffae00;
  border-right-color: transparent;
}

</style>