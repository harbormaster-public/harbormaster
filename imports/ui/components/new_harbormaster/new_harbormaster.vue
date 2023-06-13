<template>
  <div>
    <h1 class="text-5xl my-2">It's your Harbor!</h1>
    <h2 class="text-2xl my-2 px-2">It doesn't look like there are any Harbormasters yet.</h2>
    <p>You'll be made the first Harbormaster. You can change this, and add other Harbormasters, in the <router-link
        id="new-harbormaster-users-link" class="py-1 rounded-sm" v-on:click.prevent="on_click"
        to="/users">Users</router-link> settings.</p>
    <button v-on:click.prevent="on_click" class="block rounded-2 my-4 acknowledge-new-harbormaster">Okay!</button>
  </div>
</template>

<script>
import { Users } from '../../../api/users';

export default {
  methods: {
    on_click() {
      var user_id = H.user().emails[0].address;
      var user = Users.findOne(user_id);

      user.harbormaster = true;

      H.call('Users#update', user_id, user, (err, res) => {
        if (err) throw err;
        console.log(`User ${user_id} updated: ${res}`);
      });
    }
  }
}
</script>

<style>
.acknowledge-new-harbormaster {
  font-size: 50px;
  line-height: 1;
  height: initial;
  border-width: 0;
  background: #0af;
  padding: 20px 0;
  margin: 20px 0;
  position: relative;
  width: 100%;
  color: #fff;
}

.acknowledge-new-harbormaster:hover {
  background: #ffae00;
}

.acknowledge-new-harbormaster:after {
  content: '';
  position: absolute;
  right: -2px;
  top: 0;
  border-color: transparent;
  border-right-color: #333;
  border-width: 45px;
}

#new-harbormaster-users-link {
  background: none;
}

#new-harbormaster-users-link:hover {
  color: #ffae00;
  border-bottom-color: #ffae00;
}
</style>