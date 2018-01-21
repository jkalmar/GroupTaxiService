const db = require('./database');
const debug = require("debug")("backend:orders");
const drivers = require( "../controllers/websocketDriver" )

const OrderTimeout = 70000
const OrderSwitchTime = 12000

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

const sqlOrderCheck = "SELECT `state` FROM `orders` WHERE `id`=?"


// TODO: dohodnut casy a prepinanie medzi vodicmi

class Order
{
    constructor( id, anOrderParams ){
        this.id = id;
        this.order = anOrderParams;
        this.accepted = false;
        this.driverId = 0;
        this.timeout = setTimeout( this.onTimeout.bind( this ), OrderTimeout );
        this.switchTimeout = setTimeout( this.onSwitch.bind( this ), OrderSwitchTime )
        this.state = orderStateNew;
    }

    onTimeout()
    {
        debug(`Timeout for order with id: ${this.id}`);
        this.state = orderStateTimeout;

        clearTimeout( this.switchTimeout )

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

    onSwitch()
    {
        if( ! this.accepted )
        {
            drivers.makeOrder( this, this.driverId ).then( value => {
                debug(value)
                if( value ){
                    this.driverId = value;
                    debug( "Found driver: " + value )
                }
                else{
                    this.driverId = 0;
                    debug("no driver available")
                }
            } ).catch( err => {
                debug(err)
            } )

            this.switchTimeout = setTimeout( this.onSwitch.bind( this ), OrderSwitchTime )
        }
    }

    onAccept( driverId, timeEstimate )
    {
        this.accepted = true;
        clearTimeout( this.timeout );
        clearTimeout( this.switchTimeout )

        this.driverId = driverId;

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
        db.query( sqlOrderCancel, [ this.id ] ,( err, result, fields ) => {
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

        drivers.makeOrder( theOrder, 0 ).then( value => {
            debug(value)
            if( value ){
                debug("all ok")
            }
            else{
                debug("no driver available")
            }

            theOrder.driverId = value;
        } ).catch( err => {
            debug(err)
        } )

        res.json( { "id" : theOrder.id, "state" : orderStateNew } );
    } )
}

/**
 * Called from customer to check the status of the order
 * it sends back the state of the order and the time estimate to driver arrival
 * TODO: in future version also return any new message to user
 */
function checkOrder( req, res )
{
    const theId = req.params.id;

    if( theId === undefined )
    {
        res.sendStatus( 400 );
        return;
    }

    if( orders[ theId ] )
    {
        const theOrder = orders[ theId ]
        const obj = { "id" : theOrder.id, "state" : theOrder.state };
        res.json( obj );
    }
    else
    {
        db.query( sqlOrderCheck, [ theId ] ,( err, result, fields ) => {
            if( err )
            {
                debug( err );
                res.sendStatus(400);
            }else
            {
                if( result.length > 0 )
                {
                    const obj = {"id" : theId, "state" : result[0].state };
                    res.json( obj );
                }
                else
                {
                    res.sendStatus(400);
                }
            }
        } );
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
    const theId = req.params.id;

    if( theId )
    {
        const theOrder = orders[ theId ];
        if( theOrder )
        {
            theOrder.onCancel()
            const obj = { "id" : theOrder.id, "state" : theOrder.state };
            res.json( obj )
        }
        else{
            res.sendStatus(409)
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
