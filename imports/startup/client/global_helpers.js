import { Template } from 'meteor/templating';
import { Lanes } from '../../api/lanes';

// Polyfill for IE
// github.com/jserz/js_piece/blob/master/DOM/ChildNode/remove()/remove().md
(function (arr) {
  arr.forEach(function (item) {
    if (item.hasOwnProperty('remove')) {
      return;
    }
    Object.defineProperty(item, 'remove', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: function remove () {
        if (this.parentNode !== null)
          this.parentNode.removeChild(this);
      },
    });
  });
})([Element.prototype, CharacterData.prototype, DocumentType.prototype]);

export const manifest_index = (index) => {
  pretty_index = index + 1;
  if (pretty_index == 1) {
    return '1st';
  }
  else if (pretty_index == 2) {
    return '2nd';
  }
  else if (pretty_index == 3) {
    return '3rd';
  }

  return pretty_index + 'th';
};

export const current_lane = () => {
  let name = FlowRouter.getParam('name');

  let lane = Lanes.findOne({ name: name });

  return lane;
};

Template.registerHelper('manifest_index', manifest_index);
Template.registerHelper('current_lane', current_lane);


