const mysql = require('mysql');
const debug = require("debug")("backend:database")
const config = require("../config/config.json")
const connection = mysql.createConnection( config.dbTaxi );

var drivers = new Map(); // Currently logged drivers

const sqlInitTaxi = "UPDATE `taxi_drivers` SET `logged` = '0', `active` = '0'"
const sqlFindNearDrivers = "SELECT id, (6371 * acos(cos(radians(?)) * " +
                           "cos(radians(latitude)) * cos(radians(longitude) - radians(?)) + sin(radians(?)) * " +
                           "sin(radians(latitude ))) ) AS distance " +
                           "FROM taxi_drivers WHERE logged = 1 AND latitude IS NOT NULL ORDER BY distance LIMIT 0, 3;"

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
    debug(point)

    connection.query( sqlFindNearDrivers, [ point.lat, point.lng, point.lat ], (err, resSet, fields) => {
      if( err ) {
        reject( err )
        return
      }

      let resDrivers = []

      for( i = 0; i < resSet.length; i++ ) {
        debug("Nearest drivers: " + i)
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
  findNearestDrivers
}
