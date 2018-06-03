const mysql = require('mysql');
const debug = require("debug")("backend:database")
const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'jkalmar',
  database : 'taxi',
  password : 'Qt4.A?I:'
});

var drivers = new Map(); // Currently logged drivers

const sqlInitTaxi = "UPDATE `taxi_drivers` SET `logged` = '1', `active` = '1'"
const sqlFindNearDrivers = "SELECT id, (6371 * acos(cos(radians(?)) * " +
                           "cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * " +
                           "sin(radians(latitude ))) ) AS distance " +
                           "FROM taxi_drivers WHERE logged = 1 AND latitude IS NOT NULL ORDER BY distance LIMIT 0, 3;"

/**
 * @typedef {module:./orders:Order} O
 */

/**
 * @type {Map<Number, O>}
 */
var orders = new Map(); // Current orders in the

debug("Preping DB " + new Date().toISOString() )

/**
 * Query database and find 3 nearest logged drivers, then load these 3 drivers from internal driver cache
 * to array
 *
 * @param {Point} point A lat, lng object from which the distance will be calculated
 * @returns {Array} Up to 3 drivers in array
 *
 */
function findNearestDrivers( point ) {
  return new Promise( ( resolve, reject ) => {
    connection.query( sqlFindNearDrivers, [ point.lat, point.lng, point.lat ], (err, resSet, fields) => {
      if( err ) {
        reject( err )
        return
      }

      resDrivers = []

      for( i = 0; i < resSet.length; i++ ) {
        let driver = drivers.get( resSet[i].id )
        if( driver ) resDrivers.push( driver )
      }

      resolve( resDrivers )
    } )
  } )
}

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
  findNearestDrivers
}