Meteor.Spinner.options = {
  lines: 25, // The number of lines to draw
  length: 1, // The length of each line
  width: 10, // The line thickness
  radius: 100, // The radius of the inner circle
  corners: 1, // Corner roundness (0..1)
  rotate: 18, // The rotation offset
  direction: 1, // 1: clockwise, -1: counterclockwise
  color: '#ffae00', // #rgb or #rrggbb
  speed: 1, // Rounds per second
  trail: 25, // Afterglow percentage
  shadow: false, // Whether to render a shadow
  hwaccel: true, // Whether to use hardware acceleration
  className: 'spinner', // The CSS class to assign to the spinner
  zIndex: 2e9, // The z-index (defaults to 2000000000)
  top: '50%', // Top position relative to parent in px
  left: '50%' // Left position relative to parent in px
};

Loading.configure(Meteor.Spinner.options);
