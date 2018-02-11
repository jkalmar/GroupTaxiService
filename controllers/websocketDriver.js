const WebSocket = require('ws');
const sessionParser = require("../config/session")
const debug = require("debug")("backend:ws")
const taxi_drivers = require( "../models/driver" );

const correctCloseCode = 3000;
const waitForDriverReConnectionTime = 20000;
const brokenConnectionTimer = 60000;
const syncTime = 60000;

var drivers = [];

class Driver{
    constructor( id, ws ){
        this.id = id;
        this.wsconn = ws;
        this.isAlive = false;
        this.timeout = null;
    }

    logout(){
        debug( "Logging out driver with id: " + this.id );
        
        taxi_drivers.logout( this.id ).then( ( data ) => {
            toSend = { "op" : "byeDriver", "id" : this.id }
        
            sendEach( this.id, toSend );
        } ).catch( ( err ) => {
            console.log( err );
        } )
    }

    error(){
        debug( "Writing broken connection to db" )
        taxi_drivers.brokenConnection( this.id );
        this.logout();
    }

    /**
     * Sends msg to driver, msg should be a json object which will be added to "data" key in message
     * something like: { "id" : id, "op" : op, "data" : msg }
     * 
     * @param {string} op
     * @param {JSON} msg 
     */
    send( op, msg )
    {
        if( this.wsconn )
        {
            const toSend = JSON.stringify( { "id" : this.id, "op" : op, "data" : msg } );
            this.wsconn.send( toSend );
        }
    }
}

function makeOrder( anOrder, driverId )
{
    return new Promise((resolve, reject) => {
        taxi_drivers.getNextLogged( driverId ).then( value => {
            if( value.length )
            {
                debug( value )

                const theDriver = drivers[ value[0].id ];
                const toSend = { "op" : "order", "id" : anOrder.params.id, "data" : anOrder.params }

                debug( `Sending order: ${anOrder.params.id} to drivers` );
                debug( `Sending order: ${JSON.stringify(anOrder.params)} to drivers` );
                debug( `Driver: ${theDriver.id}` )

                sendOne( theDriver, toSend );

                resolve(theDriver.id);
            }

            resolve(0)
        } ).catch( err => {
            reject( err )
        } )
    })
}

function heartbeat()
{
    this.isAlive = true;
}

WebSocket.prototype.setDefaults = function( userId )
{
    debug( "Setting values for ws" );
    this.userId = userId;
    this.isAlive = true;
    this.on('pong', heartbeat);
    this.on("ping", ( message ) => {
        //debug( "Recv ping message" );
        this.isAlive = true;
    })
}

function sendEach( userId, toSend )
{
    const msg = JSON.stringify(toSend);

    drivers.forEach( (theDriver, index) => {
        // do not send panic handle to myself
        if( index != userId )
        {
            if( theDriver.wsconn )
            {
                theDriver.wsconn.send( msg );
            }
        }
    })
}

function sendOne( theDriver, toSend )
{
    const msg = JSON.stringify(toSend);

    if( theDriver.wsconn )
    {
        theDriver.wsconn.send( msg );
    }
    else
    {
        debug( "Error sending: " + toSend )
    }
}

function locationUpdate( userId, msg )
{
    taxi_drivers.updateLocation( msg.lat, msg.lng, msg.id ).then( value => {
        toSend = { "op" : "location", "id" : userId, "data" : msg }
        sendEach( userId, toSend );
    } ).catch( err => {
        debug( err );
        debug( "ERROR: update location" );
    } )
}

function panic( ws, userId, msg )
{
    toSend = { "op" : "panic", "id" : userId, "state" : msg.state }

    console.log( msg.state );
    const msgSelf = JSON.stringify(toSend);

    sendEach( userId, toSend );
    ws.send( msgSelf )
}

function newDriver( aDriver )
{
    debug( "sending update" );

    taxi_drivers.getTaxiById( aDriver.id ).then( ( data ) => {
        toSend = { "op" : "newDriver", "id" : aDriver.id, "data" : data }

        sendEach( aDriver.id, toSend );
    } ).catch( ( err ) => {
        console.log( err );
    } )
}

function getAll( wsclient, userId )
{
    const toSend = { "op" : "allDrivers", "id" : userId }

    taxi_drivers.getTaxis().then( value => {
        toSend.data = value;

        wsclient.send( JSON.stringify( toSend ) );
    } ).catch( value => {
        toSend.data = [];

        wsclient.send( JSON.stringify( toSend ) );
    } )

    
}

function init(server) {
    console.log("Initializing ws server")

    const wss = new WebSocket.Server({
        verifyClient: (info, done) => {
            debug("New client connected")

            sessionParser(info.req, {}, () => {
                if (info.req.session.passport === undefined) {
                    debug("Connection has no session")
                    done(false, 401, JSON.stringify( { "op" : "unauth" } ) );

                    return;
                }

                done(true);
            });
        },
        server
    });

    function brokenConnectionFunc()
    {
        debug( "BrokenConnectionFunc" );
        
        const currentTime = Date.now();

        wss.clients.forEach( (conn) =>
        { 
            if( conn.isAlive === false ){
                debug( `Found broken connection. User: ${ conn.userId }` );

                // mark this connection as broken and terminate it
                theDriver = drivers[ conn.userId ];

                if( theDriver && theDriver.wsconn === conn )
                {
                    debug(`Deleting driver: ${theDriver.id}`);
                    delete drivers[ theDriver.id ];
                    theDriver.error();
                }

                return conn.terminate();
            }
                 
            conn.isAlive = false;
            conn.ping('', false, true);
        });

        // now check all drivers if someone is in timeout state
        driversToDelete = [];
        drivers.forEach( ( aDriver ) => {
            
            // check if driver has timeout set
            // and the time has passed for him            
            if( aDriver.timeout && aDriver.timeout < currentTime ){
                debug(`Pushing driver: ${aDriver.id} to delete` );
                driversToDelete.push( aDriver );
            }
        } )

        driversToDelete.forEach( ( aDriver ) =>{
            aDriver.error();
            delete drivers[ aDriver.id ];
        } )

    }

    const brokenConnCheck = setInterval( brokenConnectionFunc, brokenConnectionTimer);

    wss.on('connection', (ws, req) => {
        const theDriver = new Driver( req.session.passport.user, ws );
        debug(`User with id ${theDriver.id} connected`);

        // register this connection under user id
        if( ! ( theDriver.id in drivers ) )
        {
            newDriver( theDriver );
        }

        drivers[ theDriver.id ] = theDriver;
        ws.setDefaults( theDriver.id );

        ws.on('message', (message) => {
            let msg = JSON.parse( message );

            if( msg.op == "panic" )
            {
                panic( ws, theDriver.id, msg );
            } else if( msg.op == "update" ) {
                locationUpdate( theDriver.id, msg )
            } else if( msg.op == "getAll" ) {
                getAll( ws, theDriver.id );
            }
            else if( msg.op == "take" ) {
                // {"op":"take","id":9,"taxi":"test1","orderId":138} from user 9
                const orders = require( "../models/orders" )
                orders.takeOrder( msg.data, theDriver );
            }
            else if( msg.op == "decline" ) {
                const orders = require( "../models/orders" )

                orders.declineOrder( msg.data, theDriver )

                debug("--------------> Order declined" + msg);
            }
            else if( msg.op == "finish" ) {
                const orders = require( "../models/orders" )

                debug("--------------> Order finished" + msg);

                orders.finishOrder( msg.data, theDriver );
            }
            console.log(`WS message ${message} from user ${theDriver.id}`);
        });

        // In close ws event unregister user id from connections
        ws.on("close", (code, reason) => {
            debug( `Closing connection for user: ${theDriver.id}` );
            debug( `Code: ${code}` );
            debug( `Reason: ${reason}` );

            if( code == correctCloseCode ){
                theDriver.logout();
                delete drivers[ theDriver.id ];
                req.session.destroy();                       
            }else if( drivers[ theDriver.id ] ){
                
                if( drivers[ theDriver.id ].wsconn === ws ){
                    theDriver.timeout = Date.now() + waitForDriverReConnectionTime;
                    theDriver.wsconn = null;
                    req.session.destroy();                   
                }
            }

        });

        // Error should be handled as disconnect
        ws.on("error", (err) => {
            debug( "Error recv for driver: " + userId );
            theDriver = drivers[ userId ]
            theDriver.logout();
            delete drivers[ userId ];

            req.session.destroy();
        })
    });
}



module.exports = {
    init,
    makeOrder,
}
