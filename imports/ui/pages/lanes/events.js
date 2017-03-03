import { Template } from 'meteor/templating';
import { Lanes } from '../../../api/lanes/lanes.js';

Template.lanes.events({
  'click #new-lane' () {
    Session.set('lane', null);
  },

  'click .delete-lane' () {
    Lanes.remove(this._id);
  },

  'click .edit-lane' (event) {
    event.stopPropagation();
  },

  'click th' (event) {
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
  }
});
