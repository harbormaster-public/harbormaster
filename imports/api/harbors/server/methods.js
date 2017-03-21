import { Harbors } from '..';

Meteor.publish('Harbors', function () {
  return Harbors.find();
});

Meteor.methods({
  'Harbors#update': function update_harbor (lane, values) {
    try {
      return $H.harbors[lane.type].update(lane, values);

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
