<template>
  <div>
    <router-link to="/">Overview</router-link>
    <router-link @click.native="handle_click_lanes" to="/lanes">Lanes</router-link>
    <router-link to="/users">Users</router-link>
    <router-link to="/profile">My Profile</router-link>
    <button @click="handle_click_logout" class="button logout">Logout</button>
  </div>
</template>

<script>
export default {
  methods: {
    handle_click_logout () { Accounts.logout(err => { if (err) throw err }) },
    handle_click_lanes () {
      Session.set('choose_followup', false);
      Session.set('choose_salvage_plan', false);
    },
  }
}
</script>

<style>
.menu li {
  list-style-type: none;
}

.nav-item.active {
  background: #777;
  color: #fff;
}

a:hover, .nav-item:hover {
  color: #ffae00;
}

a:active, .nav-item:active, .button.hollow:active, .admin .button:active { 
  border-color: #aa7a00;
  color: #aa7a00
}

</style>