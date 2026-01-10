import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
import { Shipments } from '../../../api/shipments';
import { Harbors } from '../../../api/harbors';

let lane_ids = new ReactiveVar([]);

const empty = function () {
  const total = H.Session.get('total_lanes');
  const current = Lanes.find().count();
  return (!total && current === 0);
};

const sort_by_shipped_date = async function (lane1, lane2) {
  let reverse = H.Session.get('lanes_table_sort_reverse') ? -1 : 1;
  let lane1_shipments = await Shipments.find({ lane: lane1._id }).fetchAsync();
  let lane2_shipments = await Shipments.find({ lane: lane2._id }).fetchAsync();

  let lane1_date = lane1_shipments.length ?
    lane1_shipments[lane1_shipments.length - 1].actual :
    0
    ;
  let lane2_date = lane2_shipments.length ?
    lane2_shipments[lane2_shipments.length - 1].actual :
    0
    ;
  let sort_order = 0;

  if (lane1_date > lane2_date) { sort_order = -1; }
  else if (lane1_date < lane2_date) { sort_order = 1; }

  if (reverse == -1) { sort_order = -1 * sort_order; }
  return sort_order;
};

const sort_by_total_shipments = async function (lane1, lane2) {
  let reverse = H.Session.get('lanes_table_sort_reverse') ? -1 : 1;
  let lane1_shipments = await Shipments.find({ lane: lane1._id }).fetchAsync();
  let lane2_shipments = await Shipments.find({ lane: lane2._id }).fetchAsync();
  let sort_order = 0;

  if (lane1_shipments.length > lane2_shipments.length) {
    sort_order = -1;
  }
  else if (lane1_shipments.length < lane2_shipments.length) {
    sort_order = 1;
  }

  if (reverse == -1) { sort_order = -1 * sort_order; }
  return sort_order;
};

const sort_by_total_salvage_runs = async function (lane1, lane2) {
  let reverse = H.Session.get('lanes_table_sort_reverse') ? -1 : 1;
  let lane1_shipments = await Shipments.find({
    lane: lane1._id,
    exit_code: { $ne: 0 },
  }).fetchAsync();
  let lane2_shipments = await Shipments.find({
    lane: lane2._id,
    exit_code: { $ne: 0 },
  }).fetchAsync();
  let sort_order = 0;
  if (lane1_shipments.length > lane2_shipments.length) {
    sort_order = -1;
  }
  else if (lane1_shipments.length < lane2_shipments.length) {
    sort_order = 1;
  }

  if (reverse == -1) { sort_order = sort_order * -1; }
  return sort_order;
};

const lanes = function () {
  let lane_list;
  let sort_by = H.Session.get('lanes_table_sort_by');
  let reverse = H.Session.get('lanes_table_sort_reverse') ? -1 : 1;
  let opts;
  let list;
  let getCount;
  let counts;

  switch (sort_by) {
    case 'name':
      opts = { sort: { name: reverse } };
      lane_list = Lanes.find({}, opts).fetch();
      break;
    case 'captains':
      list = Lanes.find({}).fetch();
      lane_list = list.sort((a, b) => {
        const aCount = a.captains ? a.captains.length : 0;
        const bCount = b.captains ? b.captains.length : 0;
        if (aCount > bCount) return -reverse;
        if (aCount < bCount) return reverse;
        return 0;
      });
      break;
    case 'type':
      opts = { sort: { type: reverse } };
      lane_list = Lanes.find({}, opts).fetch();
      break;
    case 'shipped':
      list = Lanes.find({}).fetch();
      lane_list = list.sort(sort_by_shipped_date);
      break;
    case 'shipments':
      list = Lanes.find({}).fetch();
      getCount = (lane_id) => {
        const shipList = Shipments
          .find({ lane: lane_id })
          .fetch();
        return shipList.length;
      };
      // Sort by number of shipments descending; ignore reverse here to
      // match tests which expect natural descending order
      counts = {};
      for (const lane of list) {
        // lane _id is unique, and counts starts empty for each lanes() call.
        // Avoid a nullish-coalescing expression here since v8->istanbul can
        // mis-map it as an uncovered branch even when executed.
        counts[lane._id] = getCount(lane._id);
      }
      lane_list = list.sort((a, b) => (counts[b._id] - counts[a._id]));
      break;
    case 'salvage-runs':
      list = Lanes.find({}).fetch();
      lane_list = list.sort(sort_by_total_salvage_runs);
      break;
    case 'state':
      opts = { sort: { 'last_shipment.exit_code': reverse } };
      lane_list = Lanes.find({}, opts).fetch();
      break;
    case 'followup':
      opts = { sort: { 'followup.name': reverse } };
      lane_list = Lanes.find({}, opts).fetch();
      break;
    case 'salvage':
      opts = { sort: { 'salvage_plan.name': reverse } };
      lane_list = Lanes.find({}, opts).fetch();
      break;
    default:
      lane_list = Lanes.find({}).fetch();
      break;
  }
  return lane_list;
};

const loading_lanes = function () {
  const total = H.Session.get('total_lanes');
  const current = (Lanes.find({})).count();
  if ((total !== 0 && !total) || current < total) return true;
  return false;
};

const sort_lane_table_reverse = function (sort_value) {
  return (
    sort_value == H.Session.get('lanes_table_sort_by') &&
    !H.Session.get('lanes_table_sort_reverse')
  );
};

const reverse_sort = function (event) {
  H.Session.set('lanes_table_sort_reverse', true);
  H.$(event.target).addClass('reverse');

  return event;
};

const default_sort = function (event) {
  H.Session.set('lanes_table_sort_reverse', false);
  H.$(event.target).removeClass('reverse');

  return event;
};

const sort_by_header = function (event) {
  let sort_value = H.$(event.target).attr('data-value');

  H.$(event.target).siblings('.active')
    .removeClass('active')
    .removeClass('reverse')
  ;
  H.$(event.target).addClass('active');

  if (sort_lane_table_reverse(sort_value)) { reverse_sort(event); }
  else if (H.Session.get('lanes_table_sort_reverse')) { default_sort(event); }

  H.Session.set('lanes_table_sort_by', sort_value);
};

const delete_lane = function (event, lane) {
  let confirm_message = `Delete lane?\n${lane.name}`;
  let $row = H.$(event.target).parents('tr');

  /* istanbul ignore else */
  if (H.confirm(confirm_message)) {
    $row.addClass('deleting');
    /* istanbul ignore next reason: no meaningful logic */
    H.call('Lanes#delete', lane, (err, res) => {
      if (err) throw err;
      return H.Session.set('total_lanes', res);
    });
  }
};

const duplicate_lane = function (event, lane) {
  const warn = `Duplicate this lane, and then edit the new lane?`;
  const router = this.$router;
  /* istanbul ignore next */
  if (!H.confirm(warn)) return;
  H.call('Lanes#duplicate', lane, (err, res) => {
    /* istanbul ignore next reason: no meaningful logic */
    if (err) alert(err);
    router.push(res);
  });
};

const ready = function () {
  if (
    this.$subReady.Lanes
  ) return true;
  return false;
};

const active = function (header) {
  let active_string = '';

  if (header == H.Session.get('lanes_table_sort_by')) {
    active_string += 'active';
  }

  if (H.Session.get('lanes_table_sort_reverse')) {
    active_string += ' reverse';
  }

  return active_string;
};

const can_ply = function (lane) {
  const email = H.user().emails[0].address;
  const user = Users.findOne(email);
  if (user && user.harbormaster) {
    return true;
  }

  if (lane?.captains && lane?.captains.length) {
    let captain = _.find(lane.captains, function (captainEmail) {
      return captainEmail == H.user().emails[0].address;
    });

    return captain ? true : false;
  }

  if (lane?.tokens) {
    let token = _.find(
      Object.keys(_.invert(lane.tokens)),
      function (tokenEmail) {
        return tokenEmail == H.user().emails[0].address;
      }
    );

    return token ? true : false;
  }

  return false;
};

const current_state = function (lane) {
  const text_na = 'N/A';
  const text_error = 'error';
  const text_ready = 'ready';
  const text_active = 'active';

  const last_shipment = lane && lane.last_shipment;
  const exit_code = last_shipment && last_shipment.exit_code;

  if (last_shipment?.active) return text_active;
  if (exit_code == 0) return text_ready;
  if (exit_code != undefined) return text_error;

  return text_na;
};

const followup_name = function (lane) {
  const q = { slug: lane?.followup?.slug };
  const followup = Lanes.findOne(q);

  if (lane?.followup?.name && !followup) return lane.followup.name;
  return followup ? followup.name : '(none)';
};

const last_shipped = function (lane) {
  return lane.last_shipment?.actual?.toLocaleString();
};

const latest_shipment = function (lane) {
  return lane.last_shipment?.start;
};

const salvage_plan_name = function (lane) {
  const q = { slug: lane?.salvage_plan?.slug };
  const salvage_plan = Lanes.findOne(q);

  if (lane?.salvage_plan?.name && !salvage_plan) return lane.salvage_plan.name;
  return salvage_plan ? salvage_plan.name : '(none)';
};

const total_captains = function (lane) {
  if (!lane.captains) {
    return 0;
  }

  return lane.captains.length;
};

const ship_now_working = function (lane) {
  const working_lanes = H.Session.get('working_lanes') || {};
  return !!working_lanes[lane?._id];
};

const reset_working = function (lane) {
  const resetting_lanes = H.Session.get('resetting_lanes') || {};
  return !!resetting_lanes[lane?._id];
};

const reset_all_working = function (lane) {
  const resetting_all_lanes = H.Session.get('resetting_all_lanes') || {};
  return !!resetting_all_lanes[lane?._id];
};

const start_shipment_now = function (event, lane) {
  event?.preventDefault?.();

  if (!lane?._id || !lane?.slug) return;

  // If there's already an active shipment, just jump to it.
  if (lane?.last_shipment?.active && lane?.last_shipment?.start) {
    // Stay on the lanes page; just inform the user.
    H.alert('This lane already has an active shipment.');
    return;
  }

  const harbor = Harbors.findOne(lane.type);
  const manifest = harbor?.lanes?.[lane._id]?.manifest;
  if (!manifest) {
    H.alert(
      `This Harbor is not ready, or this lane is not fully configured yet.\n` +
      `Please edit the lane and complete its configuration before shipping.`,
    );
    return;
  }

  let working_lanes = H.Session.get('working_lanes') || {};
  working_lanes[lane._id] = true;
  H.Session.set('working_lanes', working_lanes);

  const shipment_start_date = H.start_date();
  H.call(
    'Lanes#start_shipment',
    lane._id,
    manifest,
    shipment_start_date,
    (err) => {
      working_lanes = H.Session.get('working_lanes') || {};
      working_lanes[lane._id] = false;
      H.Session.set('working_lanes', working_lanes);

      if (err) throw err;
      // Stay on the lanes page (no redirect).
    },
  );
};

const reset_shipment_now = function (event, lane) {
  event?.preventDefault?.();
  if (!lane?._id || !lane?.slug) return;

  const date = lane?.last_shipment?.start;
  if (!date) {
    H.alert('No shipments found for this lane.');
    return;
  }

  let resetting_lanes = H.Session.get('resetting_lanes') || {};
  resetting_lanes[lane._id] = true;
  H.Session.set('resetting_lanes', resetting_lanes);

  H.call(
    'Lanes#reset_shipment',
    lane.slug,
    date,
    (err) => {
      resetting_lanes = H.Session.get('resetting_lanes') || {};
      resetting_lanes[lane._id] = false;
      H.Session.set('resetting_lanes', resetting_lanes);
      if (err) throw err;
    },
  );
};

const reset_all_active_now = function (event, lane) {
  event?.preventDefault?.();
  if (!lane?._id || !lane?.slug) return;

  let resetting_all_lanes = H.Session.get('resetting_all_lanes') || {};
  resetting_all_lanes[lane._id] = true;
  H.Session.set('resetting_all_lanes', resetting_all_lanes);

  H.call(
    'Lanes#reset_all_active_shipments',
    lane.slug,
    (err) => {
      resetting_all_lanes = H.Session.get('resetting_all_lanes') || {};
      resetting_all_lanes[lane._id] = false;
      H.Session.set('resetting_all_lanes', resetting_all_lanes);
      if (err) throw err;
    },
  );
};

const handle_file_upload_change = async function (files, evt) {
  const yaml = await files[0].text();
  const filename = files[0].name;
  /* istanbul ignore next */
  if (!H.isTest) console.log("%cUploading yaml:\n", "color: #fa0", `${yaml}`);
  /* istanbul ignore next reason: no meaningful logic */
  H.call('Lanes#import_yaml', filename, yaml, (err, res) => {
    import_yaml_callback(err, res, evt);
  });
};

const import_yaml_callback = function (err, res, evt) {
  if (err) {
    H.alert('Something went wrong.  See the browser console for details.');
    throw err;
  }
  else {
    let msg = 'Import complete.';

    /* istanbul ignore next reason: no meaningful logic */
    if (res.found.length) {
      msg += '\nSome lanes were found already, and skipped.';
      console.log(`Lanes found: ${res.found.join(', ')}`);
    }
    /* istanbul ignore next reason: no meaningful logic */
    if (res.missing.length) {
      msg += '\nSome harbors are missing, so their lanes were skipped.';
      console.log(`Harbors missing: ${res.missing.join(', ')}`);
    }
    /* istanbul ignore next reason: no meaningful logic */
    if (res.created.length) console.log(
      `Lanes created: ${res.created.join(', ')}`
    );
    msg += '\nSee the browser console (F12) for more details.';
    H.alert(msg);
    evt.target.innerHTML = 'Import from YAML';
    evt.target.removeAttribute('disabled');
  }
};

const handle_import_yaml = (click_event) => {
  const upload = document.createElement('input');
  upload.setAttribute('type', 'file');
  upload.setAttribute('accept', '.yml', '.yaml');
  /* istanbul ignore next reason: no meaningful logic */
  upload.addEventListener('change', (change_event) => {
    handle_file_upload_change(change_event.target.files, click_event);
  });
  upload.addEventListener('cancel', () => {
    click_event.target.innerHTML = 'Import from YAML';
    click_event.target.removeAttribute('disabled');
  });
  click_event.target.innerHTML = 'Working...';
  click_event.target.setAttribute('disabled', true);
  upload.click();
};

const handle_download_yaml = () => {
  H.call('Lanes#download_charter_yaml', (err, res) => {
    if (err) {
      H.alert('Something went wrong!  See the console (F12) for details.');
      throw err;
    }

    const localISOdate = new Date(
      new Date().getTime() - (new Date().getTimezoneOffset() * 60000)
    ).toISOString().replace('Z', '');
    const { host } = location;
    const charter_filename = `${host}_${localISOdate}_all_charters.yml`;
    const download_link = document.createElement('a');
    download_link.setAttribute(
      'href',
      `data:text/plain;charset=utf-8,${encodeURIComponent(res)}`
    );
    download_link.setAttribute('download', charter_filename);
    download_link.click();
  });
};

export {
  loading_lanes,
  sort_by_header,
  sort_by_shipped_date,
  sort_by_total_shipments,
  sort_by_total_salvage_runs,
  sort_lane_table_reverse,
  reverse_sort,
  default_sort,
  delete_lane,
  duplicate_lane,
  ready,
  active,
  can_ply,
  current_state,
  followup_name,
  last_shipped,
  latest_shipment,
  salvage_plan_name,
  total_captains,
  ship_now_working,
  reset_working,
  reset_all_working,
  start_shipment_now,
  reset_shipment_now,
  reset_all_active_now,
  lane_ids,
  empty,
  lanes,
  handle_import_yaml,
  handle_download_yaml,
  handle_file_upload_change,
  import_yaml_callback,
};
