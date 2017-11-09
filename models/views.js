const db = require('./database');

const incView = function( aPage )
{
    return new Promise( (resolve, reject) => {
        const sql = 'insert into views SET name=?, views=1 ON DUPLICATE KEY UPDATE views=views+1';

        db.query( sql, [ aPage ], ( err, result, fields ) => {
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