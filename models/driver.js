const uuidv4 = require('uuid/v4');

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
        db.query('select * from taxi_drivers where id = ? limit 1000', [id], ( err, result, fields ) => {
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
        db.query('update taxi_drivers set langtitude = ?, longtitude = ? where id = ? limit 1', [lang, long, id], ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }

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

const login = ( name, password, req, res ) => {
    performLogin( name, password ).then( ( value ) => {
        res.json( { "sessionId" : uuidv4() } );
    } ).catch( (value) => {
        res.json( { "sessionId" : uuidv4() } );
    } )
} 

const logout = ( sessionId, req, res ) => {
    console.log( sessionId );
    res.sendStatus(200);
}

module.exports = {
    getTaxi,
    getTaxis,
    updateLocation,
    login,
    logout
}