const WebSocket = require('ws');
const sessionParser = require( "../config/session" )

function init( server )
{
    console.log("Initializing ws server")

    const wss = new WebSocket.Server({
        verifyClient: (info, done) => {
          console.log('Parsing session from request...');
          sessionParser(info.req, {}, () => {
            console.log('Session is parsed!');
            console.log(info)
      
            //
            // We can reject the connection by returning false to done(). For example,
            // reject here if user is unknown.
            //
            done(true);
          });
        },
        server
      });
      
      wss.on('connection', (ws, req) => {
        ws.on('message', (message) => {
          //
          // Here we can now use session parameters.
          //
          console.log(`WS message ${message} from user ${req.session.userId}`);
        });
      });
}

module.exports = init