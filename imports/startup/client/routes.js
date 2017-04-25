import '../../ui/layouts/main';
import '../../ui/components/nav';
import '../../ui/pages/root';
import '../../ui/pages/lanes';
import '../../ui/pages/users';
import '../../ui/pages/profile';
import '../../ui/pages/lanes/edit_lane';
import '../../ui/pages/lanes/ship_lane';
import '../../ui/pages/users/add_user';
import '../../ui/pages/lanes/charter';

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

FlowRouter.route('/lanes/:name/charter', {
  name: 'lane_charter',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'charter'
    });
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

FlowRouter.route('/users/add-user', {
  name: 'add_user',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'add_user'
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

