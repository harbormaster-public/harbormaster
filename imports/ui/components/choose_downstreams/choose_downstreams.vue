<template>
  <div class="choose-downstreams">
    <div v-if="!no_followup">
      <button v-on:click.prevent="add_followup_lane" class="add-followup rounded-sm my-2 block">Add Followup
        Destination</button>
    </div>
    <div v-if="choose_followup">
      <fieldset v-on:change.prevent="change_followup_lane" class="fieldset followup">
        <legend>Followup: {{followup_lane}}</legend>
          <ul>
            <li 
              v-for="followup in lanes" :key="followup.slug"
              :class="chosen_followup(followup) ? 'chosen' : ''">
              <label>
                <input :checked="chosen_followup(followup)" type=radio name="followup_lanes" :value="followup.slug">
                {{followup.name}}
              </label>
            </li>
            <li>
              <label>
                <input type=radio name="followup_lanes" value="">
                No Followup
              </label>
            </li>
        </ul>
      </fieldset>
    </div>

    <div v-if="!no_salvage">
      <button v-on:click.prevent="add_salvage_plan" class="warning add-salvage-plan rounded-sm my-2 block">
        Add a Salvage Plan
      </button>
    </div>
    <div v-if="choose_salvage_plan">
      <fieldset v-on:change.prevent="change_salvage_plan" class="fieldset salvage-plan">
        <legend>Salvage Plan: {{salvage_plan_lane}}</legend>
          <ul>
            <li v-for="salvage_lane in lanes" :key="salvage_lane.slug"
              :class="chosen_salvage_plan(salvage_lane) ? 'chosen' : ''">
              <label>
                <input :checked="chosen_salvage_plan(salvage_lane)" type=radio name="salvage_plan_lanes"
                  :value="salvage_lane.slug">
                {{salvage_lane.name}}
              </label>
            </li>
            <li>
              <label>
                <input type=radio name="followup_lanes" value="">
                No Salvage Plan
              </label>
            </li>
          </ul>
      </fieldset>
    </div>
  </div>
</template>

<script>
export default {
  props: [
    'no_followup',
    'add_followup_lane',
    'choose_followup',
    'change_followup_lane',
    'followup_lane',
    'lanes',
    'chosen_followup',
    'no_salvage',
    'add_salvage_plan',
    'salvage_plan_lane',
    'choose_salvage_plan',
    'change_salvage_plan',
    'salvage_plan_lane',
    'chosen_salvage_plan',
  ],

  meteor: {
    $subscribe: {
      Lanes: ['/downstreams'],
    }
  }
}
</script>

<style>
.choose-downstreams ul {
  margin: 0;
}

.choose-downstreams li {
  display: inline-block;
  border: 1px solid white;
  padding: 5px;
  border-radius: 2px;
}

.choose-downstreams label {
  margin: 0;
}

.choose-downstreams .chosen {
  background: white;
}

.choose-downstreams .chosen label {
  color: #333;
}
</style>