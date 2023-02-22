<template>
  <div id="harbors-page">
    <h1 class="text-5xl my-2">Harbors</h1>
    <h2 class="text-3xl my-2">Currently Registered:</h2>
    <ul class="registered-list">
      <li v-for="harbor in currently_registered()" :key="harbor._id">
        <span>{{harbor._id}}</span>
        <button 
          v-on:click.prevent="register(harbor)" 
          class="deregister">✖️</button>
      </li>
    </ul>
    <h3 class="text-3xl my-2">Found in Depot:</h3>
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
        <button class="deregister"
        v-on:click.prevent="register(harbor)"
          :title="registration_button_title(harbor)">
          {{((harbor.registered) && '➖') || '➕'}}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
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
import { Harbors } from '../../../api/harbors';
import { Users } from '../../../api/users';
export default {
  meteor: {
    $subscribe: {
      'Harbors': [],
      'Users': [],
    }
  },

  methods: {
    currently_registered () { return Harbors.find({ registered: true }) },
    found_in_depot () { return Harbors.find({ in_depot: true }) },
    registration_button_title (harbor) { 
      return harbor.registered ? 
        `Deregister "${harbor._id}"` : 
        `Register "${harbor._id}"`
        ;
    },
    register (harbor) {
      const reload_timeout_ms = 10000;
      let warn = `Confirm that you want to ${
        (harbor.registered && 'de')
      }register the "${harbor._id}" harbor?`
      warn += `\n\nThis will force the page to reload in a few moments.`;

      if (!confirm(warn)) return;

      H.call('Harbors#register', harbor, (err, res) => {
        console.log(err);
        console.log(H.status())
        // debugger
      });
      setTimeout(() => {
        console.log('Reloading...');
        window.location.reload()
      }, reload_timeout_ms);
      // window.location.reload();
      
      if (harbor.registered) {
        // deregister
        // remove files
        // return success or error
      }

      // register
      // copy file
      // return success or error
      // debugger;
      // window.location.reload();
    }
  }
}
</script>