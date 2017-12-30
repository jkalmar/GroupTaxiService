const db = require('./database');
const debug = require("debug")("backend:orders");
const drivers = require( "../controllers/websocketDriver" )

const OrderTimeout = 70000
const OrderSwitchTime = 15000

var currentId = 1;

var Orders = {}

class Order
{
    constructor( id, anOrderParams ){
        this.id = id;
        this.order = anOrderParams;
        this.accepted = false;
        this.timeout = setTimeout( this.onTimeout, OrderTimeout );
    }

    onTimeout()
    {
        debug(`Timeout for order with id: ${this.id}`);

        if( ! this.accepted )
        {

        }
    }

    onAccept( driverId )
    {
        this.accepted = true;
        this.driverId = driverId;
        clearTimeout( this.timeout );
    }

    onDenied( driverId )
    {
        this.denied = true;
        clearTimeout( this.timeout );
    }
}

function createNewOrder( res, aParam )
{
    debug( "Creating new order" );
    debug( "params: " );
    debug( aParam );
    let theOrder = new Order( currentId++, aParam );

    //Orders[ theOrder.id ] = theOrder;

    drivers.makeOrder( theOrder.order, theOrder.id )

    debug( `sending id: ${theOrder.id}` );
    res.json( { "id" : theOrder.id } );
}

module.exports = {
    createNewOrder
}
