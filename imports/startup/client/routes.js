import '../../ui/layouts/main/main.js';
import '../../ui/components/nav/nav.js';
import '../../ui/pages/root/root.js';
import '../../ui/pages/lanes/lanes.js';

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
  name:'lanes',
  action: function () {
    BlazeLayout.render('main', {
      header: 'nav',
      main: 'lanes'
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
