<template>
  <div id=root-page>
    <h1 id=welcome-header class="text-4xl my-5">Welcome, <a href="/profile">{{email}}</a>!</h1>
    <div class="px-5">
      <h2 class="text-3xl my-5"><span class="font-mono">{{shipments_last_24_hours}}</span> total shipments made in the last day</h2>
      <h3 id="last-time-shipped-header">
        <a class="button hollow" :href="'/lanes/'+latest_shipment.lane+'/ship/'+latest_shipment.date" v-html="'The last shipment was '+latest_shipment.locale">
        </a>
      </h3>
      <h4>You currently have:</h4>
      <ul class="list-inside">
        <li class="my-5">
          <a href="/lanes">
          <span v-if="!$subReady.Lanes">(loading...)</span>
          <span v-else>{{total_lanes}}</span> Lanes</a>
        </li>
        <li>
          <a href="/users">
            <span v-if="!$subReady.Users">(loading...) Users</span>
            <span v-else>{{total_users}} Users, {{total_captains}} of which are Captains,
          and {{total_harbormasters}} of which are Harbormasters</span>
          </a></li>
      </ul>
      <figure id="all-charters">
        <figcaption>All Charters <span v-if="!$subReady.Lanes">(loading...)</span></figcaption>
        <svg></svg>
        <div v-if="$subReady.Lanes&& build_graph().length">
          {{svg_graph()}}
        </div>
      </figure>
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
  is_harbormaster, 
  is_captain, 
  moniker,
  svg_graph,
  collect_graph_lists,
  build_graph,
} from './lib';

export default {
  meteor: {
    $subscribe: {
      'Lanes': ['/'],
      'Users': ['/'],
    },
  
    total_lanes () { return Lanes.find().count(); },
    total_users () { return Users.find({ expired: { $not: true }}).count() },
    shipments_last_24_hours,
    latest_shipment,
    total_captains,
    total_harbormasters,
    moniker,
    email () { return H.user().emails[0].address; },
  },

  methods: {
    svg_graph,
    collect_graph_lists,
    build_graph,
    is_harbormaster,
    is_captain,
  },

  mounted () {
    Meteor.call('Shipments#get_total', (err, res) => {
      if (err) throw err;

      total_shipments.set(res);
      if (H.$('svg').length && !H.$('svg').html().length) this.svg_graph();
    });
  },

  unmounted () {
    H.simulation.stop();
  },

}
</script>

<style>
::marker {
  color: #0af;
}

a:not(.shipment-link) span {
  color: #0af;
}

a:hover span,
a span:hover {
  color: #ffae00;
}

#all-charters {
  width: 100%;
  height: 400px;
  box-shadow: 0 0 5px 0 inset black;
  border: none;
  position: relative;
  margin-top: 50px;
  border-radius: 3px;
}

#all-charters figcaption {
  text-align: left;
  position: absolute;
  background: #666;
  top: -20px;
  padding: 5px;
}

#all-charters svg {
  width: 100%;
  height: 100%;
}

#all-charters .fixed circle {
  stroke-dasharray: 5;
}

#all-charters text {
  cursor: all-scroll;
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