import '../../ui/layouts/main/main.js';
import '../../ui/components/nav/nav.js';
import '../../ui/pages/root/root.js';
import '../../ui/pages/lanes/lanes.js';
import '../../ui/pages/users/users.js';
import '../../ui/pages/profile/profile.js';
import '../../ui/pages/lanes/edit_lane/edit_lane.js';
import '../../ui/pages/lanes/ship_lane/ship_lane.js';

FlowRouter.route('/', {
  name: 'root',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'root'
    });
  }
});

FlowRouter.route('/lanes', {
  name: 'lanes',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'lanes'
    });
  }
});

FlowRouter.route('/lanes/:name/edit', {
  name: 'edit_lane',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'edit_lane'
    });
  }
});

FlowRouter.route('/lanes/:name/ship', {
  name: 'ship_lane',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'ship_lane'
    });
  }
});

FlowRouter.route('/lanes/:name/ship/:date', {
  name: 'ship_lane_date',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'ship_lane'
    });
  }
});

FlowRouter.route('/lanes//ship', {
  name: 'redirect_to_lanes',
  action: function () {
    FlowRouter.go('/lanes');
  }
});

FlowRouter.route('/users', {
  name: 'users',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'users'
    });
  }
});

FlowRouter.route('/profile', {
  name: 'profile',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'profile'
    });
  }
});

FlowRouter.route('/profile/:user_id', {
  name: 'profile',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'profile'
    });
  }
});

AccountsTemplates.configureRoute('changePwd');
AccountsTemplates.configureRoute('forgotPwd');
AccountsTemplates.configureRoute('resetPwd');
AccountsTemplates.configureRoute('signIn');
AccountsTemplates.configureRoute('signUp');
AccountsTemplates.configureRoute('verifyEmail');

FlowRouter.triggers.enter([AccountsTemplates.ensureSignedIn]);
