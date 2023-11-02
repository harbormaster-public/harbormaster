<template>
  <div class="shipping-log">
    <h2 class="text-2xl my-2">Shipping Log: showing {{skip + 1}}-{{skip +
    shipping_log_amount_shown}}
    of {{lane.shipment_count}} shipments by date
    </h2>
    <button
      id="paginator-prev"
      class="rounded-sm inline-block ml-2 px-2 shipping-log-paginator paginator-prev"
      @click="handle_paginator"
      :disabled="!can_paginate_prev"
    >Prev</button>
    <button
      id="paginator-next"
      class="rounded-sm inline-block pl-2 pr-6 shipping-log-paginator paginator-next"
      @click="handle_paginator"
      :disabled="!can_paginate_next"
    >Next</button>
    <span class="loading-shipments"
    v-if="!is_ready()">Loading...</span>
    <div v-if="has_work_output()">
      <ul class="shipment-history">
        <li v-for="item in shipment_history" :key="item._id">
          <a 
            :href="'/lanes/'+lane.slug+'/ship/'+item.start" 
            :class="'rounded-sm px-2 py-1'+(active ?' active':'')+' exit-code code-'+item.exit_code+' shipment-link'"
          >
            <span>Shipped {{pretty_date(item.actual)}};</span>
            <span> finished {{pretty_date(item.finished)}};</span>
            <span> {{duration(item)}} duration</span>
          </a>
        </li>
      </ul>
    </div>
    <div v-else>
      (None yet.)
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
import {Shipments} from '../../../api/shipments';
import {history, get_lane} from '../../pages/lanes/lib/util';

const options = {
   sort: { actual: -1 },
   limit: H.AMOUNT_SHOWN,
   skip: this.skip,
};

export default {
  meteor: {
    $subscribe: {
      'Lanes': function () { return [this.$route.params.slug] },
    },
    lane,
    shipment_history,
  },

  mounted () {
    shipment_sub = this.$subscribe('Shipments',
      { slug: this.$route.params.slug },
      {
        sort: { actual: -1 },
        limit: H.AMOUNT_SHOWN,
        skip: this.skip,
      }
    );
  },

  methods: {
    is_ready () {
      console.log(`Shipments sub ready? ${this.$subReady.Shipments}`);
      console.log(`Lanes sub ready? ${this.$subReady.Lanes}`);
      return (
        this.$subReady.Shipments &&
        this.$subReady.Lanes
      );
    },
    handle_paginator (evt) {
      shipment_sub.stop();
      switch (evt.target.id) {
        case 'paginator-next':
          this.$data.skip += H.AMOUNT_SHOWN;
          const shown = this.$data.shipping_log_amount_shown;
          const $lane = get_lane(this.$route.params.slug);
          if ((this.$data.skip + shown) >= $lane.shipment_count) {
            this.$data.skip = $lane.shipment_count - shown; 
            console.log(`Oldest shipment reached, showing ${
                this.$data.skip
              }-${$lane.shipment_count}`
            );
            this.$data.can_paginate_next = false;
          }
          this.$data.can_paginate_prev = true;
          break;
        case 'paginator-prev':
          this.$data.skip -= H.AMOUNT_SHOWN;
          if (this.$data.skip <= 0) {
            this.$data.skip = 0;
            this.$data.can_paginate_prev = false;
          }
          this.$data.can_paginate_next = true;
          break;
      }
      shipment_sub = this.$subscribe('Shipments',
        { slug: this.$route.params.slug },
        {
          sort: { actual: -1 },
           limit: H.AMOUNT_SHOWN,
          skip: this.skip,
        }
      );
    },
    has_work_output,
    pretty_date,
    duration,
    
  },

  data () {
    return {
      skip: 0,
      shipping_log_amount_shown: H.AMOUNT_SHOWN,
      can_paginate_next: true,
      can_paginate_prev: false,
    };
  },
}
</script>

<style>
.shipping-log-paginator {
  background: #333;
  font-style: italic;
  font-weight: 700;
  position: relative;
  margin-right: -10px;
}

.shipping-log-paginator[disabled="disabled"]:hover,
.shipping-log-paginator[disabled="disabled"] {
  background: #555;
  color: #444;
  cursor: not-allowed;
}

.shipping-log-paginator:hover {
  background: #fa0;
}

.shipping-log-paginator:active {
  background: white;
  color: black;
}

.paginator-prev {
  background: #444;
}

.paginator-next {
  margin-right: 10px;
}

.paginator-next:after {
  content: '';
  right: 0;
  top: 0;
  height: 100%;
  border: 12px solid transparent;
  border-right-color: #666;
  position: absolute;
}

.loading-shipments {
  font-style: italic;
  color: #ccc;
}

.shipment-history .shipment-link:hover * {
  color: #ffae00;
}

.shipment-link {
  display: inline-block;
}

.shipment-link span {
  display: inline-block;
  text-align: right;
  margin-left: 10px;
}

.shipment-link span:first-child {
  text-align: left;
  margin: 0;
}

.shipment-history li {
  list-style-type: none;
  position: relative;
  margin: 5px 0;
}

.shipment-link.exit-code:before {
  content: '⚠️';
}

.shipment-link.code-0:before {
  content: '✅';
}

.shipment-link.code-1:before {
  content: '❌';
}

.shipment-link:before {
  position: absolute;
  left: -25px;
}

@media all 
  and (min-device-width: 280px)
  and (max-device-width: 800px) {

  .shipment-link:before {
    left: -65px;
  }

  .shipping-log {
    font-size: 50px;
  }

  .shipping-log ul {
    margin-left: 50px;
  }

  .shipping-log ul a {
    padding: 0 20px;
  }

  .shipping-log ul span {
    display: inline-block;
    padding-left: 40px;
  }

  .shipping-log ul span:first-child {
    padding-left: 0;
  }

  .paginator-next:after {
    border-width: 36px;
    right: -1px;
  }

  .paginator-next {
    padding-right: 50px;
  }

  .back-to-top {
    font-size: 50px;
  }
}

</style>