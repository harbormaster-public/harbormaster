import Vue from 'vue';
import VueRouter from 'vue-router';
import VueMeteorTracker from 'vue-meteor-tracker';

import Layout from '../../ui/layouts/main';

import '../../ui/components/welcome';
import '../../ui/components/new_harbormaster';
import RootPage from '../../ui/pages/root';
import LanesPage from '../../ui/pages/lanes';
import UsersPage from '../../ui/pages/users';
import AddUserPage from '../../ui/pages/users/add_user';
import ProfilePage from '../../ui/pages/profile';
import EditLanePage from '../../ui/pages/lanes/edit_lane';
import ShipLanePage from '../../ui/pages/lanes/ship_lane';
import CharterPage from '../../ui/pages/lanes/charter';

const routes = [
  {
    path: "/",
    name: "root",
    component: RootPage,
  },
  {
    path: "/lanes",
    name: "lanes",
    component: LanesPage,
  },
  {
    path: "/lanes/:name/edit",
    name: "edit lane",
    component: EditLanePage,
  },
  {
    path: "/lanes/:name/ship/:date?",
    name: "ship lane",
    component: ShipLanePage,
  },
  {
    path: "/lanes/:name/charter",
    name: "charter",
    component: CharterPage,
  },
  {
    path: "/users",
    name: "users",
    component: UsersPage,
  },
  {
    path: "/users/add-user",
    name: "add user",
    component: AddUserPage,
  },
  {
    path: "/profile/:user_id?",
    name: "profile",
    component: ProfilePage,
  },
];

Vue.use(VueRouter);

const router = new VueRouter({
  mode: 'history',
  routes,
});

Meteor.startup(() => {
  Vue.use(VueMeteorTracker);
  new Vue({ router, render: (h) => h(Layout) }).$mount('#app');
});

export default router;