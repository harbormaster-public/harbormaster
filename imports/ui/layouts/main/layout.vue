<template>
  <div id=layout class="min-h-screen">
    <div v-if="is_loaded()">
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
      <div id=global-constraints>
        {{set_constraints}}
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
  set_constraints,
} from './lib';

export default {
  meteor: {
    $subscribe: {
      'Users': [],
      'Lanes': [],
      'Harbors': [],
    },
    no_users,
    logged_in,
    no_harbormasters,
    set_constraints,
  },

  methods: {
    is_loaded,
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

@media all 
  and (min-device-width: 280px)
  and (max-device-width: 800px) {
    #router-view {
      max-width: 100%;
    }
  }
</style>