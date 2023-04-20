// import page from '.';

// const {
//   methods: {
//     add_new_harbor,
//     currently_registered,
//     found_in_depot,
//     get_space_avail,
//     registration_button_title,
//     register,
//     remove,
//   }
// } = page;

describe('Harbors Page', () => {
  describe('#add_new_harbor', () => {
    it('only accepts git urls');
    it('warns that it will reload');
    it('adds the harbor to the depot');
  });
  describe('#currently_registered', () => {
    it('returns a cursor of registered harbors');
  });
  describe('#found_in_depot', () => {
    it('returns a cursor of harbors found in the depot');
  });
  describe('#get_space_avail', () => {
    it('sets the space_avail data for the view');
  });
  describe('#registration_button_title', () => {
    it('returns a harbor de/registration string');
  });
  describe('#register', () => {
    it('warns about the registration change and subsequent reload');
    it('throws if an error occurs');
    it('alerts if it receives a not found (404)');
  });
  describe('#remove', () => {
    it('warns about deleting the harbor and subsequent reload');
    it('removes the harbor and reloads the page');
  });
});
