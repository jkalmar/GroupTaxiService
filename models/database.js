const mysql      = require('mysql');
const connection = mysql.createConnection({
  host     : 'localhost',
  user     : 'jkalmar',
  database : 'taxi',
  password : 'Qt4.A?I:'
});

console.log("Preping DB")

const sqlInitTaxi = "UPDATE `taxi_drivers` SET `logged` = '0'"

connection.connect(function(err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }

  console.log('connected as id ' + connection.threadId);

  connection.query( sqlInitTaxi, [], ( err, res, fields ) =>{
    console.log("drivers reseted")
  } )
});

module.exports = connection;