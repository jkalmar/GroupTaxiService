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

function handleLostPassword( req, res ) {
    model.lostPassword( req.body.phoneNum ).then( result => {
        res.json( result ) // { pass : "pass"}
    } ).catch( err => {
        debug(err)
        res.sendStatus(400)
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

        // Check if the result is NaN using isNaN and if yes then the user validation
        // code is wrong and so send him 403 status
        if( isNaN( result )  ) {
            res.sendStatus(403)
        } else {
            res.json( { id : result } )
        }
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
    debug("User: " + req.body.phoneNum + " field: " + req.body.key + " value: " + req.body.value )

    let fn = null

    switch( req.body.key ) {
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
        case "comment":
            fn = model.updateComment
            break
        default:
            res.sendStatus(403)
    }

    if( fn !== null ) {
        fn( req.body.phoneNum, req.body.value ).then( result => {
            res.sendStatus(200)
        } ).catch( err => {
            debug( err )
            res.sendStatus(500)
        } )
    }
}

/**
 * Gets all user in DB, this can take a lot of time if there is a lot
 * of users in DB
 * TODO: need to implement partial loading
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
function handleGetUsers( req, res ) {
    model.getAllUsers().then( result => {
        res.json( result )
    } ).catch( err => {
        debug(err)
        res.sendStatus(400)
    })
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

    model.getUserByPhone( phoneNum ).then( result => {
        if( result != null ) {
            res.json( result )
        } else {
            res.sendStatus(404)
        }
    }).catch( err => {
        debug(err)
        res.sendStatus(400)
    } )
}

function init( router ) {
    router.get( "/users", handleGetUsers )
    router.get( "/users/phone/:phone", handleGetByPhone )
    router.post( "/users/new", handleNewUser )
    router.post( "/users/lost", handleLostPassword );
    router.post( "/users/val", handleValidation )
    router.post( "/users/update", handleDataUpdate )
}

module.exports = init
