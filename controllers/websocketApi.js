const WebSocket = require('ws');
const sessionParser = require("../config/session")
const debug = require("debug")("backend:ws")
const drivers = require("../models/driver");
const config = require("../config/config.json")
const bodyJsonParser = require('body-parser').json();


const correctCloseCode = 3000;
const brokenConnectionTimer = 25000;
const syncTime = 60000;

// the websocket server instance
var WSinstance = null;

function heartbeat() {
    this.isAlive = true;
}

/**
 * Bind driver and req with websocket
 *
 * @param {Driver} aDriver
 * @param {Express.Request} aReq
 * @param {WebSocket} ws
 */
function setDefaultsOnWs(aDriver, aReq, ws) {
    debug("Setting values for ws");
    ws.driver = aDriver;
    ws.isAlive = true;
    ws.incommingReq = aReq;
}

function verifyClientFn(info, done) {
    debug("New client connected")
    sessionParser(info.req, {}, () => {
        if (info.req.session.passport === undefined) {
            debug("Connection has no session")
            done(false, 401, JSON.stringify({ "op": "unauth" }));
            return;
        }

        const appVersion = Number(info.req.session.passport.user.appVersion)

        if ( isNaN(appVersion) || appVersion < config.appVersion) {
            debug("App version too old: " + appVersion)
            info.req.session.destroy();
            done(false, 402, JSON.stringify({ "op": "old" }));
            return;
        }

        done(true);

    });
}

/**
 * Handle the message from driver and call appropriate handler on
 * driver object
 *
 * @param {String} message
 */
function handleMessageFn(message) {
    debug(`WS message ${message} from user ${this.driver.id}`);

    const msg = JSON.parse(message);
    let theDriver = drivers.getDriver(this.driver.id)

    if (!theDriver) {
        debug("No driver found!!!")
        return;
    }


    theDriver.handleMsg(msg);
}

function handleCloseFn(code, reason) {
    debug(`Closing connection for user: ${this.driver.id}`);
    debug(`Code: ${code}`);
    debug(`Reason: ${reason}`);

    if (code == correctCloseCode) {
        this.driver.logout();
        this.incommingReq.session.destroy();
    } else if (this.driver.broken(this) === true) {
        this.incommingReq.session.destroy();
    } else {
        // todo counter
    }

}

function handleErrorFn(err) {
    debug("Error recv for driver: " + this.driver.id);
    this.driver.error()
    this.incommingReq.session.destroy();
}

class WSserver {
    constructor() {
        this.wss = null;
        this.brokenConnCheck = null;
    }

    init(server) {
        this.wss = new WebSocket.Server({
            verifyClient: verifyClientFn,
            server
        });

        this.brokenConnCheck = setInterval(this.brokenCheck.bind(this), brokenConnectionTimer);
        this.wss.on('connection', (ws, req) => { this.handleNewConnection(ws, req) });
    }

    /**
     * Handles new conncetion and create a new driver
     *
     * @param {WebSocket} ws
     * @param {Express.Request} req
     */
    handleNewConnection(ws, req) {
        // create new Driver object
        const theDriver = drivers.addDriver(Number(req.session.passport.user.id), ws);

        setDefaultsOnWs(theDriver, req, ws);

        ws.on('pong', heartbeat);
        ws.on("ping", heartbeat);
        ws.on("message", handleMessageFn);
        ws.on("close", handleCloseFn);
        ws.on("error", handleErrorFn);
    }

    brokenCheck() {
        debug("Checking broken connections");

        if (this.wss == null) return;

        const currentTime = Date.now();

        this.wss.clients.forEach((c) => {
            if (c.isAlive === false) {
                debug(`Found broken connection. User: ${c.driver.id}`);
                // terminate will close this connection and close callback will be called
                return c.terminate();
            }

            c.isAlive = false;
            c.ping('', false, true);
        });

        drivers.timeoutCheck(currentTime);
    }
}

function init(server) {
    debug("Initializing websocket module");
    WSinstance = new WSserver();
    WSinstance.init(server);
}

module.exports = {
    init
}
