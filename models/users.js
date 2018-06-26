const db = require('./database');

const sqlGetAllUsers = "SELECT id, nick, phone, email, address FROM customers"
const sqlGetUserByPhone = "SELECT id, nick, phone, email, address, password FROM customers WHERE `phone`=? LIMIT 1"
const sqlGetUserByPhonePassword = "SELECT id FROM customers WHERE `phone`=? AND `password`=? LIMIT 1"
const sqlInserNewUser = "INSERT INTO customers (`phone`, `password`) VALUES (?, ?)"
const sqlUpdateNick = "UPDATE LOW_PRIORITY `customers` SET `nick`=? WHERE `id`=? limit 1"
const sqlUpdateEmail = "UPDATE LOW_PRIORITY `customers` SET `email`=? WHERE `id`=? limit 1"
const sqlUpdateAddress = "UPDATE LOW_PRIORITY `customers` SET `address`=? WHERE `id`=? limit 1"


/**
 * Query the database and return the list of all users. This function can take a lot of time
 * and return a lot of data. Need to optimize it to support lazy loading of data
 */
function getAllUsers() {
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlGetAllUsers, [], ( err, result, fields ) => {
            if( err )   reject(err)
            else        resolve(result)
        } )
    } )
}

/**
 * Get one or zero user from database based on user's phone number
 *
 * @param {String} phone    The phone number of the user
 */
function getUserByPhone( phone ) {
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlGetUserByPhone, [ phone ], ( err, result, fields ) => {
            if( err )   reject(err)
            else        resolve(result)
        } )
    } )
}

/**
 * Return user or NaN based on correct phone <-> password combination
 *
 * @param {String} phone
 * @param {String} password
 */
function getUserByPhonePassword( phone, password ) {
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlGetUserByPhonePassword, [ phone, password ], ( err, result ) => {
            if( err )   reject(err)
            else        resolve( result.length == 1 ? result[0].id : NaN)
        } )
    } )
}

/**
 * Inserts new user into db and set his/her phone number and also generate new validation
 * code for SMS/email validation
 *
 * @param {String} phone
 */
function newUser( phone ) {
    return new Promise( ( resolve, reject ) => {
        const initialPassword = Math.floor(100000 + Math.random() * 900000)

        db.c.query( sqlInserNewUser, [ phone, initialPassword ], ( err, result, fields ) => {
            if( err )   reject(err)
            else {
                resolve( {
                    id : result.insertId,
                    pass : initialPassword
                } )
            }
        } )
    } )
}

/**
 * Updates the name of the user identified by "id"
 *
 * @param {Number} id   The id representing the user, this is the key in user table
 * @param {String} name The new name/nick value
 */
function updateName( id, name ) {
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlUpdateNick, [ name, id ], ( err, result, fields ) => {
            if( err )   reject(err)
            else        resolve(0)
        } )
    } )
}

/**
 * Updates the email of the user identified by "id"
 *
 * @param {Number} id       The id representing the user, this is the key in user table
 * @param {String} email    The new email value, len 0 is valid and deletes user email
 */
function updateEmail( id, email ) {
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlUpdateEmail, [ email, id ], ( err, result, fields ) => {
            if( err )   reject(err)
            else        resolve(0)
        } )
    } )
}

/**
 * Updates the address of the user identified by "id"
 *
 * @param {Number} id       The id representing the user, this is the key in user table
 * @param {String} address  The new address value, len 0 is valid and deletes user address
 */
function updateAddress( id, address ) {
    return new Promise( ( resolve, reject ) => {
        db.c.query( sqlUpdateAddress, [ address, id ], ( err, result, fields ) => {
            if( err )   reject(err)
            else        resolve(0)
        } )
    } )
}

module.exports = {
    getAllUsers,
    getUserByPhone,
    getUserByPhonePassword,
    newUser,
    updateName,
    updateEmail,
    updateAddress
}
