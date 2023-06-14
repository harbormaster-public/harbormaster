import { expect } from 'chai';
import page from '.';

const {
  methods: {
    add_new_harbor,
    currently_registered,
    found_in_depot,
    get_space_avail,
    registration_button_title,
    register,
    remove,
  },
} = page;

describe('Harbors Page', () => {
  const call_method = H.call;
  let called;

  describe('#add_new_harbor', () => {
    before(() => {
      H.confirm = H.alert = () => called = true;
    });

    it('only accepts git urls', () => {
      called = false;
      add_new_harbor();
      expect(called).to.eq(true);
    });
    it('warns that it will reload', () => {
      called = false;
      const evt = {
        target: {
          elements: {
            harbor_url: {
              value: 'git@github.com:test/test.git',
            },
          },
        },
      };
      add_new_harbor(evt);
      expect(called).to.eq(true);
    });
    it('adds the harbor to the depot', () => {
      called = false;
      H.call = (method) => {
        expect(method).to.eq('Harbors#add_harbor_to_depot');
      };
      const evt = {
        target: {
          elements: {
            harbor_url: {
              value: 'git@github.com:test/test.git',
            },
          },
        },
      };
      add_new_harbor(evt);
      H.call = call_method;
    });
  });

  describe('#currently_registered', () => {
    it('returns a cursor of registered harbors', () => {
      expect(currently_registered()._cursorDescription.collectionName)
        .to
        .eq('Harbors')
        ;
      expect(currently_registered()._cursorDescription.selector.registered)
        .to
        .eq(true)
        ;
    });
  });
  describe('#found_in_depot', () => {
    it('returns a cursor of harbors found in the depot', () => {
      expect(found_in_depot()._cursorDescription.collectionName)
        .to
        .eq('Harbors')
        ;
      expect(found_in_depot()._cursorDescription.selector.in_depot)
        .to
        .eq(true)
        ;
    });
  });
  describe('#get_space_avail', () => {
    it('sets the space_avail data for the view', () => {
      H.call = (method) => expect(method).to.eq('Harbors#space_avail');
      get_space_avail();
      H.call = call_method;
    });
  });
  describe('#registration_button_title', () => {
    it('returns a harbor de/registration string', () => {
      expect(registration_button_title({ _id: 'test', registered: true }))
        .to
        .eq('Deregister "test"')
        ;
      expect(registration_button_title({ _id: 'test', registered: false }))
        .to
        .eq('Register "test"')
        ;
    });
  });

  describe('#register', () => {

    it('warns about the registration change and subsequent reload', () => {
      called = false;
      H.confirm = () => called = true;
      H.call = () => {
        expect(called).to.eq(true);
      };
      register({});
      H.call = call_method;
    });
    it('throws if an error occurs', () => {
      H.call = (method, harbor, callback) => {
        expect(method).to.eq('Harbors#register');
        expect(() => callback(true)).to.throw();
      };
      register({});
      H.call = call_method;
    });
    it('alerts if it receives a not found (404)', () => {
      called = false;
      H.alert = () => called = true;
      H.call = (method, harbor, callback) => {
        callback(null, 404);
        expect(called).to.eq(true);
      };
      register({});
      H.call = call_method;
    });
  });

  describe('#remove', () => {

    it('warns about deleting the harbor and subsequent reload', () => {
      called = false;
      H.confirm = () => called = true;
      H.call = () => { };
      remove({});
      expect(called).to.eq(true);
      H.call = call_method;
    });
    it('removes the harbor and reloads the page', () => {
      called = false;
      H.window.location.reload = () => called = true;
      H.call = (method, harbor, callback) => {
        expect(method).to.eq('Harbors#remove');
        callback(null, true);
        expect(called).to.eq(true);
      };
      remove({});
    });
  });
});
