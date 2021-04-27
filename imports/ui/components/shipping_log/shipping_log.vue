<template>
  <div>
    <h2 class="text-2xl my-2">Shipping Log: Last {{shipping_log_amount_shown}} shipments</h2>
    <div v-if="!is_ready()">
      <li>Loading...</li>
    </div>
    <div v-else>
      <div v-if="has_work_output()">
        <ul class="shipment-history">
          <li class="my-2" v-for="item in shipment_history" :key="item._id">
            <a 
              :href="'/lanes/'+lane.slug+'/ship/'+item.start" 
              :class="'rounded-sm px-2 py-1'+(active ?' active':'')+' exit-code code-'+item.exit_code+' shipment-link'"
            >Shipped {{pretty_date(item.actual)}}; finished {{pretty_date(item.finished)}}; {{duration(item)}} duration
            </a>
          </li>
        </ul>
      </div>
      <div v-else>
        None yet.
      </div>
    </div>
  </div>
</template>

<script>
import {
  has_work_output,
  shipment_history,
  lane,
  pretty_date,
  duration,
} from './lib';

const options = { sort: { actual: -1 }, limit: H.AMOUNT_SHOWN };

export default {
  meteor: {
    $subscribe: {
      'Shipments': function () {
        const { slug } = this.$route.params;
        
        return [{ slug }, options];
      },
      'Lanes': function () { return [this.$route.params.slug] },
    },
    lane,
    shipment_history,
  },

  methods: {
    has_work_output,
    pretty_date,
    duration,
    is_ready () {
      return (
        this.$subReady.Shipments &&
        this.$subReady.Lanes
      );
    },
  },

  computed: {
    shipping_log_amount_shown () {
      return H.AMOUNT_SHOWN;
    },
  },
}
</script>

<style>
.shipment-history .shipment-link:hover {
  color: #ffae00;
}

.shipment-history li {
  list-style-type: none;
  position: relative;
}

.shipment-link.exit-code:before {
  content: '⚠';
}

.shipment-link.code-0:before {
  content: '✔';
}

.shipment-link.code-1:before {
  content: '❌';
}

.shipment-link:before {
  position: absolute;
  left: -25px;
}
</style>