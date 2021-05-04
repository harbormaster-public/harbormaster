<template>
  <div id=profile-page>
    <h1 class="text-5xl my-2"><span>User ID:</span> <span>{{user_email()}}</span></h1>
    <form class="fieldset px-5" v-if="this.$subReady.Users && this.$subReady.Lanes">
      <fieldset>
        <label>Harbormaster?
          <input 
            class="is-harbormaster" 
            :disabled="not_harbormaster()" 
            type=checkbox 
            :checked="is_harbormaster()"
            @change="handle_change_is_harbormaster"
          >
        </label>&nbsp;
        <label>Captain?
          <input 
            class="is-captain" 
            disabled 
            type=checkbox 
            :checked="is_harbormaster() || is_captain()"
          >
        </label>
      </fieldset>
      <h2 class="text-2xl my-2">Lanes</h2>
      <div :key="lane_list_renders">
        <ul class="lane-list" v-for="lane in lanes()" :key="lane.name">
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
              </label>
              <span v-if="webhook_allowed(lane)">Token: </span><code>{{webhook_token(lane)}}</code>
            </li>
        </ul>
      </div>
    </form>
  </div>
</template>

<script>
import { Lanes } from '../../../api/lanes';
import {
  handle_change_from_webhook,
  handle_change_can_ply,
  handle_change_is_harbormaster,
  user_email,
  is_harbormaster,
  not_harbormaster,
  is_captain,
  can_ply,
  can_change_plying,
  can_change_webhook,
  webhook_allowed,
  webhook_token,
} from './lib';
import './profile.css';

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
    lanes () { return Lanes.find() },
    render_lane_list () { this.lane_list_renders += 1 },
    handle_change_from_webhook,
    handle_change_can_ply,
    handle_change_is_harbormaster,
    user_email,
    is_harbormaster,
    not_harbormaster,
    is_captain,
    can_ply,
    can_change_plying,
    can_change_webhook,
    webhook_allowed,
    webhook_token,
  },
}
</script>