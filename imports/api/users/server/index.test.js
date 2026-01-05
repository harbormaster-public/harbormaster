import { expect } from 'chai';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Users } from '..';

describe('api/users/server/index', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterEach(async () => {
    await resetDatabase();
  });

  it(
    'registers Users publication + methods and publish handler returns cursors',
    async () => {
      // Ensure the module is loaded (it may have been loaded earlier already).
      // eslint-disable-next-line no-undef
      require('/imports/api/users/server/index.js');

      const publishFn = Meteor?.server?.publish_handlers?.Users;
      expect(publishFn).to.be.a('function');

      await Users.insertAsync({
        _id: 'u1',
        emails: [{ address: 'u1@test' }],
      });
      await Users.insertAsync({
        _id: 'u2',
        emails: [{ address: 'u2@test' }],
      });

      // Exercise both branches: with _id and without.
      const cursor1 = publishFn.call({}, '/users', 'u1');
      expect(cursor1._cursorDescription?.collectionName).to.eq('Users');
      expect((await cursor1.fetchAsync()).length).to.eq(1);

      const cursor2 = publishFn.call({}, '/users');
      expect(cursor2._cursorDescription?.collectionName).to.eq('Users');
      expect((await cursor2.fetchAsync()).length).to.eq(2);
    },
  );
});


