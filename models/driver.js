"use strict"
const EventEmitter = require('events');

const db = require('./database');
const orders = require("./orders");
const debug = require("debug")("backend:drivers")
const constants = require("./../config/constants")


const sqlLogin = "UPDATE taxi_driver SET `logged` = true WHERE `id` = ? limit 1"
const sqlLogout = "UPDATE taxi_driver SET `logged` = false WHERE `id` = ? limit 1"
const sqlUpdateActiveTime = "UPDATE `taxi_driver` SET `update_time` = CURRENT_TIME() WHERE id = ?"
const sqlGetTaxis = "SELECT `id`, `username`, `lat`, `lng`, `active`, `panic` FROM `taxi_driver` WHERE `logged`=1"
const sqlGetLatLng = "SELECT `lat`, `lng` FROM `taxi_driver` WHERE `id` = ? limit 1";
const sqlUpdateLatLng = "UPDATE taxi_driver SET lat = ?, lng = ? WHERE id = ? limit 1"
const sqlUpdatePanic = "UPDATE taxi_driver SET panic = ? WHERE id = ? limit 1";
const sqlGetBrokenConn = "SELECT `broken_connections`.id, username, lat, lng FROM `broken_connections` LEFT JOIN `taxi_driver` ON `broken_connections`.taxiId = `taxi_driver`.id limit 2000";
const sqlGetNextLoggedDriver = "SELECT `id`, `username` FROM `taxi_driver` WHERE `logged`=1 AND `id`>? limit 1"

const sqlPutBrokenConn = "INSERT INTO broken_connections (taxiId, lat, lng) VALUES (?, ?, ?)"

const sqlConnection = "UPDATE taxi_driver SET `active` = ? WHERE `id` = ? limit 1";

class Driver extends EventEmitter {

    /**
     *
     * @param {Number} id
     */
    constructor(id) {
        super()
        this.id = id;
        this.isAlive = false;
        this.username = "NaN"
    }

    logout() {
        debug("Logging out driver with id: " + this.id);

        db.c.query(sqlLogout, [this.id], (err, result, fields) => {
            if (err) debug(err);
        });

        db.drivers.delete( this.id )

        // TODO: Notify that driver is logoutted
        const toSend = { "op" : "byeDriver", "id" : this.id, "username" : this.username }
        debug( "sending: " + JSON.stringify( toSend ) );
        this.sendEach( JSON.stringify(toSend) )
    }

    error() {
        debug("Writing broken connection to db")
        this.brokenConnection();
        this.logout();
    }

    /**
     * Writes broken connection to DB
     * The entry will have last known lat and lng, so basically this represent one moment before the
     * connection broken
     */
    brokenConnection() {
        db.c.query(sqlGetLatLng, [this.id], (err, result, fields) => {
            if (err) { debug(err); return;}

            const lat = result[0].latitude;
            const lng = result[0].longitude;

            db.c.query(sqlPutBrokenConn, [this.id, lat, lng], (err, result, fields) => {
                if (err) { debug(err); return;}
            })
        })
    }

    /**
     * Checks if the current WS connection on this driver is the currently broken connection.In case
     * that driver's ws and broken ws are the same then this driver is probably in some situation
     * without internet. In this situation driver waits for @waitForDriverReConnectionTime ms for
     * reconnect to happen. The timeout is then checked periodiacally in timeoutCheck function
     *
     * @param {WebSocket} c
     * @returns {Boolean} True if broken connection and driver's ws are the same. false otherwise
     */
    broken(c) {
        if (this.wsconn === c) {
            debug("Current ws is the broken one, setting timeout")
            this.timeout = Date.now() + constants.waitForDriverReConnectionTime;
            this.setConnection(null);

            const toSend = { "op": "broken", "id": this.id, "username" : this.username }
            this.sendEach(JSON.stringify( toSend ));

            return true;
        }

        return false;
    }

    /**
     * Updates the location of this driver in DB, do not notify all drivers just update it in DB
     * Other drivers will get location when they will do regular sync of state with server
     *
     * @param {JSON} msg
     */
    updateLoc( msg ) {
        db.c.query(sqlUpdateLatLng, [msg.lat, msg.lng, this.id], (err, result, fields) => {
            if( err ) {
                debug( err )
                return;
            }
        } )
    }

    /**
     * Enable or disable panic for this driver
     * This will set the panic flag of the driver in the DB
     * Other drivers will read the state in their sync with server
     *
     * @param {number} state The state of the panic button - enabled or disabled
     */
    panic( msg ) {
        // TODO: Update state in DB
    }

    /**
     * Makes order to this driver
     * Called from order module, driver will then listen to switch callback to stop accepting this
     * order. If driver sends accept or deny aftef switch then it will be sends response that order
     * has already passed
     *
     * @param {Order} order
     */
    makeOrder( transactionId, order ) {
        // send it to the driver

        debug( "INFO: Sending order " + order.id + " to driver " + this.id )
        const toSend = { "id" : this.id, "op" : "order", "data" : order };

        this.send( JSON.stringify(toSend));
    }

    /**
     * Get all drivers connected to server
     * Used to sync the drivers state from server to clients
     *
     * @param {JSON} msg
     */
    getAll(msg ) {
        debug("getAll")
        const toSend = { "op": "allDrivers", "id": this.id }

        db.c.query(sqlGetTaxis, (err, result, fields) => {
            if (err) toSend.data = [];
            else toSend.data = result;
            this.send( JSON.stringify( toSend ) );
        });
    }

    /**
     * Take one of the order that this driver was offered
     *
     * @param {JSON} msg
     */
    takeOrder(msg) {
        debug(`Taking order: ${msg.data.id} by driver: ${this.id}`)

        const orderId = Number(msg.data.id)

        if( orders.isOrderTaken( orderId ) ) {
            this.send( JSON.stringify( { "op" : "order", "id" : this.id, "data" : msg.data, "cause" : "taken" } ) )
            return
        }

        orders.takeOrder( orderId, this.id, msg.data )
        this.send( JSON.stringify( { "op" : "order", "id" : this.id, "data" : msg.data } ) )
    }

    /**
     * Decline the order in msg by this driver. The order will remove this driver from its list.
     * The order is then removed with the order's timeout
     *
     * @param {JSON} msg The order to remove
     */
    declineOrder( msg ) {
        debug(`Declining order: ${msg.data.id} by driver: ${this.id}`)

        const orderId = Number(msg.data.id)

        orders.deny( orderId, this.id )
    }

    cancelOrder( msg ) {
        debug(`Canceling order ${msg.data.id} by driver: ${this.id}`)

        const orderId = Number(msg.data.id)

        orders.cancelOrderDriver( orderId, this.id )
    }

    /**
     * Mark the order in msg as finished and remove the order from this driver.
     * The driver will then move to another order that is in his list.
     * To prevent desync the driver should get all his order from server in
     * getAll method
     *
     * @param {JSON} msg
     */
    finishOrder(msg){
        debug(`Finishing order: ${msg.data.id} by driver: ${this.id}`)

        orders.finishOrder(msg.data.id, this.id, msg.data)
    }

    /**
     * Report this order and its customer as not good, the customer will be written
     * to blacklist database and he/she will be filtered from now on.
     * This function first report order and then removes the order from this driver
     * so driver can processed and handle another order
     *
     * @param {JSON} msg
     */
    reportOrder(msg) {
        debug(`Reporting order: ${msg.data.id} by driver: ${this.id}`)

        orders.reportOrder( msg.data.id, this.id, msg.comment, msg.data )
    }

    /**
     * Send this the order in msg to everybody else because the current driver was
     * interupted somehow and he/she does not want to handle this order any more.
     * The order is first removed from this driver and then send to ALL drivers in the
     * system
     *
     * @param {JSON} msg
     */
    forwardOrder(msg) {
        debug("Forwarding order to someone else TODO TODO TODO")
        debug("order: " + msg.data)
    }

    // -------------------- callbacks from Order -----------------------
    /**
     * Cancels the order on driver
     * Sends new order operation to driver with order sets to cancelled
     *
     * @param {Order} anOrder The order to cancel
     */
    orderCanceled( anOrder )
    {
        this.send(JSON.stringify( {"op" : "order", "id" : this.id, "data" : anOrder.params}))
        this.removeOrder( anOrder )
    }

    // ---------------------- networking part --------------------------
    /**
     * Handle incomming msg from either websocket or http
     * Calls apropriete method on driver
     *
     * @param {JSON} msg
     */
    handleMsg( msg ) {
        const func = methodMapping[ msg.op ];
        if( func ) func.call(this, msg);
        else {
            const toSend = { "op": "unknown", "id": this.id }
            send( JSON.stringify( toSend ) )
        }
    }

    /**
     * Checks the last update time of this driver and if the time from the last update
     * is too long then this driver is considered a broken. It will be greyed in the map.
     *
     * @returns {Boolean} true if time from last update is too long
     */
    isBroken() {
        return false; // TODO: actuall check
    }
}

var methodMapping = {

    "update" : Driver.prototype.updateLoc,
    "panic" : Driver.prototype.panic,
    "getAll" : Driver.prototype.getAll,
    // has to be confirmed
    // Handled in routes/order.js
    "take" : Driver.prototype.takeOrder,
    "decline" : Driver.prototype.declineOrder,
    "cancel" : Driver.prototype.cancelOrder,
    "finish" : Driver.prototype.finishOrder,
    "report" : Driver.prototype.reportOrder,
    "fwd" : Driver.prototype.forwardOrder
}

function newDriver(aDriver) {
    debug("sending update");

    getTaxiById(aDriver.id).then((data) => {
        const toSend = { "op": "newDriver", "id": aDriver.id, "data": data }
        aDriver.username = data[0].username;
        debug( "New driver: " + aDriver.username  );
        aDriver.sendEach(JSON.stringify(toSend));
    }).catch((err) => {
        debug(err)
    })
}

const getTaxiByName = (name) => {
    return new Promise((resolve, reject) => {
        db.c.query('select * from taxi_driver where username = ? limit 1000', [name], (err, result, fields) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        });
    });
};

const getTaxiByNamePassword = (name, password) => {
    return new Promise((resolve, reject) => {
        const sql = "select * from taxi_driver where username = ? and password = ? limit 1";

        db.c.query(sql, [name, password], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
};

const getTaxiById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = "select * from taxi_driver where id = ? limit 1";

        db.c.query(sql, [id], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
};

const insertTaxi = (name, password) => {
    return new Promise((resolve, reject) => {
        const sql = "insert into taxi_driver (username, password) values (?, ?)";

        db.c.query(sql, [name, password], (err, result, fields) => {
            if (err) { reject(err) }

            resolve(result);
        });

    });
}

const getTaxi = (id) => {
    return new Promise((resolve, reject) => {
        db.c.query('select * from taxi_driver where id = ? limit 1000', [id], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
}

function login(id) {
    const sql = "update taxi_driver set `logged` = true where `id` = ? limit 1";

    return new Promise((resolve, reject) => {
        db.c.query(sql, [id], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
}

function logout(id) {
    const sql = "update taxi_driver set `logged` = false where `id` = ? limit 1";

    return new Promise((resolve, reject) => {
        db.c.query(sql, [id], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
}

/**
 * Returns the next logged driver
 * the driver who's id is higher that driverId
 *
 * @param {number} driverId id of previous driver
 */
function getNextLogged(driverId) {
    return new Promise((resolve, reject) => {
        db.c.query(sqlGetNextLoggedDriver, [driverId], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
}

function getBrokenConnections() {
    return new Promise((resolve, reject) => {
        db.c.query(sqlGetBrokenConn, [], (err, result, fields) => {
            if (err) reject(err);
            resolve(result);
        });
    });
}

/**
 * Checks all drivers in cache if someone who is in timeout should be deleted
 *
 * @param {number} currentTime
 */
function timeoutCheck(currentTime) {
    let dtd = []; // drivers to delete

    for( var d of db.drivers.values() ){
        // check if driver has timeout set and if the time has passed for him
        if (d.timeout && d.timeout < currentTime) dtd.push(d);
    }

    // remove all drivers that had timeouted
    dtd.forEach((dd) => {
        dd.error();
    })

    return dtd.length
}

/**
 * Adds driver to system and set state in DB also check if we already
 * has a driver and if no then notify others about new login
 *
 * @param {number} id
 * @param {WebSocket} ws
 * @returns {Driver}
 */
function addDriver(id, ws) {
    debug( `Adding new driver id: ${id}` )
    let theDriver = db.drivers.get( id );

    if( theDriver ) {
        // just replace the ws connection on the driver
        // the timeout function will not remove this driver from db
        // but the ws module will terminate the hanging connection
        theDriver.setConnection(ws)
        theDriver.timeout = null;
    }else {
        theDriver = new Driver(id, ws)
        newDriver(theDriver)
        db.drivers.set( id, theDriver );
    }

    return theDriver;
}

// ------------------------------------- New API --------------------------------------
function updateActiveTime( id ) {
    db.c.query( sqlUpdateActiveTime, [id], (err, result, fields) => {} )
}

function login(id) {
    return new Promise((resolve, reject) => {
        db.c.query(sqlLogin, [id], (err, result, fields) => {
            if (err) reject(err);

            updateActiveTime(id)
            resolve(result);
        });
    });
}

function logout(id) {
    return new Promise((resolve, reject) => {
        db.c.query(sqlLogout, [id], (err, result, fields) => {
            if (err) reject(err);

            updateActiveTime(id)
            resolve(result);
        });
    });
}

/**
  * Updates the location of this driver in DB, do not notify all drivers just update it in DB
  * Other drivers will get location when they will do regular sync of state with server
  *
  * @param {JSON} msg The message json containing at least lat, lng and id fields
  **/
function updateLatLng(msg) {
    debug(`Updating location for: ${msg.id}`)

    db.c.query(sqlUpdateLatLng, [msg.lat, msg.lng, msg.id], (err, result, fields) => {
        if( err ) {
            debug( err )
            return;
        }

        updateActiveTime(msg.id)
    } )
}

function panic(msg) {
    db.c.query(sqlUpdatePanic, [msg.panic, msg.id], (err, result, fields) => {
        if( err ) {
            debug( err )
            return;
        }

        updateActiveTime(msg.id)
    } )
}

function getTaxis() {
    return new Promise((resolve, reject) => {
        db.c.query(sqlGetTaxis, (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
}

module.exports = {
    getTaxi,
    getTaxiByName,
    getTaxiByNamePassword,
    getTaxiById,

    insertTaxi,
    getBrokenConnections,
    getNextLogged,
    addDriver,
    timeoutCheck,


    login,
    logout,
    updateLatLng,
    panic,
    getTaxis
}