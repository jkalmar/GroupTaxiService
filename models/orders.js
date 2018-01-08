const db = require('./database');
const debug = require("debug")("backend:orders");
const drivers = require( "../controllers/websocketDriver" )

const OrderTimeout = 70000
const OrderSwitchTime = 15000

const orderStateNew = 1;
const orderStateTaken = 2;
const orderStateCanceled = 3;
const orderStateTimeout = 4;
const orderStateDone = 5;

var orders = Object.create(null)

const sqlOrderCreate = "INSERT INTO `orders` (`serial_num_device`,`place_from`, `place_to` ) VALUES (?,?,? );";
const sqlOrderTake = "UPDATE `orders` SET `id_DRIVER` = ?, `state` = " + orderStateTaken + " WHERE `id` = ? limit 1;";
const sqlOrderCancel = "UPDATE `orders` SET `state` = " + orderStateCanceled + " WHERE `id` = ? limit 1;";
const sqlOrderTimeout = "UPDATE `orders` SET `state` = " + orderStateTimeout + " WHERE `id` = ? limit 1;";
const sqlOrderDone = "UPDATE `orders` SET `state` = " + orderStateDone + " WHERE `id` = ? limit 1;";


class Order
{
    constructor( id, anOrderParams ){
        this.id = id;
        this.order = anOrderParams;
        this.accepted = false;
        this.timeout = setTimeout( this.onTimeout.bind( this ), OrderTimeout );
        this.state = orderStateNew;
    }

    onTimeout()
    {
        debug(`Timeout for order with id: ${this.id}`);
        this.state = orderStateTimeout;

        if( ! this.accepted )
        {
            // remove this order from the global list of activer orders
            // and mark it as timeout order in DB
            delete orders[ this.id ]
            db.query( sqlOrderTimeout, [ this.id ] ,( err, result, fields ) => {
                if( err ) debug( err );
            } );
        }
    }

    onAccept( driverId, timeEstimate )
    {
        this.accepted = true;
        this.driverId = driverId;
        clearTimeout( this.timeout );

        if( this.state === orderStateNew )
        {
            this.state = orderStateTaken;
            this.time = timeEstimate;
            db.query( sqlTakeOrder, [ this.driverId ,this.id ] ,( err, result, fields ) => {
                if( err ) debug( err );
            } );

            return true;
        }
        else
        {
            return false;
        }
    }

    onDenied( driverId )
    {
        this.denied = true;
        clearTimeout( this.timeout );
    }

    onCancel()
    {
        debug( "Order canceled" )
        this.state = orderStateCanceled;
        db.query( sqlCancelOrder, [ this.id ] ,( err, result, fields ) => {
            if( err ) debug( err );
        } );

        delete orders[ this.id ]
    }
}

function createNewOrder( res, aParam )
{
    debug( "Creating new order" );
    debug( "params: " );
    debug( aParam );

    db.query( sqlOrderCreate, [0, "from", "to"], ( err, result, fields ) => {
        if( err ) {
            res.sendStatus( 500 );
            return
        }

        const theId = result.insertId;
        let theOrder = new Order( theId, aParam );
        orders[ theOrder.id ] = theOrder;

        drivers.makeOrder( theOrder )

        res.json( { "id" : theOrder.id } );
    } )
}

/**
 * Called from customer to check the status of the order
 * it sends back the state of the order and the time estimate to driver arrival
 * TODO: in future version also return any new message to user
 */
function checkOrder( req, res )
{
    if( req.body.orderId )
    {
        res.sendStatus(200)
    }
    else
    {
        res.sendStatus(400)
    }
}

/**
 * Called from customer to indicate that he/she/it canceled the order
 * it sends back 200 OK on success or 500 Error on some error, in case of error the user should
 * repeat his request
 *
 * @param {express.req} req
 * @param {express.res} res
 */
function cancelOrder( req, res )
{
    const theId = req.body.orderId;

    if( theId )
    {
        const theOrder = orders[ theId ];
        if( theOrder )
        {
            theOrder.onCancel()
            res.sendStatus(200)
        }
        else{
            res.sendStatus(400)
        }
    }
    else
    {
        res.sendStatus(400)
    }
}

/**
 * Takes the order by a one driver
 * This function should check if order is not taken by some other driver
 * or is not timeouted and if is then return false. If everything is ok
 * then return true and set driver ID and timeEstimate to order
 *
 * @param {number} orderId
 * @param {number} driverId
 * @param {number} timeEstimate
 */
function takeOrder( orderId, driverId, timeEstimate )
{
    const theOrder = orders[ orderId ];

    if( theOrder ) theOrder.onAccept( driverId, timeEstimate )
}

module.exports = {
    createNewOrder,
    checkOrder,
    cancelOrder,
    takeOrder
}
