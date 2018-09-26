import { Template } from 'meteor/templating';
import { Harbors } from '../../../api/harbors';

Template.harbors.helpers({
  harbor_list () {
    return Harbors.find();
  },
});
