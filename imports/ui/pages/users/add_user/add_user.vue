<template>
  <div>
    <div v-if="fresh">
      <h1>Welcome to Harbormaster!</h1>
      <h2>You're the first user to sign in.</h2>
      <h3>Please enter your email, and Harbormaster will send you a link to set your password.</h3>
      <form id="new-instance">
        <label>Email:
          <input type=email required class="email-user-invite" placeholder="user@example.com">
        </label>
        <button class="button initial-sign-in">Okay!</button>
      </form>
    </div>
    <div v-else>
      <h1>Invite A User</h1>
      <div v-if="is_harbormaster">
        <h2>Enter a user's email address and password to setup an account for them.</h2>
        <form>
          <label>Email:
            <input type=email required class="email-user-invite" placeholder="user@example.com">
          </label>
          <button class="button send-invitation">Invite User</button>
        </form>
      </div>
      <div v-else>
        <h2>You need to be a Harbormaster to invite users.</h2>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  meteor: {
    is_harbormaster () {
      var user_id = Meteor.user() ? Meteor.user().emails[0].address: '';
      var user = Users.findOne(user_id);

      if (user && user.harbormaster) { return true; }

      return false;
    }
  }
}
</script>