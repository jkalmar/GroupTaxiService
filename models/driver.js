const db = require('./database');

const getTaxis = function()
{
    return new Promise( (resolve, reject) => {
        db.query( 'select * from taxi_drivers', ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }

            resolve( result );
        } );
    } );
}

const getTaxi = (id) => {
    return new Promise( (resolve, reject) => {
        db.query('select * from taxi_drivers where id = ?', [id], ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }

            resolve( result );
        } );
    } );
}

const updateLocation = (lang, long, id) => {
    return new Promise( (resolve, reject) => {
        db.query('update taxi_drivers set langtitude = ?, longtitude = ? where id = ?', [lang, long, id], ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }

            resolve( result );
        } );
    } );
}

module.exports = {
    getTaxi,
    getTaxis,
    updateLocation
}