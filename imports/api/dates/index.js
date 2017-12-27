
function start_date () {
  let date = new Date();
  let start_date = date.getFullYear() + '-' +
    date.getMonth() + '-' +
    date.getDate() + '-' +
    date.getHours() + '-' +
    date.getMinutes() + '-' +
    date.getSeconds()
  ;

  return start_date;
}

export {
  start_date,
}
