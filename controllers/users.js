const model = require("../models/users")
const debug = require("debug")("backend:controler:users")

/**
 * Checks new user and create it if not exist
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
function handleNewUser( req, res, next ) {
    model.newUser( req.body.phoneNum ).then( result => {
        res.json( result ) // { id: "id" : pass : "pass"}
    } ).catch( err => {
        debug(err)
        if( err.code == "ER_DUP_ENTRY" ) res.sendStatus(422);
        else res.sendStatus(400)
    } )
}

/**
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Function} next
 */
function handleValidation( req, res, next ) {
    debug("Validation code: " + req.body.valCode)
    model.getUserByPhonePassword( req.body.phoneNum, req.body.valCode ).then( result => {
        debug("Validation result is: " + result)

        if( result !== NaN )    res.json( { id : result } )
        else                    res.sendStatus(403)
    } ).catch( err => {
        debug(err)
        res.sendStatus(400)
    } )
}

/**
 * Updates user info in database. The `req` body has to contain the field to update
 * Posible values of pref are:
 *      pref_name
 *      pref_email
 *      pref_addr
 *      pref_password
 * The request has to contain also user's phone number that is used as an indentificator
 * of the user. The req.body.val is the new value to set for req.body.pref
 *
 * Return   200 OK when update was made or attempted
 *          403 when wrong preference was set in req.body.pref
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
function handleDataUpdate( req, res ) {
    debug("User: " + req.body.phoneNum + " field: " + req.body.pref + " value: " + req.body.val )

    let fn = null

    switch( req.body.pref ) {
        case "pref_name":
            fn = model.updateName
            break
        case "pref_email":
            fn = model.updateEmail
            break
        case "pref_addr":
            fn = model.updateAddress
            break
        case "pref_password":
            fn = model.updatePassword
            break
        default:
            res.sendStatus(403)
    }

    if( fn !== null ) {
        fn( req.body.phoneNum, req.body.val ).then( result => {
            res.sendStatus(200)
        } ).catch( err => {
            debug( err )
        } )
    }
}

function handleGetUsers( req, res, next ) {

}

/**
 * Get one user identified by phone number
 * The phone number is part of the URL
 * Returns user information or 404 not found
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
function handleGetByPhone( req, res ) {
    const phoneNum = req.params.phone;




}

function init( router ) {
    router.get( "/users", handleGetUsers )
    router.get( "/users/phone/:phone", handleGetByPhone )
    router.post( "/users/new", handleNewUser )
    router.post( "/users/val", handleValidation )
    router.post( "/users/update", handleDataUpdate )
}

module.exports = init
