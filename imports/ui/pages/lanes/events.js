import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes';

Template.lanes.events({
  'click #new-lane' () {
    Session.set('lane', null);
  },

  'click .delete-lane' () {
    let confirm_message = `Delete lane?\n${this.name}`;

    if (window.confirm(confirm_message)) Lanes.remove(this._id);
  },

  'click .edit-lane' (event) {
    event.stopPropagation();
  },

  'click th' (event) {
    //TODO: revisit this sorting
    let sort_value = $(event.target).attr('data-value');

    $(event.target).siblings('.active')
      .removeClass('active')
      .removeClass('reverse')
    ;
    $(event.target).addClass('active');

    if (
      sort_value == Session.get('lanes_table_sort_by') &&
      ! Session.get('lanes_table_sort_reverse')
    ) {
      Session.set('lanes_table_sort_reverse', true);
      $(event.target).addClass('reverse');

    } else if (Session.get('lanes_table_sort_reverse')) {
      Session.set('lanes_table_sort_reverse', false);
      $(event.target).removeClass('reverse');
    }

    Session.set('lanes_table_sort_by', sort_value);
  },

  'click .admin' (event) {
    $(event.target).toggleClass('collapsed');
  },

  'click a.button' (e) {
    e.preventDefault();
    let $link = $(e.target);
    let path = $link.attr('href');
    Session.set('loading', true);
    FlowRouter.go(path);
    Session.set('loading', false);
  }
});
