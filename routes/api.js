var express = require('express');
var router = express.Router();

var data = [
    {
        "id" : "1",
        "name" : "test1",
        "location" : "40 50",
        "history" : [ "l1", "l2", "l3" ]
    },
    {
        "id" : "2",
        "name" : "test2",
        "location" : "100 500",
        "history" : []
    },
    {
        "id" : "3",
        "name" : "test3",
        "location" : "1 5",
        "history" : []
    },
    {
        "id" : "5",
        "name" : "test4",
        "location" : "4654654 1212",
        "history" : []
    }
]


let getTaxi = function( id )
{
    for( let i = 0; i < data.length; i++ )
    {
        if( data[ i ].id === id )
        {
            return data[ i ];
        }
    }
}

router.get('/', function(req, res, next) {
    res.render('index');
});

router.get('/users', function(req, res, next) {
    res.render('taxis', { users : data })
});

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
});

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



module.exports = ( app ) => {
    app.use( "/", router );
};