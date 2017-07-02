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