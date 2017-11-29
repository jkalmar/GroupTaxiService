const WebSocket = require('ws');
const sessionParser = require("../config/session")
const debug = require("debug")("backend:ws")
const taxi_drivers = require( "../models/driver" );

var drivers = [];

function heartbeat()
{
    this.isAlive = true;
}

function sendEach( userId, toSend )
{
    const msg = JSON.stringify(toSend);

    drivers.forEach( (theDriver, index) => {
        // do not send panic handle to myself
        if( index != userId )
        {
            theDriver.send( msg );
        }
    })
}

function locationUpdate( userId, msg )
{
    taxi_drivers.updateLocation( msg.lat, msg.lng, msg.id ).then( value => {
        toSend = { "op" : "location", "id" : userId, "data" : msg }
        sendEach( userId, toSend );
    } ).catch( err => {
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

function newDriver( userId )
{
    debug( "sending update" );

    taxi_drivers.getTaxiById( userId ).then( ( data ) => {
        toSend = { "op" : "newDriver", "id" : userId, "data" : data }

        sendEach( userId, toSend );
    } ).catch( ( err ) => {
        console.log( err );
    } )
}

function loggoutDriver( userId )
{
    debug( "Logging out driver with id: " + userId );

    taxi_drivers.logout( userId ).then( ( data ) => {
        toSend = { "op" : "byeDriver", "id" : userId }

        sendEach( userId, toSend );
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

function order( userId, msg )
{
    const toSend = { "op" : "order", "id" : userId, "data" : { "id" : 25, "from" : { "lat" : 49.8, "lng" : 18.95 }, "to" : { "lat" : 49.7, "lng" : 18.93 } } }
    
    sendEach( userId, toSend );
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

    const brokenConnCheck = setInterval(function ping()
    {
        debug( "Calling bronkenConnCheck" );

        wss.clients.forEach(function each(ws)
        {
            if ( ws.isAlive === false ) 
            {
                debug( `Found broked connecting, terminating for id: ${ws.userID}` );
                return ws.terminate();
            }
      
            ws.isAlive = false;
            ws.ping('', false, true);
        });
     }, 120000);

    wss.on('connection', (ws, req) => {
        const userID = req.session.passport.user;

        debug(`User with id ${userID} connected`);
        
        // register this connection under user id
        drivers[ userID ] = ws;
        ws.userID = userID;

        newDriver( userID );

        ws.isAlive = true;
        ws.on('pong', heartbeat);
        ws.on("ping", ( message ) => {
            debug( "Recv ping message" );
        })

        ws.on('message', (message) => {
            let msg = JSON.parse( message );

            if( msg.op == "panic" )
            {
                panic( ws, userID, msg );
            } else if( msg.op == "update" ) {
                locationUpdate( userID, msg )
            } else if( msg.op == "getAll" ) {
                getAll( ws, userID );
            } else if( msg.op == "order" ) {
                order( userID, msg );
            }


            console.log(`WS message ${message} from user ${userID}`);
        });

        // In close ws event unregister user id from connections
        ws.on("close", (code, reason) => {
            debug( `Closing connection for user: ${userID}` );
            debug( `Code: ${code}` );
            debug( `Reason: ${reason}` );

            if( drivers[ userID ] === ws )
            {
                debug( "Deleting driver from db" );

                //req.session.destroy();

                delete drivers[ userID ];
                loggoutDriver( userID );
            }
        });

        // Error should be handled as disconnect
        ws.on("error", (err) => {
            debug( "Error recv for driver: " + userID );
            delete drivers[ userID ];

            //req.session.destroy();

            loggoutDriver( userID );
        })
    });
}

module.exports = init