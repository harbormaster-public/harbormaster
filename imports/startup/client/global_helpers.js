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
  let pretty_index = index + 1;
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
  // Vue Router 4 exposes `router.currentRoute` as a Ref (use `.value`).
  // Our routes typically use `:slug`, but a few older callers may still
  // provide `:name`. Support either.
  const route = H.Router?.currentRoute?.value || H.Router?.currentRoute;
  const params = route?.params || {};
  const slugOrName = params.slug || params.name;
  if (!slugOrName) return undefined;

  return Lanes.findOne({
    $or: [
      { slug: slugOrName },
      { name: slugOrName },
      { _id: slugOrName },
    ],
  });
};


