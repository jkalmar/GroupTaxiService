const db = require('./database');


const insertIssue = ( issue ) => {


    return new Promise( ( resolve, reject ) => {
        const sql = "insert into issues (type, message) values (?, ?)";

        db.query( sql, [issue.bug, issue.msg], (err, result, fields) => {
            if( err ) { reject( err ) }

            resolve( result );
        } );
        
    } );
}

module.exports = insertIssue;