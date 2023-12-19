<template>
  <div id=primary class="min-h-screen">
    <div v-if="$subReady.Users && is_loaded">
      <div v-if="no_users" class="p-5">
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
              <footer v-if="$subReady.Lanes" class="p-2">
                <div class="mx-auto container">
                  <span id="version-text" class="my-10">v{{get_version()}}.  </span>
                  <span id="user-status">Logged in: {{email()}}, as {{role()}}.</span>
                  <span id="time-text">{{timestamp}}</span>
                </div>
              </footer>
            </div>
          </div>
        </div>
        <div v-else class="p-5">
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

import _ from 'lodash';

import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
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
      Users: [],
      Lanes: [],
    },
    no_users,
    logged_in,
    no_harbormasters,
    set_constraints,
    is_loaded,
  },

  data () {
    return {
      timestamp: '',
      timer: null,
    };
  },

  mounted () {
    this.timer = H.setInterval(this.current_time, 1000);
  },

  unmounted () {
    H.clearInterval(this.timer);
  },

  methods: {
    get_version () { return H.VERSION; },
    email () { return H.user().emails[0].address; },
    role () {
      if (Users.findOne({ _id: H.user().emails[0].address }).harbormaster) {
        return 'a Harbormaster';
      }
      const lanes_captained = Lanes.find({
        captains: { $in: [H.user().emails[0].address] },
      }).count();
      let tokened_lanes = Lanes.find({ tokens: { $exists: true }}).fetch();
      tokened_lanes = tokened_lanes.map(lane => {
        const tokens = _.invert(lane.tokens);
        if (tokens[H.user().emails[0].address]) return lane._id;
      });
      if (lanes_captained + tokened_lanes.length > 0) {
        return `Captain of ${lanes_captained + tokened_lanes.length} lanes`;
      }
      return 'a User';
    },
    current_time () {
      this.timestamp = new Date().toLocaleTimeString();
    },
  },

  components: {
    AddUser,
    Navigation,
    NewHarbormaster,
    Welcome,
  },
}
</script>

<style>
#primary {
  background-color: #333;
}

#router-view {
  background-color: #666;
  border-left: 2px solid #ffae00;
  border-right: 2px solid #0af;
  position: relative;
  padding-bottom: 50px;
}

#router-view footer {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50px;
  background: #333;
  border-top: 10px solid white;
}

#time-text {
  float: right;
}

html body * {
  color: #efefef;
}

html body a,
html body a:visited {
  color: #0af;
  border-bottom: 1px dotted #0af;
}

.container a:active {
  color: #fff;
}

html body a:visited {
  border-bottom-color: #07c;
}

html body a:hover {
  color: #ffae00;
  border-bottom: 1px dotted #ffae00;
}

@media all and (min-device-width: 280px) and (max-device-width: 800px) {
  html {
    width: 100%;
    min-width: fit-content;
  }

  #router-view {
    max-width: 100%;
  }

  html body a,
  html body a:visited {
    border-bottom: 5px dotted #0af;
  }
}
</style>