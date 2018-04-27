const db = require('./database');

const sqlBlacklistGetAll = 'SELECT `id`, `simSerial`, `deviceSerial`, `id_DRIVER`, `comment`, `date` FROM `blacklist`';
const sqlBlacklistInsert = 'INSERT INTO `blacklist` (`simSerial`, `deviceSerial`, `id_DRIVER`, `comment`) VALUES (?,?,?,?)'
const sqlBlacklistDelete = 'DELETE FROM `blacklist` WHERE `id`=?'
const sqlBlacklistCheck = 'SELECT `id` FROM `blacklist` WHERE `simSerial`=? or `deviceSerial`=?'


function getAll()
{
    return new Promise( (resolve, reject) => {
        db.c.query( sqlBlacklistGetAll, [], ( err, result, fields ) => {
            if( err ) reject( err );

            resolve( result );
        } );
    } );
}

/**
 *
 * @param {BlacklistItem} ab
 */
function insertNew( ab )
{
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlBlacklistInsert, [ ab.simSerial, ab.deviceSerial, ab.driver, ab.comment ], ( err, result, fields ) => {
            if( err ) reject( err );
            resolve(result)
        } )
    } )
}

/**
 *
 * @param {Number} id
 */
function deleteItem( id )
{
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlBlacklistDelete, [ id ], ( err, result, fields ) => {
            if( err ) reject( err );
            resolve(result)
        } )
    } )
}

/**
 * Checks if user is not in blacklist
 *
 * @param {String} simSerial
 * @param {String} deviceSerial
 */
function checkOrder( simSerial, deviceSerial )
{
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlBlacklistCheck, [ simSerial, deviceSerial ], ( err, result, fields ) => {
            if( err ) reject( err );
            resolve(result)
        } )
    } )
}

module.exports = {
    getAll,
    insertNew,
    deleteItem,
    checkOrder
}