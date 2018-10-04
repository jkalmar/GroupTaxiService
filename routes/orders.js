const debug = require("debug")("backend:routes:orders")

const model = require( "../models/orders" )
const auth = require('../controllers/auth');


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
    router.post( "/order/:id/take", auth.isLoggedIn, handleTakeOrder )
    router.post( "/order/:id/deny", auth.isLoggedIn, handleDenyOrder )
    router.post( "/order/:id/canceldriver", auth.isLoggedIn, handleCancelDriverOrder )
    router.post( "/order/:id/fwd", auth.isLoggedIn, handleFwdOrder );
    router.post( "/order/:id/done", auth.isLoggedIn, handleDoneOrder )
    router.post( "/order/:id/report", auth.isLoggedIn, handleReportOrder )
}

module.exports = init