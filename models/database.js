const mysql = require('mysql');
const debug = require("debug")("backend:database")
const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'jkalmar',
  database : 'taxi',
  password : 'Qt4.A?I:'
});

var drivers = new Map(); // Currently logged drivers

/**
 * @typedef {module:./orders:Order} O
 */

/**
 * @type {Map<Number, O>}
 */
var orders = new Map(); // Current orders in the

debug("Preping DB " + new Date().toISOString() )

const sqlInitTaxi = "UPDATE `taxi_drivers` SET `logged` = '0', `active` = '0'"

connection.connect(function(err) {
  if (err) {
    debug('Error connecting: ' + err.stack);
    return;
  }

  debug('Connected to DB id: ' + connection.threadId);

  connection.query( sqlInitTaxi, [], ( err, res, fields ) =>{
    debug("All drivers logged out and resetted")
  } )
});

module.exports = {
  c : connection,
  drivers,
  orders,
}