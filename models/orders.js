const db = require('./database');
const debug = require("debug")("backend:orders");
const blacklist = require("./blacklist")
const cst = require("./../config/constants")

const orderStateNew = 1;
const orderStateFwd = 2;
const orderStateTaken = 3;
const orderStateCanceledUser = 4;
const orderStateCanceledTaxi = 5;
const orderStateTimeout = 6;
const orderStateDone = 7;

const sqlOrderCreate = "INSERT INTO `order` (??) VALUES (?);";
const sqlOrderTake = "UPDATE `order` SET `taxiId` = ?, `state` = " + orderStateTaken + ", `time` = ? WHERE `id` = ? limit 1;";
const sqlOrderCancelUser = "UPDATE `order` SET `state` = " + orderStateCanceledUser + " WHERE `id` = ? limit 1;";
const sqlOrderCancelTaxi = "UPDATE `order` SET `state` = " + orderStateCanceledTaxi + " WHERE `id` = ? limit 1;";
const sqlOrderTimeout = "UPDATE `order` SET `state` = " + orderStateTimeout + " WHERE `id` = ? limit 1;";
const sqlOrderDone = "UPDATE `order` SET `state` = " + orderStateDone + " WHERE `id` = ? limit 1;";
const sqlOrderCheck = "SELECT * FROM `order` WHERE `id`=?"

const sqlInsertActive = "INSERT INTO `active_order` (`order_id`, `driver_id`, `expriry`) VALUES ( ?, ?, current_timestamp() )"
const sqlSelectActive = "SELECT `active_order`.`id`, `order_id`, `driver_id`, `orders`.`params` FROM `active_order` WHERE `driver_id`=? INNER JOIN orders ON order_id=orders.id"
const sqlDeleteActive = "DELETE FROM `active_order` WHERE order_id=? AND driver_id=?"
const sqlDeleteActiveAll = "DELETE FROM `active_order` WHERE `order_id`=?"

const takenOrders = new Set()

function orderQueryBasicCheck(err, result, fields){
    if(err) debug(err)
}

/**
 * @class
 * @alias orders:Order
 *
 */
class Order
{
    constructor( id ){
        this.id = id;
        this.state = orderStateNew  // the order is new
        this.driverId = null;     // the driver object who accepted this order
        this.driversId = null;    // the initial drivers who were offered this order
        this.timeout = setTimeout( this.onTimeout.bind( this ), cst.OrderTimeout );
        this.switchTimeout = setTimeout( this.onSwitch.bind( this ), cst.OrderSwitchTime )
        this.doneTimeout = 0;
    }

    onTimeout()
    {
        if( this.driver === null )
        {
            debug(`Timeout for order, id: ${this.params.id}`);
            this.state = orderStateTimeout;
            this.clearTimers()

            // remove this order from the global list of active orders
            // and mark it as timeout order in DB
            db.orders.delete( this.id )
            db.c.query(sqlOrderTimeout, [ this.id ], orderQueryBasicCheck);
        } else {
            debug( `ERROR: Order ${this.params.id}  has been taken but timeout was not deleted` )
        }
    }

    /**
     * After new order object is instantioned onCreate is the first state needs to be
     * called. This basically find nearest drivers and sends them this order
     *
     * @param {Array} drivers
     */
    onCreate() {
        const point = { "lat" : this.params.from.lat, "lng" : this.params.from.lng }
        debug("Order created with id: " + this.params.id)

        db.findNearestDrivers( point ).then( ( drivers ) => {
            for( const driver of drivers ) {
                driver.makeOrder( this )
            }
            this.drivers = drivers
        } ).catch( ( err ) => {
            console.log( err )
        } )
    }

    /**
     * Orders supports forwarding. Forwarding means that everybody except current driver
     * gets this order.
     */
    onFwd( currentDriver ) {
        this.params.state = orderStateFwd
        this.driver = null
        let iDrivers = db.drivers.values()

        for( let d of iDrivers ){
            if(d === currentDriver) continue

            d.makeOrder( this )
        }
    }

    /**
     * Sends this order to all drivers except the ones that has was offered this order
     * in the onCreate state
     */
    onSwitch() {
        let iDrivers = db.drivers.values()

        for( let d of iDrivers ){
            d.makeOrder( this )
        }

        this.switchTimeout = null
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
    // TODO: move to driver
    accept( aDriver, newParams )
    {
        const paramStr = JSON.stringify(newParams);

        debug(`Driver: ${aDriver.id} has taken the order: ${this.params.id}`)

        if( this.params.state === orderStateNew || this.params.state === orderStateFwd )
        {
            this.driver = aDriver;
            this.params = newParams;

            this.clearTimers()



            // move to driver class
            debug(`Order: ${this.params.id} accepted`)
            debug(JSON.stringify(this.params))
            return true;
        }
        else
        {
            debug("Can not take order that is not in new or fwd state")
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
    // TODO: move to driver
    deny( aDriver )
    {
        debug(`Denying order ${this.params.id}`)

        // denying an order has point only if state is "orderStateNew"
        // otherwise this order has been either taken, forwarded or finished
        if( this.params.state === orderStateNew || this.params.state === orderStateFwd ) {

            const index = this.drivers.indexOf( aDriver.id );

            if( index != -1 ) {
                // Cut the driver who denied from order driver list
                // splice returns copy of new array without the element on index
                this.drivers.splice( index, 1 );
            }

            // lets check if all drivers denied this order
            // if all denied then the order need to be send to ALL drivers just for
            // sure if someone else (further) want to accept it
            if( this.drivers.length === 0 ) {
                clearTimeout( this.switchTimeout );
                this.onSwitch();
            }
        }
        else {
            debug( "INFO: Driver " + aDriver.username + " wants to deny order that is not in new state but in state: " + this.params.state );
        }
    }

    /**
     * Cancels this order by a user
     * This is called by a user if he/she decides to cancel this order
     */
    cancelUser()
    {
        debug( "Order canceled" )
        this.params.state = orderStateCanceledUser;

        this.clearTimers()

        const paramsStr = JSON.stringify(this.params)
        db.c.query( sqlOrderCancelUser
        , [paramsStr, this.params.id] ,( err, result, fields ) => {
            if( err ) debug( err );
        } );

        if(this.driver) {
            this.driver.orderCanceled(this);
        }

        // TODO: Notify all initial drivers about canceling this order

        db.orders.delete( this.params.id )
    }

    /**
     * Cancels this order by a driver
     * This is called from a driver if he/she decides to cancel this order and not to switch
     * it to someone else
     *
     * @param {Driver} aDriver
     */

    // TODO: move to driver
    cancelDriver( aDriver ) {
        if( this.params.state === orderStateTaken && this.driver === aDriver ) {
            debug(`Canceling order ${this.params.id}`)
            this.params.state = orderStateCanceledUser;
            const paramsStr = JSON.stringify(this.params)
            db.c.query( sqlOrderCancelUser
            , [ paramsStr, this.params.id ] ,( err, result, fields ) => {
                if( err ) debug( err );
            } );

            this.doneTimeout = setTimeout(this.onDoneTimeout.bind( this ), cst.OrderDoneTimeout )
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
    // TODO: Move to driver
    done(aDriver, newParams)
    {
        // only alredy taken orders can be finished
        if( this.params.state == orderStateTaken ) {
            debug(`Order: ${this.params.id} has been finished by driver ${aDriver.id}`)
            this.params = newParams;
            const paramStr = JSON.stringify(this.params)

            db.c.query( sqlOrderDone, [ paramStr, this.params.id ], ( err, resuld, fields ) => {
                if( err ) debug( err );

                this.doneTimeout = setTimeout(this.onDoneTimeout.bind( this ), cst.OrderDoneTimeout )
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

    /**
     * Reports this order to DB, store info like sim and device IDs and comment about the
     * incident
     *
     * @param {Driver} aDriver
     * @param {String} aComment
     */
    // TODO: move to driver
    report(aDriver, aComment) {
        debug(`Order: ${this.params.id} reported by driver: ${aDriver.id}`);
        debug(`Ids: sim: ${this.params.simSerial} device: ${this.params.deviceSerial}`);

        const reportData = {
            simSerial : this.params.simSerial,
            deviceSerial : this.params.deviceSerial,
            driver : aDriver.id,
            comment : aComment
        }

        blacklist.insertNew( reportData );
        this.cancelDriver(aDriver);
    }

    /**
     * Clears the timeouts on this order
     */
    clearTimers() {
        if( this.timeout ) {
            clearTimeout( this.timeout )
            this.timeout = 0
        }
        if( this.switchTimeout ) {
            clearTimeout( this.switchTimeout )
            this.switchTimeout = 0
        }
    }
}

function orderCreated( order ) {
    const point = { "lat" : order.fromLat, "lng" : order.fromLng }
    debug("Order created with id: " + order.id)

    db.findNearestDrivers( point ).then( ( drivers ) => {
        for( const driver of drivers ) {
            db.c.query( sqlInsertActive, [ order.id, driver.id ], ( err, row ) => {
                if( err ) {
                    debug(err);
                    return;
                }
                driver.makeOrder( row.insertId, order )
            } )
        }
    } ).catch( ( err ) => {
        console.log( err )
    } )
}

/**
 *
 * @param {express.res} res
 * @param {OrderParams} order
 */
function createNewOrder( res, order )
{
    debug( "Creating new order" );

    const keys = Object.keys( order )
    const vals = Object.values( order )


    db.c.query( sqlOrderCreate, [ keys, vals], ( err, result, fields ) => {
        if( err ) {
            debug(err.sql)
            debug(err)
            res.sendStatus( 500 );
            return
        }

        order.id = Number(result.insertId);

        debug("With id: " + order.id)

        blacklist.checkOrder( order.simSerial, order.deviceSerial ).then( value => {
            // create new order and set id

            if( value.length > 0 )  order.isBlacklisted = true;
            else                    order.isBlacklisted = false;

            // Call first state in order
            orderCreated( order )

            res.json( { "id" : order.id, "data" : order } );
        } ).catch( error => {
            debug(error)
                res.sendStatus( 500 )
        } )
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
    const theId = req.params.id;

    if( theId === undefined ) {
        res.sendStatus( 400 );
        return;
    }

    debug("Canceling order with id: " + theId)
    db.c.query( sqlOrderCancelUser, [ theId] ,( err, result, fields ) => {
        if( err ) {
            debug( err );
            res.sendStatus(400);
            return
        }

        checkOrder( req, res )
    } )
}

function switchOrder( orderId ) {
    db.c.query( sqlDeleteActiveAll, [orderId], (err) => {
        if(err) debug(err)
        else {
            for( const driver of db.drivers ) {
                db.c.query( sqlInsertActive, [ orderId, driver.id ], ( err, row ) => {
                    if( err ) {
                        debug(err);
                        return;
                }

                driver.makeOrder( row.insertId, aParam )
                } )
            }
        }
    } )
}

function timeoutOrder( orderId ) {
    takenOrders.add(orderId)

    // fire 2 queries
    // 1. update the state in order params to timeout
    // 2. delete all active orders from db
    db.c.query( sqlOrderTimeout, [ orderId ] );
    db.c.query( sqlDeleteActiveAll, [orderId], (err) => {
        if(err) debug(err)
        else takenOrders.delete(orderId)
    } )
}

function forwardOrder( orderId, driverId ) {

}

function takeOrder( orderId, driverId, newParams ) {
    // Check if someone took the order
    // Because taking order is divided into multiple sqls and those are not atomic
    // we need to have some atomic way of checking the wheter the order is taken or
    // not
    if( isOrderTaken(orderId) ) return false

    takenOrders.add(orderId)

    // There is no need to wait for this query
    db.c.query( sqlOrderTake, [ driverId, newParams.time, orderId ] ,( err ) => {
        if( err ) debug( err );
    } );

    return true;
}

function isOrderTaken( orderId ) {
    return takenOrders.has(orderId)
}

function deny( orderId, driverId ) {
    db.c.query( sqlDeleteActive, [ orderId, driverId ], (err) => {
        if(err) debug(err)
    } )
}

function cancelOrderDriver( orderId, driverId ) {
    takenOrders.delete(orderId)

    db.c.query( sqlOrderCancelTaxi, [orderId], (err) => {
        if(err) debug(err)
        else deny(orderId, driverId)
    } )
}

function finishOrder( orderId, driverId, newParams ) {
    takenOrders.delete(orderId)

    debug(`Order: ${orderId} has been finished by driver ${driverId}`)

    db.c.query( sqlOrderDone, [orderId], (err) => {
        if(err) debug(err)
        else deny(orderId, driverId)
    } )
}

function reportOrder( orderId, driverId, comment, order ) {
    debug(`Order: ${orderId} has been reported by driver ${driverId} with comment: ${comment}`)

    takenOrders.delete(orderId)

    const reportData = {
        simSerial : order.simSerial,
        deviceSerial : order.deviceSerial,
        driver : driverId,
        comment : comment
    }

    blacklist.insertNew( reportData );
    deny(orderId, driverId)
}

module.exports = {
    createNewOrder,
    checkOrder,
    cancelOrder,
    switchOrder,
    timeoutOrder,
    forwardOrder,
    takeOrder,
    deny,
    cancelOrderDriver,
    finishOrder,
    reportOrder,
    isOrderTaken
}
