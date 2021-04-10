<template>
  <div>
    <form v-if="this.$subReady.Users && this.$subReady.Lanes">
      <h1><span>User ID:</span> <span>{{user_email()}}</span></h1>
      <fieldset class="fieldset">
        <label>Harbormaster
          <input 
            class="is-harbormaster" 
            :disabled="not_harbormaster()" 
            type=checkbox 
            :checked="is_harbormaster()"
            @change="handle_change_is_harbormaster"
          >
        </label>
        <label>Captain
          <input 
            class="is-captain" 
            disabled 
            type=checkbox 
            :checked="is_captain()"
          >
        </label>
      </fieldset>
      <h2>Lanes</h2>
        <div :key="lane_list_renders">
        <ul class="lane-list" v-for="lane in lanes()" :key="lane.render">
            <li>
              <label>
                <input 
                  :data-lane-id="lane._id"
                  class="can-ply-lane" 
                  :disabled="can_change_plying(lane)"
                  type=checkbox 
                  :checked="can_ply(lane)"
                  @change="handle_change_can_ply"
                >
                {{lane.name}}
              </label>
              <br>
              <label>
                <input 
                  :data-lane-id="lane._id"
                  class="from-webhook" 
                  :disabled="can_change_webhook()"
                  type=checkbox 
                  :checked="webhook_allowed(lane)"
                  :value="webhook_token(lane)"
                  @change="handle_change_from_webhook($event, lane)"
                >
                Webhook allowed?
                &nbsp;
              <span v-if="webhook_allowed(lane)">Token: <code>{{webhook_token(lane)}}</code></span>
              </label>
            </li>
        </ul>
        </div>
    </form>
  </div>
</template>

<script>
import { Users } from '../../../api/users';
import { Lanes } from '../../../api/lanes';

const get_user_id = function (scope) {
  
  return scope.$route.params.user_id || H.user().emails[0].address;
};

export default {
  meteor: {
    $subscribe: {
      'Users': [],
      'Lanes': [],
    }
  },

  data () {
    return {
      lane_list_renders: 0,
    };
  },

  methods: {
    render_lane_list () {
      this.lane_list_renders += 1;
    },

    handle_change_from_webhook (event, lane) {
      var lane_id = $(event.target).attr('data-lane-id');
      var user_id = get_user_id(this);
      let remove_token;
      const {render_lane_list} = this;

      if (event.target.checked) {
        remove_token = false;
      }
      else {
        remove_token = true;
      }
      
      Meteor.call(
        'Lanes#update_webhook_token',
        lane_id, user_id, remove_token,
        function (err) {
        if (err) throw err;
        render_lane_list()
      });
    },

    handle_change_can_ply (event) {
      var lane_id = $(event.target).attr('data-lane-id');
      var user_id = get_user_id(this);
      var lane = Lanes.findOne(lane_id);

      lane.captains = lane.captains || [];

      if (event.target.checked) {
        lane.captains.push(user_id);
      }
      else {
        lane.captains = _.reject(lane.captains, function (captain) {
          return captain == user_id;
        });
      }

      H.call('Lanes#upsert', lane, (err, res) => {
        console.log(`Lane "${lane.name}" updated: ${res}`);
      });
    },

    handle_change_is_harbormaster (event) {
      var user_id = get_user_id(this);
      var user = Users.findOne(user_id);

      user.harbormaster = event.target.checked;

      return H.call('Users#update', user_id, user, (err, res) => {
        console.log(`User ${user_id} updated: ${res}`);
        return res;
      });
    },

    user_email () {
      var user_id = get_user_id(this);
      var user = Users.findOne(user_id);
      
      return user ? user._id : '';
    },

    is_harbormaster () {
      var user_id = get_user_id(this);
      var user = Users.findOne(user_id);

      return user ? user.harbormaster : '';
    },

    not_harbormaster () {
      var user_id = get_user_id(this);
      var current_user = H.user().emails[0].address;
      var user = Users.findOne(user_id);
      var current_harbormaster = Users.findOne(current_user) ?
        Users.findOne(current_user).harbormaster :
        false
      ;

      if (current_harbormaster) { return false; }

      return user ? ! user.harbormaster : true;
    },

    is_captain () {
      var user_id = get_user_id(this);
      var user = Users.findOne(user_id);
      var pliable_lanes = user ?
        Lanes.find({ captains: { $in: [user._id] } }).fetch() :
        []
      ;

      return pliable_lanes.length ? true : false;
    },

    lanes () {
      var lanes = Lanes.find();

      return lanes;
    },

    can_ply (lane) {
      var user_id = get_user_id(this);
      var user = Users.findOne(user_id);

      if (user && user.harbormaster) { return true; }
      if (lane.captains) {
        let can_ply = _.contains(lane.captains, user_id);

        return can_ply;
      }

      return false;
    },

    can_change_plying () {
      var user_id = get_user_id(this);
      var current_user = H.user().emails[0].address;
      var user = Users.findOne(user_id);
      var current_harbormaster = Users.findOne(current_user) ?
        Users.findOne(current_user).harbormaster :
        false
      ;

      if (user_id == current_user || user && user.harbormaster) { return true; }

      if (current_harbormaster) { return false; }

      if (! user || ! user.harbormaster) { return true; }
    },

    can_change_webhook () {
      var current_user = H.user().emails[0].address;
      var current_harbormaster = Users.findOne(current_user) ?
        Users.findOne(current_user).harbormaster :
        false
      ;

      return ! current_harbormaster;
    },

    webhook_allowed (lane) {
      var user_id = get_user_id(this);
      
      if (! lane?.tokens) { return false; }

      return _.find(lane.tokens, function (tokens) {
        return tokens == user_id;
      });
    },

    webhook_token (lane) {
      var user_id = get_user_id(this);

      if (! lane?.tokens) { return ''; }

      const token = _.invert(lane.tokens)[user_id];

      return token;
    }
  },
}
</script>

<style>
.lane-list li {
  border: 1px solid transparent;
}

.lane-list li:nth-child(even) {
  background-color: #dfdfdf;
  border-color: #d1d1d1;
}

</style>