<template>
  <div id="harbors-page">
    <h1 class="text-5xl my-2">Harbors</h1>
    <div v-if="is_harbormaster()" class="is-harbormaster">
      <h2 class="text-3xl my-2">
        Currently Registered:
        <span v-if="!$subReady.Harbors"> (loading...)</span>
      </h2>
      <ul class="registered-list">
        <li v-for="harbor in currently_registered()" :key="harbor._id">
          <span>{{harbor._id}}</span>
          <button v-on:click.prevent="register(harbor)" class="deregister">✖️</button>
        </li>
      </ul>
      <h2 class="text-3xl my-2">Add Harbor to Depot:</h2>
      <form class="add-new-harbor-form" v-on:submit.prevent="add_new_harbor">
        <input type="text" required name="harbor_url"
          placeholder="Git repo url (e.g. git@github.com:StrictlySkyler/timestamp.git)" class="add-new-harbor-input">
        <button class="add-new-harbor-button">✔️</button>
      </form>
      <h3 class="text-3xl my-2">Found in Depot:</h3>
      <h4 class="text-xl">({{ space_avail }} space available)</h4>
      <ul class="depot-list" v-for="harbor in found_in_depot()" :key="harbor._id">
        <li>
          <h4>Name:</h4>
          <code>{{harbor._id}}</code>
        </li>
        <li>
          <h5>Version:</h5>
          <code>{{harbor.depot_version}}</code>
        </li>
        <li>
          <h5>Url:</h5>
          <code>{{harbor.depot_url}}</code>
        </li>
        <li>
          <h5>Registered?</h5>
          <code>{{harbor.registered || 'false'}}</code>
          <button class="deregister" v-on:click.prevent="register(harbor)"
            :title="registration_button_title(harbor)">{{((harbor.registered) && '➖') || '➕'}}
          </button>
          <button class="remove-from-depot" :title="`Remove ${harbor._id} from Depot`"
            v-on:click.prevent="remove(harbor)">🗑️</button>
        </li>
      </ul>
    </div>
    <div v-else class="not-harbormaster">
      <h2>Only Harbormasters are allowed to modify Harbor registrations and the Depot.</h2>
    </div>
  </div>
</template>
  
<style scoped>
.add-new-harbor-form {
  position: relative;
}

.add-new-harbor-input {
  width: 100%;
  border-radius: 3px;
}

.add-new-harbor-button {
  padding: 5px;
  border-radius: 3px;
  position: absolute;
  right: 0;
}

.add-new-harbor-button:hover {
  background: #ffae00;
}

code {
  padding: 5px 10px;
  display: inline-block;
  box-shadow: 0 0 30px 3px #222 inset;
  border-radius: 3px;
  margin: 5px 0;
}

.deregister {
  background: transparent;
  border-radius: 3px;
  border: 3px solid transparent;
  width: 2em;
  height: 2em;
}

.deregister:hover {
  background: #ffae00;
  border-color: #ffae00;
}

.deregister:active {
  background: #fff;
}

.depot-list,
.registered-list li {
  background: #333;
  display: inline-block;
  border-radius: 3px;
  padding: 0 5px;
  margin: 5px;
}

.depot-list {
  position: relative;
}

.remove-from-depot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 2em;
  height: 2em;
  border-radius: 3px;
}

.remove-from-depot:hover {
  background: #ffae00;
}

.depot-list:nth-child(even),
.registered-list li:nth-child(even) {
  background: #444;
}

.registered-list li {
  padding: 5px 10px;
}

li {
  list-style-type: none;
}

ul {
  margin-left: 0;
}

@media all and (min-device-width: 280px) and (max-device-width: 800px) {

  .depot-list,
  .registered-list li {
    font-size: 3em;
    padding: .25em;
    padding-left: .5em;
  }
}
</style>

<script>
import { is_harbormaster } from '../root/lib';
import {
  add_new_harbor,
  currently_registered,
  found_in_depot,
  get_space_avail,
  registration_button_title,
  register,
  remove,
} from './lib';

export default {
  meteor: {
    $subscribe: {
      'Harbors': ['/harbors'],
    }
  },

  data() {
    return {
      space_avail: 'Loading',
    }
  },

  mounted() {
    this.get_space_avail();
  },

  methods: {
    is_harbormaster,
    add_new_harbor,
    currently_registered,
    found_in_depot,
    get_space_avail,
    registration_button_title,
    register,
    remove,
  }
}
</script>