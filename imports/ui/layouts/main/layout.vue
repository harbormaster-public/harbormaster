<template>
  <div>
    <div v-if="is_loaded">
      <div v-if="no_users">
        <add-user fresh=true></add-user>
      </div>
      <div v-else>
        <div v-if="logged_in">
          <div v-if="no_harbormasters">
            <div v-blaze="'new_harbormaster'"></div>
          </div>
          <div v-else>
            <div>
              <nav></nav>
            </div>
            <div>
              <router-view></router-view>
            </div>
          </div>
        </div>
        <div v-else>
          <div v-blaze="'welcome'"></div>
        </div>
      </div>
    </div>
  <div v-else>
    <div v-blaze="'spinner'"></div>
  </div>
    <!-- <div v-blaze="'main'"></div> -->
  </div>
</template>

<script>
import AddUser from '../../pages/users/add_user';
import Nav from '../../components/nav';
import { Users } from '../../../api/users';

export default {
  meteor: {
    $subscribe: {
      'Users': [],
      'Lanes': [],
      'Harbors': [],
    },
    is_loaded () {
      if (
        ! Session.get('loading')
        && ! Meteor.loggingIn()
      ) {
        console.log(true);
        return true;
      }
      console.log(false);
      return false;
    },

    no_users () {
      if (! Users.find().fetch().length) { return true; }
      return false;
    },

    logging_in () {
      return Meteor.user();
    },

    no_harbormasters () {
      var harbormasters = Users.find({ harbormaster: true }).fetch();

      return ! harbormasters.length ? true : false;
    },

    constraints () {
      const constraints = Constraints.get();
      for (let [key, value] of Object.entries(constraints)) {
        value.forEach((constraint) => {
          if (constraint.rel) {
            const link = document.createElement('link');
            link.rel = constraint.rel;
            link.href = constraint.href;
            link.id = constraint.id;
            document.head.appendChild(link);
            return link;
          }

          const script = document.createElement('script');
          script.async = constraint.async || false;
          script.id = constraint.id;
          if (constraint.src) script.src = constraint.src;
          else if (constraint.text) script.text = constraint.text;
          else throw new Error('A "src" or "text" field must be supplied!');
          document.body.appendChild(script);
          return script;
        });
      }
    },
  },

  components: {
    AddUser,
    Nav,
  }
}
</script>

<style>

</style>