<template>
  <div id=root-page>
    <h1 id=welcome-header class="text-5xl my-5">Welcome, {{moniker}}!</h1>
    <div class="px-5">
      <h2 class="text-3xl my-5"><span class="font-mono">{{shipments_last_24_hours}}</span> total shipments made in the last day</h2>
      <h3 id="last-time-shipped-header">
        <a class="button hollow" :href="'/lanes/'+latest_shipment.lane+'/ship/'+latest_shipment.date" v-html="'The last shipment was '+latest_shipment.locale">
        </a>
      </h3>
      <h4>You currently have:</h4>
      <ul class="list-inside">
        <li class="my-5"><a href="/lanes">{{total_lanes}} Lanes</a></li>
        <li><a href="/users">{{total_users}} Users, {{total_captains}} of which are Captains, and {{total_harbormasters}} of which are Harbormasters</a></li>
      </ul>
      <p class="text-2xl my-10">This is version {{get_version()}}.</p>
    </div>
  </div>
</template>

<script>
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import {
  shipments_last_24_hours,
  latest_shipment,
  total_captains,
  total_harbormasters,
  total_shipments,
} from './lib';

export default {
  meteor: {
    $subscribe: {
      'Lanes': [],
      'Users': [],
    },
  
    total_lanes () { return Lanes.find().count() },
    total_users () { return Users.find({ expired: { $not: true }}).count() },
    shipments_last_24_hours,
    latest_shipment,
    total_captains,
    total_harbormasters,
    moniker () {
      let user = H.user().emails[0]?.address;
      let role = 'User';
      if (this.is_harbormaster()) role = `Harbormaster`;
      if (this.is_captain()) role = `Captain`;
      return `${role}  ${user}`;
    },
  },

  methods: {
    get_version () {
      return H.VERSION;
    },

    is_harbormaster () {
      return Users.findOne({
        _id: H.user().emails[0].address
      }).harbormaster;
    },

    is_captain () {
      let lanes_captained = Lanes.find({
        captains: { $in: [H.user().emails[0].address] } 
      }).count();
      if (lanes_captained > 0) return true;
      return false;
    }
  },

  mounted () {
    Meteor.call('Shipments#get_total', (err, res) => {
      if (err) throw err;

      total_shipments.set(res);
    });
  }
}
</script>

<style>
::marker {
  color: #0af;
}


@media all 
  and (min-device-width: 280px)
  and (max-device-width: 800px) {

    #root-page h1, 
    #root-page h2,
    #root-page h3 {
      text-align: center;
    }

    #root-page h3 {
      font-size: 67px;
      line-height: 1;
    }

    #root-page h3 a {
      font-size: 67px;
      line-height: 1;
      display: block;
      margin: 20px 0;
      padding: 20px 0;
      background: #333;
      position: relative;
      border-bottom: none;
    }

    #root-page h3 a:after {
      content: '';
      position: absolute;
      right: -1px;
      top: 0;
      height: 100%;
      border-top: 1.3em solid transparent;
      border-bottom: 1.3em solid transparent;
      border-right: 1em solid #666;
      background: none;
    }

    #root-page h4,
    #root-page ul {
      font-size: 60px;
    }

    #root-page ul {
      list-style-position: inherit;
      margin-left: 50px;
    }
  }
</style>