const db = require('./database');
const debug = require("debug")("backend:orders");
const blacklist = require("./blacklist")
const cst = require("./../config/constants")

const orderStateNew = 1;
const orderStateFwd = 2;
const orderStateTaken = 3;
const orderStateCanceled = 4;
const orderStateTimeout = 5;
const orderStateDone = 6;


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
    constructor( params ){
        this.params = params;   // the order json as recv from network
        this.driver = null;     // the driver object who accepted this order
        this.drivers = null;    // the initial drivers who were offered this order
        this.timeout = setTimeout( this.onTimeout.bind( this ), cst.OrderTimeout );
        this.switchTimeout = setTimeout( this.onSwitch.bind( this ), cst.OrderSwitchTime )
        this.doneTimeout = 0;
    }

    onTimeout()
    {
        if( this.driver === null )
        {
            debug(`Timeout for order, id: ${this.params.id}`);
            this.params.state = orderStateTimeout;
            const paramStr = JSON.stringify(this.params)

            this.clearTimers()

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

    /* Old sequential switching, this function switched drivers one after another until timeout
    onSwitchSeq()
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
    */

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

        if( this.params.state === orderStateNew || this.params.state === orderStateFwd )
        {
            this.driver = aDriver;
            this.params = newParams;

            this.clearTimers()

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
        this.params.state = orderStateCanceled;

        this.clearTimers()

        const paramsStr = JSON.stringify(this.params)
        db.c.query( sqlOrderCancel, [paramsStr, this.params.id] ,( err, result, fields ) => {
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
    cancelDriver( aDriver ) {
        if( this.params.state === orderStateTaken && this.driver === aDriver ) {
            debug(`Canceling order ${this.params.id}`)
            this.params.state = orderStateCanceled;
            const paramsStr = JSON.stringify(this.params)
            db.c.query( sqlOrderCancel, [ paramsStr, this.params.id ] ,( err, result, fields ) => {
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

/**
 *
 * @param {express.res} res
 * @param {OrderParams} aParam
 */
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

        blacklist.checkOrder( aParam.simSerial, aParam.deviceSerial ).then( value => {
            // create new order and set id
            aParam.id = Number(result.insertId);

            if( value.length > 0 )  aParam.isBlacklisted = true;
            else                    aParam.isBlacklisted = false;


            let theOrder = new Order( aParam );
            db.orders.set( theOrder.params.id, theOrder )

            // Call first state in order
            theOrder.onCreate();

            res.json( { "id" : theOrder.params.id, "data" : theOrder.params } );
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
