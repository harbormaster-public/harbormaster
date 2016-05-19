import { Meteor } from 'meteor/meteor';

class UserCollection extends Mongo.Collection {

}

export const Users = new UserCollection('Users');

