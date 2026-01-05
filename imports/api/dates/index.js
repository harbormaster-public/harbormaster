
const start_date = function () {
  let date = new Date();
  let startDateString = date.getFullYear() + '-' +
    date.getMonth() + '-' +
    date.getDate() + '-' +
    date.getHours() + '-' +
    date.getMinutes() + '-' +
    date.getSeconds()
  ;

  return startDateString;
};

export {
  start_date,
};
