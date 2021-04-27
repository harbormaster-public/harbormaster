import { Harbors } from '..';
import { Lanes } from '../../lanes';
import { 
  LatestShipment,
 } from '../../shipments';

Meteor.publish('Harbors', function () {
  return Harbors.find();
});

const not_found = (err) => {
  console.error(err);
  return 404;
};

Meteor.methods({
  'Harbors#update': function update_harbor (lane, values) {
    lane = lane._id ? lane : Lanes.findOne({ name: lane.name });
    try {
      let harbor = Harbors.findOne(lane.type);
      let success = H.harbors[lane.type].update(lane, values);
      if (success) {
        harbor.lanes = harbor.lanes || {};
        harbor.lanes[lane._id] = {
          manifest: values,
        };
        Harbors.update(harbor._id, harbor);
        lane = Meteor.call('Harbors#render_work_preview', lane, values);
        lane.minimum_complete = success;
      }

      if (success && lane.rendered_work_preview && !lane.last_shipment) {
        lane.last_shipment = { 
          actual: 'Never', 
          start: '',
          shipment_count: 0,
          salvage_runs: 0,
        };
        Lanes.update(lane._id, {$set: { last_shipment: lane.last_shipment}});
        LatestShipment.upsert(
          lane._id, 
          lane.last_shipment,
        );
      }

      return { lane, success };

    }
    catch (err) {
      console.error(err);
      throw err;
    }
  },

  'Harbors#render_input': function render_input (lane, manifest) {
    const $newLaneName = 'New';
    if (lane.name == $newLaneName || !lane.type) return false;
    
    try {
      lane.rendered_input = H.harbors[lane.type].render_input(manifest, lane);
      lane.rendered_work_preview = H
        .harbors
        [lane.type]
        .render_work_preview(manifest, lane)
      ;
      Lanes.update(lane._id, {$set:{
        rendered_input: lane.rendered_input,
        rendered_work_preview: lane.rendered_work_preview,
      }});

      return lane;

    }
    // Have the harbors been loaded successfully?
    // The #render_input method is required.
    catch (err) { return not_found(err); }
  },

  'Harbors#render_work_preview': function render_work_preview (lane, manifest) {
    if (! H.harbors[lane.type]) return 404;
    try {
      lane.rendered_work_preview = H
        .harbors
        [lane.type]
        .render_work_preview(manifest, lane)
      ;
      Lanes.update(lane._id, {$set: {
        rendered_work_preview: lane.rendered_work_preview
      }});

      return lane;
    }
    catch (err) { return not_found(err); }
  },

  'Harbors#get_constraints': (name) => {
    const key = `constraints.${name}`;
    const constraints = {
      global: [],
      [name]: [],
    };
    Harbors.find({ $or: [
      { 'constraints.global': { $exists: true } },
      { [key]: { $exists: true } },
    ] }).forEach((doc) => {
      if (doc.constraints.global)
        constraints.global = constraints.global.concat(doc.constraints.global);
      if (doc.constraints[name])
        constraints[name] = constraints[name].concat(doc.constraints[name]);
    });

    return constraints;
  },
});

