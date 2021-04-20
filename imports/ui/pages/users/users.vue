<template>
  <div>
    <h1 class="text-5xl my-2">Users</h1>
    <a 
      v-if="is_harbormaster()" 
      href="/users/add-user" 
      class="invite-user p-2 border-2 rounded-sm my-2 block"
    >Invite User</a>
    <table v-if="this.$subReady.Users" class="users-table table-auto my-2">
      <thead>
        <tr>
          <th class="user-column">User</th>
          <th class="harbormaster-column">Harbormaster?</th>
          <th class="captained-column">Lanes Captained</th>
          <th class="user-access-column">User Access</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users()" :key="user.id">
          <td class="user-column">
            <span v-if="is_harbormaster(user)" class="user-profile-link">
              <a 
                :href="'/profile/'+user._id" 
                class="profile">{{user._id}}</a>
            </span>
            <span v-else>{{user._id}}</span>
          </td>
          <td class="harbormaster-column">
            {{is_harbormaster(user)}}
          </td>
          <td class="captained-column">
            <span class="captained-lane-list">
              {{captain_lanes()}}
            </span>
          </td>
          <td>
            <div v-if="is_harbormaster(user)" class="">
              <button @click.prevent="expire_user(user)" class="expire-user">Expire User</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else>
      Loading...
    </div>
  </div>
</template>

<script>
import { Users } from '../../../api/users';
import {
  is_harbormaster,
  captain_lanes,
  expire_user,
} from './lib';
import './users.css';

export default {
  meteor: {
    $subscribe: {
      'Users': [],
    }
  },

  methods: {
    users () { return Users.find() },
    is_harbormaster,
    captain_lanes,
    expire_user,
  }
}
</script>