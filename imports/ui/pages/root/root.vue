<template>
  <div>
    <h1>Welcome to your Harbor</h1>
    <h2>{{shipments_last_24_hours}} total shipments made in the last day</h2>
    <h3 id="last-time-shipped-header">
      <a class="button hollow" :href="'/lanes/'+latest_shipment.lane+'/ship/'+latest_shipment.date">
        <span class="last-shipped-text">The last shipment was</span> <span class="last-shipped-date">{{latest_shipment.locale}}</span>
      </a>
    </h3>
    <h4>You currently have:</h4>
    <ul>
      <li><a href="/lanes">{{total_lanes}} Lanes</a></li>
      <li><a href="/users">{{total_users}} Users, {{total_captains}} of which are Captains, and {{total_harbormasters}} of which are Harbormasters</a></li>
    </ul>
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