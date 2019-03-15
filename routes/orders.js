const debug = require("debug")("backend:routes:orders")

const db = require("../models/database")

const model = require( "../models/orders" )
const auth = require('../controllers/auth');

function createNewOrder(req, res) {

}

function getOneOrder(req, res) {
    const theId = req.params.id;

    if( theId === undefined ) {
        res.sendStatus( 400 );
        return;
    }

    db.c.query( sqlOrderCheck, [ theId ] ,( err, result, fields ) => {
        if( err ) {
            debug( err );
            res.sendStatus(400);
        } else if ( result.length > 0 ) {
            res.json({ data: result[0] })

            //debug(util.inspect(result[0], false, null))
            //res.setHeader('Content-Type', 'application/json');
            //res.send(`{"id": ${theId}, "data": ${util.inspect(result[0], false, null)}`);
        } else {
            res.sendStatus(400);
        }
    } );
}

function cancelOrder(req, res) {

}

function handleTakeOrder( req, res ) {

}

function handleDenyOrder( req, res ) {

}

function handleCancelDriverOrder( req, res ) {

}

function handleFwdOrder( req, res ) {

}

function handleDoneOrder( req, res ) {

}

function handleReportOrder( req, res ) {

}

function init( router ) {
    router.post("/order", createNewOrder)
    router.get("/order/:id", getOneOrder)
    router.delete("/order/:id", cancelOrder)
    router.post("/order/:id/take", auth.isLoggedIn, handleTakeOrder)
    router.post("/order/:id/deny", auth.isLoggedIn, handleDenyOrder)
    router.post("/order/:id/canceldriver", auth.isLoggedIn, handleCancelDriverOrder)
    router.post("/order/:id/fwd", auth.isLoggedIn, handleFwdOrder)
    router.post("/order/:id/done", auth.isLoggedIn, handleDoneOrder)
    router.post("/order/:id/report", auth.isLoggedIn, handleReportOrder)
}

module.exports = init