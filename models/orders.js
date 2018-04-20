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

const sqlOrderCreate = "INSERT INTO `orders` (`serial_num_device`,`place_from`, `place_to`, `params` ) VALUES (?,?,?,? );";
const sqlOrderTake = "UPDATE `orders` SET `id_DRIVER` = ?, `state` = " + orderStateTaken + ", `params` = ? WHERE `id` = ? limit 1;";
const sqlOrderCancel = "UPDATE `orders` SET `state` = " + orderStateCanceled + ", `params` = ? WHERE `id` = ? limit 1;";
const sqlOrderTimeout = "UPDATE `orders` SET `state` = " + orderStateTimeout + ", `params` = ? WHERE `id` = ? limit 1;";
const sqlOrderDone = "UPDATE `orders` SET `state` = " + orderStateDone + ", `params` = ? WHERE `id` = ? limit 1;";

const sqlOrderCheck = "SELECT `state`, `params` FROM `orders` WHERE `id`=?"

/**
 * @class
 * @alias orders:Order
 *
 */
class Order
{
    constructor( anOrderParams ){
        this.params = anOrderParams;
        this.accepted = false;
        this.driverId = 0;
        this.driver = null;
        this.driverIterator = null;
        this.timeout = setTimeout( this.onTimeout.bind( this ), OrderTimeout );
        this.switchTimeout = setTimeout( this.onSwitch.bind( this ), OrderSwitchTime )
        this.doneTimeout = 0;
    }

    onTimeout()
    {
        if( ! this.accepted )
        {
            debug(`Timeout for order, id: ${this.params.id}`);
            this.params.state = orderStateTimeout;
            const paramStr = JSON.stringify(this.params)

            clearTimeout( this.switchTimeout )
            // remove this order from the global list of active orders
            // and mark it as timeout order in DB
            db.orders.delete( this.params.id )
            db.c.query( sqlOrderTimeout, [ paramStr,this.params.id ] ,( err, result, fields ) => {
                if( err ) debug( err );
            } );
        } else {
            debug( `ERROR: Order ${this.params.id}  has been taken but timeout was not deleted` )
        }
    }

    onSwitch()
    {
        if( ! this.accepted )
        {
            // remove from old driver
            if( this.driver ) this.driver.removeOrder( this );

            var { value : val, done : tf } = this.driverIterator.next();

            while( !tf ) {
                const theDriver = val[1];

                if(theDriver.order === null)
                {
                    this.driverId = val[0];
                    this.driver = theDriver;

                    this.driver.makeOrder( this );

                    clearTimeout( this.switchTimeout );
                    this.switchTimeout = setTimeout( this.onSwitch.bind( this ), OrderSwitchTime );
                    break;
                }

                var { value : val, done : tf } = this.driverIterator.next();
            }

            if( tf ) {
                this.driverId = null;
                this.driver = null;
                return;
            }
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
    accept( aDriver, newParams )
    {
        const paramStr = JSON.stringify(newParams);

        debug(`Driver: ${aDriver.id} has taken the order: ${this.params.id}`)

        if( this.params.state === orderStateNew )
        {
            this.accepted = true;
            this.driver = aDriver;
            this.params = newParams;

            clearTimeout( this.timeout );
            clearTimeout( this.switchTimeout )

            db.c.query( sqlOrderTake, [ this.driver.id, paramStr, this.params.id ] ,( err, result, fields ) => {
                if( err ) debug( err );
            } );

            // move to driver class
            debug(`Order: ${this.params.id} accepted`)
            debug(JSON.stringify(this.params))
            return true;
        }
        else
        {
            return false;
        }
    }

    /**
     * Decline this order by a driver.
     * Called when driver decline his/her order. This order has to be in orderStateNew
     * otherwise it will not be handled
     *
     * @param {Driver} aDriver
     */
    deny( aDriver )
    {
        debug(`Denying order ${this.params.id}`)

        if( this.params.state === orderStateNew ) {
            if( this.driver === aDriver ) {
                clearTimeout( this.switchTimeout );
                this.onSwitch()
            }
            else {
                debug( "WARNING: Driver with id: " + aDriver.id + " wants to denied order for driver: " + this.driverId );
            }
        }
        else {
            debug( "INFO: Ignoring denying of not new order" );
        }
    }

    /**
     * Cancels this order by a user
     * This is called by a user if he/she decides to cancel this order
     */
    cancelUser()
    {
        debug( "Order canceled" )
        this.params.state = orderStateCanceled;
        const paramsStr = JSON.stringify(this.params)
        db.c.query( sqlOrderCancel, [paramsStr, this.params.id] ,( err, result, fields ) => {
            if( err ) debug( err );
        } );

        if(this.driver) {
            this.driver.orderCanceled(this);
        }

        db.orders.delete( this.params.id )
    }

    /**
     * Cancels this order by a driver
     * This is called from a driver if he/she decides to cancel this order and not to switch
     * it to someone else
     *
     * @param {Driver} aDriver
     */
    cancelDriver( aDriver ) {
        if( this.params.state === orderStateTaken ) {
            debug(`Canceling order ${this.params.id}`)
            this.params.state = orderStateCanceled;
            const paramsStr = JSON.stringify(this.params)
            db.c.query( sqlOrderCancel, [ paramsStr, this.params.id ] ,( err, result, fields ) => {
                if( err ) debug( err );
            } );

            this.doneTimeout = setTimeout(this.onDoneTimeout.bind( this ), OrderDoneTimeout )
        } else {
            this.deny(aDriver);
        }

    }

    /**
     * Finish this order by driver.
     * This is called be a driver when the order is done. It marks this order as finish, write
     * that to DB and remove this order from local orders cache
     *
     * @param {Order} newParams
     * @returns {Boolean} true if order was successfully finished false otherwise
     */
    done(aDriver, newParams)
    {
        // only alredy taken orders can be finished
        if( this.params.state == orderStateTaken ) {
            debug(`Order: ${this.params.id} has been finished by driver ${aDriver.id}`)
            this.params = newParams;
            const paramStr = JSON.stringify(this.params)

            db.c.query( sqlOrderDone, [ paramStr, this.params.id ], ( err, resuld, fields ) => {
                if( err ) debug( err );

                this.doneTimeout = setTimeout(this.onDoneTimeout.bind( this ), OrderDoneTimeout )
            } );

            return true;
        }
        // else
        return false;
    }

    /**
     * Timeout to delete order from local cache
     * Called from done timer after order has been marked as finished
     */
    onDoneTimeout()
    {
        db.orders.delete( this.params.id )
        this.doneTimeout = 0;
    }

    report(aDriver) {
        debug(`Order: ${this.params.id} reported by driver: ${aDriver.id}`);
        debug(`Ids: sim: ${this.params.simSerial} device: ${this.params.deviceSerial}`);
        this.cancelDriver(aDriver);
    }
}

function createNewOrder( res, aParam )
{
    const paramsStr = JSON.stringify(aParam);
    debug( "Creating new order" );
    debug( `params: ${paramsStr}` );

    db.c.query( sqlOrderCreate, [0, "from", "to", paramsStr], ( err, result, fields ) => {
        if( err ) {
            res.sendStatus( 500 );
            return
        }

        // create new order and set id
        aParam.id = Number(result.insertId);
        let theOrder = new Order( aParam );
        db.orders.set( theOrder.params.id, theOrder )

        theOrder.driverIterator = db.drivers[Symbol.iterator]();
        theOrder.onSwitch();

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
    let theId = req.params.id;

    if( theId === undefined )
    {
        res.sendStatus( 400 );
        return;
    }

    theId = Number(theId)

    if( db.orders.has( theId ) )
    {
        debug("Sending state of order")
        const theOrd = db.orders.get( theId )
        const obj = { "id" : theOrd.params.id,  "data" : theOrd.params };
        res.json( obj );
    }
    else
    {
        db.c.query( sqlOrderCheck, [ theId ] ,( err, result, fields ) => {
            if( err ) {
                debug( err );
                res.sendStatus(400);
            } else if ( result.length > 0 ) {
                debug("Sending state of order from DB")
                res.setHeader('Content-Type', 'application/json');
                res.send(`{"id": ${theId}, "data": ${result[0].params}}`);
            } else {
                res.sendStatus(400);
            }
        } );
    }
}

/**
 * Called from customer to indicate that he/she/it canceled the order
 * it sends back 200 OK on success or 409 Error on some error, in case of error the user should
 * repeat his request
 *
 * @param {express.req} req
 * @param {express.res} res
 */
function cancelOrder( req, res )
{
    let theId = req.params.id;

    if( theId )
    {
        theId = Number(theId)
        const theOrder = db.orders.get( theId );
        if( theOrder )
        {
            theOrder.cancelUser()
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

module.exports = {
    createNewOrder,
    checkOrder,
    cancelOrder,
}
