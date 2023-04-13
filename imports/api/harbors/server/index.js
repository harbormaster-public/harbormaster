import { Harbors } from '..';
import {
  update_harbor,
  render_input,
  render_work_preview,
  get_constraints,
  register,
  remove,
  add_harbor_to_depot,
} from './methods';

Meteor.publish('Harbors', function () {
  return Harbors.find();
});

Meteor.methods({
  'Harbors#update': update_harbor,
  'Harbors#render_input': render_input,
  'Harbors#render_work_preview': render_work_preview,
  'Harbors#get_constraints': get_constraints,
  'Harbors#register': register,
  'Harbors#space_avail': () => {
    return H.space_avail;
  },
  'Harbors#remove': remove,
  'Harbors#add_harbor_to_depot': add_harbor_to_depot,
});

