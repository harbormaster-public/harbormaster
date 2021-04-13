<template>
  <div>
    <div v-if="is_loaded">
      <div v-if="no_users">
        <add-user v-bind:fresh="true"></add-user>
      </div>
      <div v-else>
        <div v-if="logged_in">
          <div v-if="no_harbormasters">
            <new-harbormaster></new-harbormaster>
          </div>
          <div v-else>
            <nav>
              <navigation></navigation>
            </nav>
            <div>
              <router-view></router-view>
            </div>
          </div>
        </div>
        <div v-else>
          <welcome></welcome>
        </div>
      </div>
    </div>
    <div v-else>
      <div v-blaze="'spinner'"></div>
    </div>
  </div>
</template>

<script>
import AddUser from '../../pages/users/add_user';
import Navigation from '../../components/navigation';
import NewHarbormaster from '../../components/new_harbormaster';
import Welcome from '../../components/welcome';

import {
  is_loaded,
  no_users,
  logged_in,
  no_harbormasters,
} from './lib';

const Constraints = new ReactiveVar({});

export default {
  meteor: {
    $subscribe: {
      'Users': [],
      'Lanes': [],
      'Harbors': [],
    },
    is_loaded,
    no_users,
    logged_in,
    no_harbormasters,
  },

  components: {
    AddUser,
    Navigation,
    NewHarbormaster,
    Welcome,
  }
}
</script>

<style>

</style>