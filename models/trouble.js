const loki = require( "lokijs" );

// name of db is redundant since there will be no persistence
// accross different runs
// client has to resend his panic condition every N second in order to
// get to a system ( this is also for network errors )
const db = new loki( "trouble.db" );

const drivers = db.addCollection( 'panic' );

drivers.insert( { id : "vlado", lang : "12", long : "10" } );
drivers.insert( { id : "v", lang : "hj", long : "1hhh0" } );
drivers.insert( { id : "h", lang : "kk", long : "1jjj0" } );


/**
 * Strip lokijs specific meta data
 * 
 * @param {*} results  Data from lokijs db query
 */
function stripResultsMetadata( results ) {
	const records = []
	for (let idx = 0; idx < results.length; idx++) {
		const loki_rec = results[ idx ]
		const clean_rec = Object.assign({}, loki_rec)
		delete clean_rec['meta']
		delete clean_rec['$loki']
		records.push( clean_rec )
	}
	return records
}


/**
 * Get all drivers that are in some kind of trouble
 * All clients should periodically check if someone has trouble
 * so they can help that driver
 */
const getAll = ( req, res, next ) => {
    const result = stripResultsMetadata( drivers.find() );

    res.json(result);
}


/**
 * Add new driver to drivers in trouble db
 * This function is reentrant and so client can send periodically that
 * he needs help
 * New driver is in req.body json data structure
 */
const addNew = ( req, res, next ) => {
    aDriver = drivers.findOne( { 'id' : req.body.id } );

    if( aDriver == null ) {
        drivers.insert( req.body );
    }
    else{
        aDriver.lang = req.body.lang;
        aDriver.long = req.body.long;

        drivers.update(aDriver);
    }

    res.sendStatus(200);
}


/**
 * Delete driver from trouble db
 * If client send DELETE with his id then he is deleted from trouble DB and
 * everybody will not need to help him anymore
 */
const deleteDriver = ( req, res, next ) => {
    drivers.findAndRemove( { 'id' : req.body.id } );

    res.sendStatus(200);
}

module.exports = {
    getAll,
    addNew,
    deleteDriver
}