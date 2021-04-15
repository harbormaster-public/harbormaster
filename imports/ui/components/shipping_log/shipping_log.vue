<template>
  <div>
    <h2>Shipping Log: Last {{shipping_log_amount_shown}} shipments</h2>
    <div v-if="!this.$subReady.Shipments">
      <li>Loading...</li>
    </div>
    <div v-else>
      <div v-if="has_work_output()">
        <ul>
          <li v-for="item in shipment_history" :key="item._id">
            <a :href="'/lanes/'+lane.slug+'/ship/'+item.start" :class="'button tiny hollow'+(active ?' active':'')+' exit-code code-'+item.exit_code">
              Shipped {{pretty_date(item.actual)}}; finished {{pretty_date(item.finished)}}; {{duration(item)}} duration
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
import { 
  get_lane,
} from '../../pages/lanes/lib/util';

const options = { sort: { actual: -1 }, limit: H.AMOUNT_SHOWN };

export default {
  meteor: {
    $subscribe: {
      'Shipments': function () {
        const { name } = this.$route.params;

        return [get_lane(name), options];
      },
    },
    lane,
    shipment_history,
  },

  methods: {
    has_work_output,
    pretty_date,
    duration,
  },

  computed: {
    shipping_log_amount_shown () {
      return H.AMOUNT_SHOWN;
    },
  },
}
</script>

<style>

</style>