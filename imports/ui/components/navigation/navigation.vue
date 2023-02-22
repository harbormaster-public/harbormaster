<template>
  <div id=navigation>
    <div class="container mx-auto pt-2">
      <ul class=menu>
        <li>
          <router-link 
            class="p-2 border-2 inline-block rounded-sm nav-item"
            to="/">Overview</router-link>
        </li>
        <li>
          <router-link 
            class="p-2 border-2 inline-block rounded-sm nav-item"
            @click.native="handle_click_lanes" to="/lanes">Lanes</router-link>
        </li>
        <li>
          <router-link 
            class="p-2 border-2 inline-block rounded-sm nav-item"
            @click.native="handle_click_lanes" to="/harbors">Harbors</router-link>
        </li>
        <li>
          <router-link 
            class="p-2 border-2 inline-block rounded-sm nav-item"
            to="/users">Users</router-link>
        </li>
        <li>
          <router-link 
            class="p-2 border-2 my-auto inline-block rounded-sm nav-item"
            to="/profile">My Profile</router-link>
        </li>
        <li class="float-right">
          <button
            @click="handle_click_logout" 
            class="logout p-2 border-2 rounded-sm nav-item"
          >Logout
          </button>
        </li>
      </ul>
    </div>
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
#navigation .menu {
  margin: 0;
  display: block;
  padding: 0;
}

.menu li {
  list-style-type: none;
  display: inline-block;
  margin: 0;
}

.menu .nav-item {
  border-color: #fff;
  border-bottom-color: transparent;
  color: #fff;
  border-width: 2px;
  border-style: solid;
}

.nav-item.logout {
  background: none;
}

a:hover, .nav-item:hover {
  color: #ffae00;
  border-color: #ffae00;
  border-bottom-color: transparent;
  background-color: #666;
}

.router-link-exact-active,
.router-link-exact-active:visited {
  background: #fff;
  border-color: #07c;
  color: #07c;
}

.container .nav-item:active, 
.admin .button:active { 
  border-color: #aa7a00;
  border-bottom-color: transparent;
  color: #aa7a00;
}

#navigation {
  background-color: #0af;
  border-bottom: 10px solid #fff;
}

@media all 
  and (min-device-width: 280px)
  and (max-device-width: 800px) {
    #navigation .container {
      max-width: 100%;
      font-size: 40px;
      margin-bottom: -2px;
    }

    .menu .nav-item {
      border-width: 5px;
      border-top-width: 10px;
      margin-top: -10px;
      margin-left: -5px;
    }
}
</style>