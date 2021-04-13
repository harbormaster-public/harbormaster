<template>
  <div>
    <h1>Users</h1>
    <table v-if="this.$subReady.Users" class="users-table">
      <thead>
        <tr>
          <th class="user-column">User</th>
          <th class="harbormaster-column">Harbormaster?</th>
          <th class="captained-column">Lanes Captained</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users()" :key="user.id">
          <td class="user-column">
            <span v-if="is_harbormaster(user)" class="admin">
              <a :href="'/profile/'+user._id" class="button hollow tiny secondary profile">Edit User</a>
            </span>
            {{user._id}}
          </td>
          <td class="harbormaster-column">
            {{is_harbormaster(user)}}
          </td>
          <td class="captained-column">
            <span class="captained-lane-list">
              {{captain_lanes()}}
            </span>
            <div v-if="is_harbormaster(user)" class="admin">
              <button @click.prevent="expire_user(user)" class="button hollow tiny alert expire-user">Expire User</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <a v-if="is_harbormaster()" href="/users/add-user" class="button hollow invite-user">Invite User</a>
  </div>
</template>

<script>
import { Users } from '../../../api/users';
import {
  is_harbormaster,
  captain_lanes,
  expire_user,
} from './lib';
// import './users.css';

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