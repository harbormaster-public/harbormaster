import { Harbors } from '..';
import { Lanes } from '../../lanes';

Meteor.publish('Harbors', function () {
  return Harbors.find();
});

Meteor.methods({
  'Harbors#update': function update_harbor (lane, values) {
    try {
      let harbor = Harbors.findOne(lane.type);
      let success = $H.harbors[lane.type].update(lane, values);

      if (success) {
        harbor.lanes[lane._id] = {
          manifest: values,
        };
        Harbors.update(harbor._id, harbor);
        lane = Meteor.call('Harbors#render_work_preview', lane, values);
        lane.minimum_complete = success;
      }

      if (success && lane.rendered_work_preview) {
        Lanes.update(lane._id, lane);
      }

      return { lane, success };

    } catch (err) { throw err; }
  },

  'Harbors#render_input': function render_input (lane, manifest) {
    try {
      lane.rendered_input = $H.harbors[lane.type].render_input(manifest, lane);

      return lane;

    } catch (err) { throw err; }
  },

  'Harbors#render_work_preview': function render_work_preview (lane, manifest) {
    try {
      lane.rendered_work_preview = $H
        .harbors
        [lane.type]
        .render_work_preview(manifest, lane)
      ;

      return lane;
    } catch (err) { throw err; }

  },
});

