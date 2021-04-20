<template>
  <div id=layout class="min-h-screen">
    <div v-if="is_loaded">
      <div v-if="no_users" class="container mx-auto p-2">
        <add-user v-bind:fresh="true"></add-user>
      </div>
      <div v-else>
        <div v-if="logged_in">
          <div v-if="no_harbormasters" class="container mx-auto p-2">
            <new-harbormaster></new-harbormaster>
          </div>
          <div v-else>
            <nav>
              <navigation></navigation>
            </nav>
            <div id=router-view class="container mx-auto min-h-screen p-2">
              <router-view></router-view>
            </div>
          </div>
        </div>
        <div v-else class="container mx-auto p-2">
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

import 'tailwindcss/dist/base.css';
import 'tailwindcss/dist/components.css';
import 'tailwindcss/dist/utilities.css';
import 'tailwindcss/dist/tailwind.css';

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
#layout {
  background-color: #333;
}

#router-view {
  background-color: #666;
  border-left: 2px solid #ffae00;
  border-right: 2px solid #0af;
}

* {
  color: #efefef;
}
</style>