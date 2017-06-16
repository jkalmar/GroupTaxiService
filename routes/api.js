var express = require('express');
var router = express.Router();

const data = [
    {
        "id" : "1",
        "name" : "vlado",
        "location" : "40 50"
    },
    {
        "id" : "2",
        "name" : "jano",
        "location" : "100 500"
    },
    {
        "id" : "3",
        "name" : "veronika",
        "location" : "1 5"
    },
    {
        "id" : "5",
        "name" : "test2",
        "location" : "4654654 1212"
    }
]


router.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

router.get('/users', function(req, res, next) {
    res.render('taxis', { users : data })
});

router.get('/users/:id', function(req, res, next) {
    let i = 0;

    console.log( req.params.id );

    for( i; i < data.length; i++ )
    {
        if( data[i].id == req.params.id )
        {
            break;
        }
    }

    console.log( i );
    console.log( data[i] );

    res.render('taxi', { user : data[i] })
});



module.exports = ( app ) => {
    app.use( "/", router );
};