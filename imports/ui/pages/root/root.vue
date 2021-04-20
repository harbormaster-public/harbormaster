<template>
  <div>
    <h1 class="text-5xl my-2">Welcome to your Harbor</h1>
    <div class="px-5">
      <h2 class="text-2xl my-2"><span class="font-mono">{{shipments_last_24_hours}}</span> total shipments made in the last day</h2>
      <h3 id="last-time-shipped-header">
        <a class="button hollow" :href="'/lanes/'+latest_shipment.lane+'/ship/'+latest_shipment.date" v-html="'The last shipment was '+latest_shipment.locale">
        </a>
      </h3>
      <h4>You currently have:</h4>
      <ul class="list-inside">
        <li><a href="/lanes">{{total_lanes}} Lanes</a></li>
        <li><a href="/users">{{total_users}} Users, {{total_captains}} of which are Captains, and {{total_harbormasters}} of which are Harbormasters</a></li>
      </ul>
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
  
    total_lanes () { return Lanes.find().count().toLocaleString() },
    total_users () { return Users.find().count().toLocaleString() },
    shipments_last_24_hours,
    latest_shipment,
    total_captains,
    total_harbormasters,
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
#last-time-shipped-header a:hover {
  color: #ffae00;
}

::marker {
  color: #0af;
}
</style>