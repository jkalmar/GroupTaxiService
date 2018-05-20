"use strict"
const EventEmitter = require('events');
const uuidv4 = require('uuid/v4');

const db = require('./database');
const debug = require("debug")("backend:drivers")

const sqlGetTaxis = "SELECT `id`, `username`, `latitude`, `longitude`, `rating_driver`, `active` FROM `taxi_drivers` WHERE `logged`=TRUE"
const sqlGetLatLng = "SELECT `latitude`, `longitude` FROM `taxi_drivers` WHERE `id` = ? limit 1";
const sqlGetBrokenConn = "SELECT `broken_connections`.id, username, lat, lng FROM `broken_connections` LEFT JOIN `taxi_drivers` ON `broken_connections`.taxiId = `taxi_drivers`.id limit 2000";
const sqlGetNextLoggedDriver = "SELECT `id`, `username` FROM `taxi_drivers` WHERE `logged`=1 AND `id`>? limit 1"
const sqlUpdateLatLng = "UPDATE taxi_drivers SET latitude = ?, longitude = ? WHERE id = ? limit 1"

const sqlPutBrokenConn = "INSERT INTO broken_connections (taxiId, lat, lng) VALUES (?, ?, ?)"
const sqlLogout = "UPDATE taxi_drivers SET `logged` = false WHERE `id` = ? limit 1";

const sqlConnection = "UPDATE taxi_drivers SET `active` = ? WHERE `id` = ? limit 1";

const waitForDriverReConnectionTime = 120000;

class Driver extends EventEmitter {

    /**
     *
     * @param {Number} id
     * @param {WebSocket} ws
     */
    constructor(id, ws) {
        super()
        this.id = id;
        this.setConnection(ws)
        this.isAlive = false;
        this.timeout = null;
        this.order = null;
        this.username = "NaN"
    }

    logout() {
        debug("Logging out driver with id: " + this.id);

        db.c.query(sqlLogout, [this.id], (err, result, fields) => {
            if (err) debug(err);
        });

        db.drivers.delete( this.id )

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
            this.timeout = Date.now() + waitForDriverReConnectionTime;
            this.setConnection(null);

            const toSend = { "op": "broken", "id": this.id, "username" : this.username }
            this.sendEach(JSON.stringify( toSend ));

            return true;
        }

        return false;
    }

    /**
     * Updates the location of this driver in DB
     *
     * @param {JSON} msg
     */
    updateLoc( msg ) {
        db.c.query(sqlUpdateLatLng, [msg.lat, msg.lng, this.id], (err, result, fields) => {
            if( err ) {
                debug( err )
                return;
            }

            const toSend = { "op": "location", "id": this.id, "username" : this.username, "data": msg }
            this.sendEach(JSON.stringify( toSend ));
        } )
    }

    /**
     * Enable or disable panic for this driver
     * It will then notify all connected drivers that this driver has clicked the panic button
     *
     * @param {number} state The state of the panic button - enabled or disabled
     */
    panic( msg ) {
        const toSend = { "op": "panic", "id": this.id, "username" : this.username, "state": msg.state }
        this.sendEach(JSON.stringify(toSend));
        this.send(JSON.stringify(toSend))
    }

    /**
     * Makes order to this driver
     * Called from order module, driver will then listen to switch callback to stop accepting this
     * order. If driver sends accept or deny aftef switch then it will be sends response that order
     * has already passed
     *
     * @param {Order} theOrder
     */
    makeOrder( theOrder ) {
        if( this.order ) {
            debug(`Driver: ${this.id} already has an order: ${this.order.params.id}`)
            return;
        }

        this.order = theOrder;

        // send it to the driver
        const toSend = { "id" : this.id, "op" : "order", "data" : this.order.params };
        this.send( JSON.stringify(toSend));
    }


    /**
     *
     * @param {Order} theOrder
     */
    removeOrder( theOrder ) {
        if(this.order && (this.order.id === theOrder.id)) this.order = null;
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

    takeOrder(msg) {
        debug(`Taking order: ${msg.data.id} by driver: ${this.id}`)

        if( this.order && (this.order.params.id === msg.data.id) ) {
            if(this.order.accept(this, msg.data)) {
                this.send(JSON.stringify( {"op" : "order", "id" : this.id, "data" : this.order.params}))
            }
            return
        }
        // else
        // send operation unsuccessfull to driver
    }

    declineOrder( msg ){
        debug(`Declining order: ${msg.data.id} by driver: ${this.id}`)

        if( this.order && this.order.params.id === msg.data.id ) {
            this.order.cancelDriver(this);
            this.order = null;
            return
        }
        // else
        // send operation unsuccessfull to driver
    }

    finishOrder(msg){
        debug(`Finishing order: ${msg.data.id} by driver: ${this.id}`)

        if( this.order && this.order.params.id === msg.data.id ) {
            this.order.done(this, msg.data);
            this.order = null;
            return
        }
        // else
        // send operation unsuccessfull to driver
    }

    switchOrder(msg) {

    }

    reportOrder(msg) {
        debug(`Reporting order: ${msg.data.id} by driver: ${this.id}`)

        if( this.order && this.order.params.id === msg.data.id ) {
            this.order.report(this, msg.comment);
            this.orderCanceled( this.order )
            return
        }
        else {
            debug( "Trying to report order that is not handled by this driver: " + this.id )
        }
    }

    forwardOrder(msg) {
        debug("Forwarding order to someone else")
        debug("order: " + msg.data)

        if( this.order && this.order.params.id === msg.data.id ) {
            this.order.forward(this, msg.comment);
            this.orderCanceled( this.order )
            return
        }
        else {
            debug( "Trying to report order that is not handled by this driver: " + this.id )
        }

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
        this.order = null;
    }

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
     * Sends msg to driver, msg should be a json object which will be added to "data" key in message
     * something like: { "id" : id, "op" : op, "data" : msg }
     *
     * @param {JSON} msg
     */
    send(msg) {
        if (this.wsconn) this.wsconn.send(msg);
    }

    sendEach( msg ) {
        for( var d of db.drivers.values() ){
            if( d.id === this.id ) continue
            d.send( msg )
        }
    }

    /**
     * Checks if this driver has any connection, if not then this driver is considered as
     * broken one and he/she should be grey in the map
     *
     * @returns {Boolean} true if driver does not have any connection
     */
    isBroken() {
        return this.wsconn === null;
    }

    /**
     * Sets the ws connection on this driver and put it also to DB
     * Driver is active only if he/she has a connection, otherwise he/she is
     * not active
     *
     * @param {WebSocket} aConn A ws connection or null
     */
    setConnection(aConn) {
        // TODO:    Optimize, check if driver has a connection and if yes then
        //          dont write the same twice to DB
        db.c.query(sqlConnection, [ ( aConn == null ? false : true ), this.id], (err, result, fields) => {
            if (err) { debug(err); return;}
        })

        this.wsconn = aConn;
    }
}

var methodMapping = {
    "update" : Driver.prototype.updateLoc,
    "panic" : Driver.prototype.panic,
    "getAll" : Driver.prototype.getAll,
    "take" : Driver.prototype.takeOrder,
    "decline" : Driver.prototype.declineOrder,
    "finish" : Driver.prototype.finishOrder,
    "switch" : Driver.prototype.switchOrder,
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

const getTaxis = function () {
    return new Promise((resolve, reject) => {
        db.c.query(sqlGetTaxis, (err, result, fields) => {
            if (err) {
                reject(err);
            }

            resolve(result);
        });
    });
}

const getTaxiByName = (name) => {
    return new Promise((resolve, reject) => {
        db.c.query('select * from taxi_drivers where username = ? limit 1000', [name], (err, result, fields) => {
            if (err) {
                reject(err);
            }
            resolve(result);
        });
    });
};

const getTaxiByNamePassword = (name, password) => {
    return new Promise((resolve, reject) => {
        const sql = "select * from taxi_drivers where username = ? and password = ? limit 1";

        db.c.query(sql, [name, password], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
};

const getTaxiById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = "select * from taxi_drivers where id = ? limit 1";

        db.c.query(sql, [id], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
};

const insertTaxi = (name, password) => {
    return new Promise((resolve, reject) => {
        const sql = "insert into taxi_drivers (username, password) values (?, ?)";

        db.c.query(sql, [name, password], (err, result, fields) => {
            if (err) { reject(err) }

            resolve(result);
        });

    });
}

const getTaxi = (id) => {
    return new Promise((resolve, reject) => {
        db.c.query('select * from taxi_drivers where id = ? limit 1000', [id], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
}

const performLogin = (name, password) => {
    return new Promise((resolve, reject) => {
        db.c.query('select id from taxi_drivers where name = ? and password = ? limit 1', [name, password], (err, result, fields) => {
            if (err) {
                reject(err);
            }

            resolve(result);
        })
    })
}

function login(id) {
    const sql = "update taxi_drivers set `logged` = true where `id` = ? limit 1";

    return new Promise((resolve, reject) => {
        db.c.query(sql, [id], (err, result, fields) => {
            if (err) reject(err);

            resolve(result);
        });
    });
}

function logout(id) {
    const sql = "update taxi_drivers set `logged` = false where `id` = ? limit 1";

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

/**
 * Search the local driver cache and return the driver object if found, or undefined
 *
 * @param {number} id
 * @returns {Driver}
 */
function getDriver( id )
{
    return db.drivers.get(id)
}

module.exports = {
    getTaxi,
    getTaxiByName,
    getTaxiByNamePassword,
    getTaxiById,
    getTaxis,
    login,
    logout,
    insertTaxi,
    getBrokenConnections,
    getNextLogged,
    addDriver,
    getDriver,
    timeoutCheck
}