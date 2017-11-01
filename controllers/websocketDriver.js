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
    toSend = { "op" : "location", "id" : userId, "data" : msg }

    sendEach( userId, toSend );
}

function panic( userId, msg )
{
    toSend = { "op" : "panic", "id" : userId }

    sendEach( userId, toSend );
}

function newDriver( userId )
{
    taxi_drivers.getTaxiById( userId ).then( ( data ) => {
        toSend = { "op" : "newDriver", "id" : userId, "data" : data }
        
        sendEach( userId, toSend );
    } ).catch( ( err ) => {
        console.log( err );
    } )
}

function loggoutDriver( userId )
{
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
     }, 60000);

    wss.on('connection', (ws, req) => {
        const userID = req.session.passport.user;

        debug(`User with id ${userID} connected`);
        

        // register this connection under user id
        drivers[ userID ] = ws;
        ws.userID = userID;

        newDriver( userID );

        ws.isAlive = true;
        ws.on('pong', heartbeat);

        ws.on('message', (message) => {
            let msg = JSON.parse( message );

            if( msg.op == "panic" )
            {
                panic( userID, message );
            } else if( msg.op == "update" ) {
                locationUpdate( userID, msg )
            } else if( msg.op == "getAll" ) {
                getAll( ws, userID );
            }


            console.log(`WS message ${message} from user ${userID}`);
        });

        // In close ws event unregister user id from connections
        ws.on("close", (code, reason) => {
            debug( `Closing connection for user: ${userID}` );
            debug( `Code: ${code}` );
            debug( `Reason: ${reason}` );

            delete drivers[ userID ];

            loggoutDriver( userID );
        });

        // Error should be handled as disconnect
        ws.on("error", (err) => {
            delete drivers[ userID ];

            loggoutDriver( userID );
        })
    });
}

module.exports = init