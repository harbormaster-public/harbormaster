<template>
  <div>
    <h1>Lanes</h1>
    <router-link 
      to="/lanes/new/edit" 
      class="hollow button" 
      id="new-lane"
      @click="set_new_lane"
      >New Lane</router-link>
    <table class="lanes-table">
      <thead>
        <tr>
          <th @click="sort_by_header" :class="'name-header name-column '+active('name')" data-value=name>Name</th>
          <th @click="sort_by_header" :class="'captains-column captains-header '+active('captains')" data-value=captains>Captains</th>
          <th @click="sort_by_header" :class="'type-header type-column '+active('type')" data-value=type>Type</th>
          <th @click="sort_by_header" :class="'last-shipped-header last-shipped-column '+active('shipped')" data-value=shipped>Last Shipped</th>
          <th @click="sort_by_header" :class="'total-shipments-column total-shipments-header '+active('shipments')" data-value=shipments>Total Completed Shipments</th>
          <th @click="sort_by_header" :class="'salvage-runs-column total-salvage-runs-header '+active('salvage-runs')" data-value=salvage-runs>Total Salvage Runs</th>
          <th @click="sort_by_header" class="current-state-header current-state-column" disabled>Current State</th>
          <th @click="sort_by_header" class="followup-header followup-column" disabled>Followup</th>
          <th @click="sort_by_header" class="salvage-plan-header salvage-plan-column" disabled>Salvage Plan</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading_lanes" class="loading-text">
          <td colspan=9>Loading...</td>
        </tr>

        <tr v-else-if="empty" class="empty">
          <td colspan=9>No lanes found.  <router-link to="/lanes/new/edit">Create the first.</router-link></td>
        </tr>

        <tr 
          v-else-if="ready()" 
          v-for="lane in lanes" 
          :key="lane.id"
        >
          <td class="name-column">
              <span v-if="can_ply(lane)" class="admin collapsed">
                <router-link :to="'/lanes/'+lane.slug+'/charter'" class="button info tiny charter">Charter</router-link>
                <router-link :to="'/lanes/'+lane.slug+'/ship'" class="button tiny success ship-lane">Ship</router-link>
                <router-link :to="'/lanes/'+lane.slug+'/edit'" class="button tiny secondary edit-lane">Edit</router-link>
                <button @click="delete_lane($event, lane)" class="button tiny warning delete-lane">Delete</button>
              </span>
            <span class="name">{{lane.name}}</span>
          </td>
          <td class="captains-column">{{total_captains(lane)}}</td>
          <td class="type-column">{{lane.type}}</td>
          <td class="last-shipped-column" width=125><router-link :to="'/lanes/'+lane.slug+'/ship/'+latest_shipment(lane)">{{last_shipped(lane)}}</router-link></td>
          <td class="total-shipments-column">{{total_shipments(lane)}}</td>
          <td class="salvage-runs-column">{{total_salvage_runs(lane)}}</td>
          <td :class="'current-state-column '+current_state(lane)">{{current_state(lane)}}</td>
          <td class="followup-column">{{followup_name(lane)}}</td>
          <td class="salvage-plan-column">{{salvage_plan_name(lane)}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script>
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';
import { ShipmentCount } from '../../../api/shipments';
import { SalvageCount } from '../../../api/shipments';
import { LatestShipment } from '../../../api/shipments';

let options = {
  sort: { actual: -1 },
};

let lane_ids = new ReactiveVar([]);

Lanes.find().forEach(lane => {
  lane_ids.push(lane._id);
});

export default {
  meteor: {
    $subscribe: {
      'ShipmentCount': [],
      'SalvageCount': [],
      'LatestShipment': [],
      'Shipments': [lane_ids, options],
    },

    empty () {
      return (
        Session.get('total_lanes') === 0 && ! Lanes.find().count()
      );
    },

    lanes () {
      let lanes;
      let sort_by = Session.get('lanes_table_sort_by');
      let reverse = Session.get('lanes_table_sort_reverse') ? -1 : 1;

      //TODO: modularize
      switch (sort_by) {
        case 'name':
          lanes = Lanes.find({}, { sort: { name: reverse } });
          break;
        case 'captains':
          lanes = Lanes.find({}, { sort: { captains: -reverse } });
          break;
        case 'type':
          lanes = Lanes.find({}, { sort: { type: reverse } });
          break;
        case 'shipped':
          lanes = Lanes.find({}, {
            sort: function (lane1, lane2) {
              let lane1_shipments = Shipments.find({ lane: lane1._id }).fetch();
              let lane2_shipments = Shipments.find({ lane: lane2._id }).fetch();

              let lane1_date = lane1_shipments.length ?
                lane1_shipments[lane1_shipments.length - 1].actual :
                0
              ;
              let lane2_date = lane2_shipments.length ?
                lane2_shipments[lane2_shipments.length - 1].actual :
                0
              ;
              let sort_order = 0;

              if (lane1_date > lane2_date) { sort_order = -1; }
              else if (lane1_date < lane2_date) { sort_order = 1; }

              if (reverse == -1) { sort_order = -sort_order; }
              return sort_order;
            },
          });
          break;
        case 'shipments':
          lanes = Lanes.find({}, {
            sort: function (lane1, lane2) {
              let lane1_shipments = Shipments.find({ lane: lane1._id }).fetch();
              let lane2_shipments = Shipments.find({ lane: lane2._id }).fetch();
              let sort_order = 0;

              if (lane1_shipments.length > lane2_shipments.length) {
                sort_order = -1;
              }
              else if (lane1_shipments.length < lane2_shipments.length) {
              sort_order = 1;
              }

              if (reverse == -1) { sort_order = -sort_order; }
              return sort_order;
            },
          });
          break;
        case 'salvage-runs':
          lanes = Lanes.find({}, {
            sort: function (lane1, lane2) {
              let lane1_shipments = Shipments.find({
                lane: lane1._id,
                exit_code: { $ne: 0 },
              }).fetch();
              let lane2_shipments = Shipments.find({
                lane: lane2._id,
                exit_code: { $ne: 0 },
              }).fetch();
              let sort_order = 0;

              if (lane1_shipments.length > lane2_shipments.length) {
                sort_order = -1;
              }
              else if (lane1_shipments.length < lane2_shipments.length) {
              sort_order = 1;
              }

              if (reverse == -1) { sort_order = -sort_order; }
              return sort_order;
            },
          });
          break;
        default:
          lanes = Lanes.find();
          break;
      }
      
      return lanes;
    },

    loading_lanes () {
      let total = Session.get('total_lanes');
      let current = Lanes.find().count();

      if (total !== 0 && ! total || current < total) return true;

      return false;
    },

  },

  methods: {
    sort_by_header (event) {
      //TODO: revisit this sorting
      let sort_value = $(event.target).attr('data-value');

      $(event.target).siblings('.active')
        .removeClass('active')
        .removeClass('reverse')
      ;
      $(event.target).addClass('active');

      if (
        sort_value == Session.get('lanes_table_sort_by') &&
        !Session.get('lanes_table_sort_reverse')
      ) {
        Session.set('lanes_table_sort_reverse', true);
        $(event.target).addClass('reverse');
      }
      else if (Session.get('lanes_table_sort_reverse')) {
        Session.set('lanes_table_sort_reverse', false);
        $(event.target).removeClass('reverse');
      }

      Session.set('lanes_table_sort_by', sort_value);
    },

    delete_lane (event, lane) {
      let confirm_message = `Delete lane?\n${lane.name}`;
      let $row = $(event.target).parents('tr');

      if (window.confirm(confirm_message)) {
        $row.addClass('deleting');
        H.call('Lanes#delete', lane, (err, res) => {
          if (err) throw err;
          Session.set('total_lanes', res);
        });
      }
    },

    set_new_lane () {
      Session.set('lane', null);
    },

    ready () {
      if (
        this.$subReady.ShipmentCount && 
        this.$subReady.LatestShipment &&
        this.$subReady.SalvageCount &&
        this.$subReady.Shipments
      ) return true;
      return false;
    },

    active (header) {
      let active_string = '';

      if (header == Session.get('lanes_table_sort_by')) {
        active_string += 'active';
      }

      if (Session.get('lanes_table_sort_reverse')) {
        active_string += ' reverse';
      }

      return active_string;
    },

    can_ply (lane) {
      var user = Users.findOne(Meteor.user().emails[0].address);
      if (user && user.harbormaster) {
        return true;
      }

      if (lane?.captains && lane?.captains.length) {
        let captain = _.find(lane.captains, function (email) {
          return email == Meteor.user().emails[0].address;
        });

        return captain ? true : false;
      }

      return false;
    },

    current_state (lane) {
      const text_na = 'N/A';
      const text_error = 'error';
      const text_ready = 'ready';
      let latest = LatestShipment.findOne(lane?._id);
      let active_shipments = Shipments.find({
        lane: lane?._id,
        active: true,
      }).count();

      if (active_shipments) return 'active';

      if (latest && latest.shipment.exit_code) return text_error;
      if (latest && latest.shipment.exit_code == 0) return text_ready;

      return text_na;
    },

    followup_name (lane) {
      let followup = Lanes.findOne(lane?.followup);

      return followup ? followup.name : '';
    },

    last_shipped (lane) {
      const latest = LatestShipment.findOne(lane._id);
      const actual = latest ? latest.shipment.actual : 'Loading...';

      return actual.toLocaleString();
    },

    latest_shipment (lane) {
      const latest = LatestShipment.findOne(lane._id);
      const start = latest ? latest.shipment.start : '';

      return start;
    },

    salvage_plan_name (lane) {
      let salvage_plan = Lanes.findOne(lane.salvage_plan);

      return salvage_plan ? salvage_plan.name : '';
    },

    total_captains (lane) {
      if (! lane.captains) {
        return 0;
      }

      return lane.captains.length;
    },

    total_shipments (lane) {
      const count = ShipmentCount.findOne(lane._id);
      const total = count ? count.count : 'Loading...';
      // debugger
      return total.toLocaleString();
    },

    total_salvage_runs (lane) {
      const count = SalvageCount.findOne(lane._id);
      const total = count ? count.count : 'Loading...';

      return total.toLocaleString();
    },

    total_stops (lane) {
      var stops = 0;

      _.each(lane.destinations, function (destination) {
        stops += destination.stops.length;
      });

      return stops;
    },
  },

  mounted () {
    Meteor.call('Lanes#get_total', (err, res) => {
      if (err) throw err;

      Session.set('total_lanes', res);
      Session.set('lane', null);
      Session.set('validating_fields', false);
      Session.set('choose_type', false);
    });
  },
}
</script>

<style>
  th, td {
    border: 1px solid lightgrey;
    white-space: nowrap;
  }

  th {
    cursor: pointer;
  }

  /* table tbody tr:nth-child(even) {
  background-color: #dfdfdf;
}

.last-shipped-header {
  width: 210px;
}

.lanes-table th {
  cursor: pointer;
}

.lanes-table th.current-state-header,
.lanes-table th.followup-header,
.lanes-table th.salvage-plan-header {
  cursor: default;
}

.lanes-table {
  position: relative;
  margin-top: 40px
}

.lanes-table th.active {
  background: #0af;
  position: relative;
  color: #fff;
}

.lanes-table th.active::after {
  content: 'v';
  color: #fff;
  position: absolute;
  bottom: -5px;
  left: 50%;
  margin-left: -4px;
}

.lanes-table th.active.reverse:after {
  content: '^';
  color: #fff;
  position: absolute;
  top: 0;
  left: 50%;
  font-size: 18px;
  margin-left: -4px;
  margin-top: -2px;
}

.admin .button {
  position: absolute;
}

.admin .charter {
  left: -108px;
}

.admin .ship-lane {
  left: -50px;
}

.admin .edit-lane {
  left: 100%;
  margin-left: 10px;
}

.admin .delete-lane {
  left: 100%;
  margin-left: 55px;
}

td.active {
  color: darkgoldenrod;
}

td.ready {
  color: green;
}

td.error {
  color: red;
}

.loading-text {
  background: #ffae00;
}

tr.deleting {
  background: #f0a;
  opacity: 0.5;
}

tr.deleting .admin {
  display: none;
}

@media all and (max-width: 1200px) {
  .total-shipments-column,
  .salvage-runs-column,
  .type-column,
  .current-state-column,
  .followup-column,
  .salvage-plan-column,
  .captains-column {
    display: none;
  }

  .lanes-table {
    position: absolute;
    margin: 40px -30px 0;
  }

  .lanes-table td {
    font-size: 1.5625rem;
    padding-bottom: 1rem;
    position: relative;
  }

  .lanes-table .admin {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    bottom: 37px;
  }

  .lanes-table .admin:after {
    content: '⚙';
    position: absolute;
    left: 0;
    top: 0;
    font-size: 1rem;
    color: #ffae00;
    line-height: 1;
    height: 50px;
    width: 100%;
    cursor: pointer;
    padding: 10px;
  }

  .lanes-table .admin:hover:after {
    color: #aa7a00;
  }

  .lanes-table .admin.collapsed:after {
    color: #2199e8;
    text-align: left;
    bottom: 0;
    top: initial;
    content: '☰';
  }

  .lanes-table .admin.collapsed:hover:after {
    color: #1766c3;
  }

  .lanes-table .admin.collapsed .button {
    display: none;
  }

  .lanes-table .admin .button {
    margin: 0;
    width: 25%;
    font-size: 1rem;
    padding: 20px 0;
    bottom: 0;
  }

  .admin .charter {
    left: 0;
  }

  .admin .ship-lane {
    left: 25%;
  }

  .admin .edit-lane {
    left: 50%;
  }

  .lanes-table .admin .delete-lane {
    left: 75%;
  }
} */

</style>