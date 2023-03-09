<template>
  <div id="harbors-page">
    <h1 class="text-5xl my-2">Harbors</h1>
    <div v-if="is_harbormaster()" class="is-harbormaster">
      <h2 class="text-3xl my-2">Currently Registered:</h2>
      <ul class="registered-list">
        <li v-for="harbor in currently_registered()" :key="harbor._id">
          <span>{{harbor._id}}</span>
          <button 
          v-on:click.prevent="register(harbor)" 
          class="deregister">✖️</button>
        </li>
      </ul>
      <h2 class="text-3xl my-2">Add Harbor to Depot:</h2>
      <form class="add-new-harbor-form"
      v-on:submit.prevent="add_new_harbor"
      >
      <input type="text" 
      required
      name="harbor_url"
      placeholder="Git repo url (e.g. git@github.com:StrictlySkyler/timestamp.git)"
      class="add-new-harbor-input"
      >
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
        <button class="deregister"
        v-on:click.prevent="register(harbor)"
        :title="registration_button_title(harbor)"
        >{{((harbor.registered) && '➖') || '➕'}}
      </button>
        <button class="remove-from-depot"
          :title="`Remove ${harbor._id} from Depot`"
          v-on:click.prevent="remove(harbor)"
          >🗑️</button>
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
import is_git_url from 'is-git-url';
import { Harbors } from '../../../api/harbors';
import { is_harbormaster } from '../root/lib';

const reload_timeout_ms = 10000;

export default {
  meteor: {
    $subscribe: {
      'Harbors': [],
      'Users': [],
    }
  },

  data () {
    return {
      space_avail: 'Loading',
    }
  },

  mounted () {
    this.get_space_avail();
  },
  
  methods: {
    is_harbormaster,
    add_new_harbor (evt) {
      const url = evt.target.elements.harbor_url.value;
      let git_url_not_recognized = `The url:\n${url}\n`;
      git_url_not_recognized += "Doesn't appear to be a proper git url."
      let warn = `This will add the following Harbor to the Depot:\n\n${url}`;
      warn += `\n\nThen the page will reload.  Ok?`;
      if (! is_git_url(url)) return alert(git_url_not_recognized);
      if (! confirm(warn)) return;
      H.call('Harbors#add_harbor_to_depot', url, (err, res) => {
        if (err) alert(err);
        else if (res.stderr) alert(res.stderr);
        else window.location.reload();
      });
    },
    currently_registered () { return Harbors.find({ registered: true }) },
    found_in_depot () { return Harbors.find({ in_depot: true }) },
    get_space_avail () { 
      H.call('Harbors#space_avail', (err, res) => {
        console.log(`Detected ${res} space available.`);
        this.space_avail = res;
      });
    },
    registration_button_title (harbor) { 
      return harbor.registered ? 
        `Deregister "${harbor._id}"` : 
        `Register "${harbor._id}"`
        ;
    },
    register (harbor) {
      let warn = `Confirm you want to ${
        ((harbor.registered && 'de') || '')
      }register the "${harbor._id}" harbor?`
      warn += `\n\nThis will force the page to reload in a few moments.`;

      if (!confirm(warn)) return;

      H.call('Harbors#register', harbor, (err, res) => {
        let harbor_registration_error_msg = 'Error!\n\n';
        harbor_registration_error_msg += 'Check the console for details.';
        let harbor_file_not_found_msg = `Unable to (de)register harbor:\n\n${
          harbor._id
        }\n\n`;
        harbor_file_not_found_msg += 'Make sure the harbor file is present, ';
        harbor_file_not_found_msg += 'and named correctly.'
        if (err) {
          alert(harbor_registration_error_msg);
          throw err;
        }
        if (res == 404) alert(harbor_file_not_found_msg);
      });
      setTimeout(() => {
        // TODO Add server check for status code, reload on 200
        console.log('Reloading...');
        window.location.reload()
      }, reload_timeout_ms);
    },
    remove (harbor) {
      let warn = `Confirm you want to delete ${harbor._id} from the Depot?`;
      warn += '\n\nThis will reload the page.'

      if (!confirm(warn)) return;

      H.call('Harbors#remove', harbor, (err, res) => {
        if (err) alert(err);
        else if (res) {
          console.log(`Harbor ${harbor._id} removed, reloading.`);
          window.location.reload();
        }
      });
    }
  }
}
</script>