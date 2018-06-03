const db = require('./database');

const sqlView = 'insert into views SET name=?, views=1 ON DUPLICATE KEY UPDATE views=views+1';


const incView = function( aPage )
{
    return new Promise( (resolve, reject) => {

        db.c.query( sqlView, [ aPage ], ( err, result, fields ) => {
            if( err )
            {
                reject( err );
            }

            resolve( result );
        } );
    } );
}

module.exports = {
    incView
}