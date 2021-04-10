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
    <!-- <div v-blaze="'root'"></div> -->
  </div>
</template>

<script>
import { ReactiveVar } from 'meteor/reactive-var';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';

let total_shipments = new ReactiveVar('Loading');

export default {
  meteor: {
    $subscribe: {
      'Lanes': [],
      'Users': [],
    },
  
    shipments_last_24_hours () {
      return total_shipments.get().toLocaleString();
    },

    latest_shipment () {
      let latest_shipment = Session.get('latest_shipment') || false;

      Meteor.call('Shipments#get_latest_date', function (err, res) {
        if (err) throw err;

        res.locale = res.locale != 'never' ?
          new Date(res.locale).toLocaleString() :
          res.locale
        ;
        Session.set('latest_shipment', res);
      });

      if (! latest_shipment) return { locale: 'loading...' };

      return Session.get('latest_shipment');
    },
    
    total_lanes () {
      return Lanes.find().count().toLocaleString();
    },

    total_users () {
      return Users.find().count().toLocaleString();
    },

    total_captains () {
      var captains = [];
      var lanes = Lanes.find().fetch();

      _.each(lanes, function (lane) {
        if (lane.captains) {
          captains = captains.concat(lane.captains);
        }
      });
      return _.uniq(captains).length.toLocaleString();
    },

    total_harbormasters () {
      var harbormasters = Users.find({ harbormaster: true }).fetch();
      return harbormasters.length.toLocaleString();
    },
  },

  mounted () {
    Meteor.call('Shipments#get_total', (err, res) => {
      if (err) throw err;

      total_shipments.set(res);
    });
  }
}
</script>