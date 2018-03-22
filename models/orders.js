const db = require('./database');
const debug = require("debug")("backend:orders");

const OrderTimeout = 60000
const OrderSwitchTime = 12000
const OrderDoneTimeout = 30000

const orderStateNew = 1;
const orderStateTaken = 2;
const orderStateCanceled = 3;
const orderStateTimeout = 4;
const orderStateDone = 5;

const sqlOrderCreate = "INSERT INTO `orders` (`serial_num_device`,`place_from`, `place_to` ) VALUES (?,?,? );";
const sqlOrderTake = "UPDATE `orders` SET `id_DRIVER` = ?, `state` = " + orderStateTaken + " WHERE `id` = ? limit 1;";
const sqlOrderCancel = "UPDATE `orders` SET `state` = " + orderStateCanceled + " WHERE `id` = ? limit 1;";
const sqlOrderTimeout = "UPDATE `orders` SET `state` = " + orderStateTimeout + " WHERE `id` = ? limit 1;";
const sqlOrderDone = "UPDATE `orders` SET `state` = " + orderStateDone + " WHERE `id` = ? limit 1;";

const sqlOrderCheck = "SELECT `state` FROM `orders` WHERE `id`=?"

class Order
{
    constructor( anOrderParams ){
        this.params = anOrderParams;
        this.accepted = false;
        this.driverId = 0;
        this.driver = null;
        this.timeout = setTimeout( this.onTimeout.bind( this ), OrderTimeout );
        this.switchTimeout = setTimeout( this.onSwitch.bind( this ), OrderSwitchTime )
        this.doneTimeout = 0;
    }

    onTimeout()
    {
        debug(`Timeout for order, id: ${this.params.id}`);
        this.params.state = orderStateTimeout;

        clearTimeout( this.switchTimeout )

        if( ! this.accepted )
        {
            // remove this order from the global list of active orders
            // and mark it as timeout order in DB
            db.orders.delete( this.params.id )
            db.c.query( sqlOrderTimeout, [ this.params.id ] ,( err, result, fields ) => {
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

    onAccept( aDriver, newParams )
    {
        if( this.params.state === orderStateNew )
        {
            this.accepted = true;
            this.driver = aDriver;
            this.params = newParams;

            clearTimeout( this.timeout );
            clearTimeout( this.switchTimeout )

            db.c.query( sqlOrderTake, [ this.driverId ,this.params.id ] ,( err, result, fields ) => {
                if( err ) debug( err );
            } );

            aDriver.send( "order", this.params );
            return true;
        }
        else
        {
            return false;
        }
    }

    onDenied( driverId )
    {
        if( this.params.state == orderStateNew ) {
            if( this.driverId == driverId ) {
                clearTimeout( this.switchTimeout );
                this.onSwitch()
            }
            else {
                debug( "WARNING: Driver with id: " + driverId + " wants to denied order for driver: " + this.driverId );
            }
        }
        else {
            debug( "INFO: Ignoring denying of not new order" );
        }
    }

    onCancelUser()
    {
        debug( "Order canceled" )
        this.params.state = orderStateCanceled;
        db.c.query( sqlOrderCancel, [ this.params.id ] ,( err, result, fields ) => {
            if( err ) debug( err );
        } );

        db.orders.delete( this.params.id )
    }

    onCancelDriver() {

    }

    onDone( newParams )
    {
        debug( "onDone" );

        if( this.params.state == orderStateTaken )
        {
            this.params = newParams;

            db.c.query( sqlOrderDone, [ this.params.id ], ( err, resuld, fields ) => {
                if( err ) debug( err );
            } );

            this.doneTimeout = setTimeout(this.onDoneTimeout.bind( this ), OrderDoneTimeout )
        }
    }

    onDoneTimeout()
    {
        db.orders.delete( this.params.id )
        this.doneTimeout = 0;
    }
}

function createNewOrder( res, aParam )
{
    debug( "Creating new order" );
    debug( "params: " );
    debug( aParam );

    db.c.query( sqlOrderCreate, [0, "from", "to"], ( err, result, fields ) => {
        if( err ) {
            res.sendStatus( 500 );
            return
        }

        const theId = result.insertId;

        // create new order and set id
        aParam.id = theId;
        let theOrder = new Order( aParam );
        db.orders.set( theOrder.params.id, theOrder )

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

        res.json( { "id" : theOrder.params.id, "data" : theOrder.params } );
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

    if( db.orders.has( theId ) )
    {
        const theOrder = db.orders.get( theId )
        const obj = { "id" : theOrder.params.id,  "data" : theOrder.params };
        res.json( obj );
    }
    else
    {
        db.c.query( sqlOrderCheck, [ theId ] ,( err, result, fields ) => {
            if( err )
            {
                debug( err );
                res.sendStatus(400);
            }else
            {
                if( result.length > 0 )
                {
                    // TODO: Store json to db
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
        const theOrder = db.orders.get( theId );
        if( theOrder )
        {
            theOrder.onCancel()
            const obj = { "id" : theOrder.params.id, "state" : theOrder.params.state, "data" : theOrder.params };
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
 * @param {order} newParams
 * @param {Driver} aDriver
 */
function takeOrder( newParams, aDriver )
{
    debug("Taking order");
    const theOrder = db.orders.get( newParams.id );

    if( theOrder ) theOrder.onAccept( aDriver, newParams )
}


/**
 * Declines this order by some driver
 * This function check the order and the driver ID, if they match, it will
 * get next driver for the order and send the order to him
 *
 * @param {Order} orderParams
 * @param {Driver} aDriver
 */
function declineOrder( orderParams, aDriver )
{
    const theOrder = db.orders.get( orderParams.id );

    if( theOrder ) {
        theOrder.onDenied( aDriver.id );
    }
    else {
        debug( "WARNING: No order with id: " + orderParams.id + " found in declineOrder" );
    }
}


function finishOrder( orderParams, aDriver )
{
    const theOrder = db.orders.get( orderParams.id );

    if( theOrder ) theOrder.onDone( orderParams );
}

module.exports = {
    createNewOrder,
    checkOrder,
    cancelOrder,
    takeOrder,
    finishOrder,
    declineOrder,
}
