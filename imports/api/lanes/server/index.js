import H from '../../../startup/config/namespace';
import { Lanes } from '..';
import { LatestShipment } from '../../shipments';
import { DDPServer } from 'meteor/ddp-server';

import {
  collect_latest_shipments,
  publish_lanes,
  get_total,
  update_webhook_token,
  start_shipment,
  end_shipment,
  reset_shipment,
  reset_all_active_shipments,
  update_slug,
  delete_lane,
  upsert,
  duplicate,
  download_charter_yaml,
  import_yaml,
} from './methods';

Lanes.rawCollection().createIndex({ name: 1 }, { background: true });
collect_latest_shipments();

Meteor.server.setPublicationStrategy(
  'Lanes',
  DDPServer.publicationStrategies.SERVER_MERGE,
);
H.publish('Lanes', publish_lanes);

/* istanbul ignore next */
H.publish('LatestShipment', function () {
  return LatestShipment.find();
});

H.methods({
  'Lanes#get_total': get_total,
  'Lanes#update_webhook_token': update_webhook_token,
  'Lanes#start_shipment': start_shipment,
  'Lanes#end_shipment': end_shipment,
  'Lanes#reset_shipment': reset_shipment,
  'Lanes#reset_all_active_shipments': reset_all_active_shipments,
  'Lanes#update_slug': update_slug,
  'Lanes#delete': delete_lane,
  'Lanes#upsert': upsert,
  'Lanes#duplicate': duplicate,
  'Lanes#download_charter_yaml': download_charter_yaml,
  'Lanes#import_yaml': import_yaml,
});
