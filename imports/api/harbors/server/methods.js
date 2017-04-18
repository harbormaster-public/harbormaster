import { Harbors } from '..';
import { Lanes } from '../../lanes/lanes';

Meteor.publish('Harbors', function () {
  return Harbors.find();
});

Meteor.methods({
  'Harbors#update': function update_harbor (lane, values) {
    try {
      let success = $H.harbors[lane.type].update(lane, values);
      lane = Meteor.call('Harbors#render_work_preview', lane, values);

      lane.minimum_complete = success;

      if (success && lane.rendered_work_preview) {
        Lanes.update(lane._id, lane);
      }

      return lane;

    } catch (err) { throw err; }
  },

  'Harbors#render_input': function render_input (lane, manifest) {
    try {
      lane.rendered_input = $H.harbors[lane.type].render_input(manifest);

      return lane;

    } catch (err) { throw err; }
  },

  'Harbors#render_work_preview': function render_work_preview (lane, manifest) {
    try {
      lane.rendered_work_preview = $H
        .harbors
        [lane.type]
        .render_work_preview(manifest)
      ;

      return lane;
    } catch (err) { throw err; }

  }
})
