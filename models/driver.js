const uuidv4 = require('uuid/v4');

const db = require('./database');

const sqlGetTaxis = "SELECT `id`, `username`, `latitude`, `longitude`, `rating_driver` FROM `taxi_drivers` WHERE `logged`=TRUE"

const getTaxis = function()
{
    return new Promise( (resolve, reject) => {
        db.query( sqlGetTaxis, ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }

            resolve( result );
        } );
    } );
}

const getTaxiByName = (name) => {
    return new Promise( (resolve, reject) => {
        db.query('select * from taxi_drivers where username = ? limit 1000', [name], ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }
            resolve( result );
        } );
    } );
};

const getTaxiByNamePassword = ( name, password ) => {
    return new Promise( (resolve, reject ) => {
        const sql = "select * from taxi_drivers where username = ? and password = ? limit 1";

        db.query( sql, [ name, password ], ( err, result, fields ) => {
            if( err ) reject( err );

            resolve( result );
        } );
    } );
};

const getTaxiById = ( id ) => {
    return new Promise( ( resolve, reject ) => {
        const sql = "select * from taxi_drivers where id = ? limit 1";

        db.query( sql, [ id ], ( err, result, fields ) => {
            if( err ) reject( err );

            resolve( result );
        } );
    } );
};

const insertTaxi = ( name, password ) => {
    return new Promise( ( resolve, reject ) => {
        const sql = "insert into taxi_drivers (username, password) values (?, ?)";

        db.query( sql, [name, password], (err, result, fields) => {
            if( err ) { reject( err ) }

            resolve( result );
        } );
        
    } );
}

const getTaxi = (id) => {
    return new Promise( (resolve, reject) => {
        db.query('select * from taxi_drivers where id = ? limit 1000', [id], ( err, result, fields ) => {
            if( err ) reject( err );

            resolve( result );
        } );
    } );
}

const updateLocation = (lat, long, id) => {
    return new Promise( (resolve, reject) => {
        db.query('update taxi_drivers set latitude = ?, longitude = ? where id = ? limit 1', [lat, long, id], ( err, result, fields ) => {
            if( err ) reject( err );

            resolve( result );
        } );
    } );
}

const performLogin = ( name, password ) => {
    return new Promise( ( resolve, reject ) => {
        db.query( 'select id from taxi_drivers where name = ? and password = ? limit 1', [ name, password ], ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }

            resolve( result );
        } )
    } )
}

const performLogout = ( sessionId ) => {
    
}

function login( id ){
    const sql = "update taxi_drivers set `logged` = true where `id` = ? limit 1";
    
    return new Promise( (resolve, reject) => {
        db.query( sql, [id], ( err, result, fields ) => {
            if( err ) reject( err );
    
            resolve( result );
        } );
    } );
} 

function logout( id ){
    const sql = "update taxi_drivers set `logged` = false where `id` = ? limit 1";

    return new Promise( (resolve, reject) => {
        db.query( sql, [id], ( err, result, fields ) => {
            if( err ) reject( err );

            resolve( result );
        } );
    } );
}

module.exports = {
    getTaxi,
    getTaxiByName,
    getTaxiByNamePassword,
    getTaxiById,
    getTaxis,
    updateLocation,
    login,
    logout,
    insertTaxi
}