var express = require('express');
var router = express.Router();

const taxi_drivers = require('../models/driver');

router.get('/', function(req, res, next) {
    taxi_drivers.getTaxis().then( value => {
        res.render('taxis', { users : value });
    } );
});

router.get('/users', function(req, res, next) {
    res.render('taxis', { users : data })
});

/**
 * Updates driver location
 * Location is in lang, long GPS coordinates
 */
router.post('/driver/:id', ( req, res, next ) => {

} );

/**
 * Send message to user
 */
router.post('/communication', ( req, res, next ) => {

} );

/**
 * Get all pending messages from chat
 */
router.get('/comunication', ( req, res, next ) => {

});

/**
 * Post new order from user to system
 */
router.post('/order',( req, res, next ) => {

});

/**
 * Get new orders from system to taxi
 * This considers also driver total orders
 */
router.get('/order/:driverId', ( req, res, next ) => {

});

/**
 * Take specific order
 * This will send confirmating respons to driver in case there are more
 * drivers taking this order simultanuosly
 */
router.post('/take/:id', ( req, res, next ) => {

});


/**
 * Register user to database
 * Creates new user in db and afterward allow this user to rate and make orders for others
 */
router.post('/register', ( req, res, next ) => {

});

/**
 * Rate driver
 * Registered user can rate driver
 */
router.post('/rate/:driverId', ( req, res, next ) => {

});

/**
 * Blacklist a user
 * Blaclisted user can not make new order as this user was doing something bad in the past
 * In the post body there has to be info about who to blacklist, newer blacklist user by his
 * registered id, but rather phone id or name or phone number so the user can be detected
 * even from different location/registration
 */
router.post('/blacklist', ( req, res, next ) => {

});

/**
 * Get all blacklisted users
 * Send all blacklisted users to driver
 */
router.get('/blacklist', ( req, res, next ) => {

});


/**
 * Deletes blacklisted user from blacklist
 * User can now make orders, json send to server is generater from GET /blacklist and from those
 * information about user so he/she can be removed from DB
 */
router.delete('/blacklist', ( req, res, next ) => {

});


/*
router.get('/users/:id', function(req, res, next) {
    console.log( req.params.id );

    let d = getTaxi( req.params.id );

    if( d )
    {
        res.render('taxi', { user : d } );
    }
    else
    {
        res.render( 'taxi', { user : { "id" : "Nan", "name" : "Default", "location" : "Default", "history" : [] } } );
    }
});*/

/*
router.post( '/api/add', function( req, res )
{
    data.push( req.body ); 

    console.log( req.body );

    res.sendStatus( 200 );
});

router.post( '/api/gps/:id', function( req, res )
{
    let driver = getTaxi( req.params.id );

    driver.history.push( req.body.location );

    res.sendStatus( 200 );
} )
*/


module.exports = ( app ) => {
    app.use( "/", router );
};