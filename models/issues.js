const db = require('./database');
const debug = require( "debug" )("backend:issues")


const insertIssue = ( issue ) => {
    debug( "Inserting issue" )

    return new Promise( ( resolve, reject ) => {
        const sql = "insert into issues (type, message) values (?, ?)";

        db.query( sql, [issue.bug, issue.msg], (err, result, fields) => {
            if( err ) { reject( err ) }

            resolve( result );
        } );
        
    } );
}

function getAll()
{
    debug( "Getting everything" )
    return new Promise( ( resolve, reject ) => {
        const sql = "SELECT * FROM issues";

        db.query( sql, [], (err, result, fields) => {
            if( err ) { reject( err ) }

            resolve( result );
        } );
    } );
}

module.exports = {
    insertIssue,
    getAll
}