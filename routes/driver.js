const debug = require("debug")("backend:routes:driver")

const db = require("../models/database")
const model = require("../models/driver")

const passportConfig = require('../config/passport');
const passport = require('passport');

function updateLocation(req, res, next) {
    model.updateLatLng(req.body);

    res.sendStatus(200);
}

function panic(req, res, next) {
    model.panic( req.body );

    res.sendStatus(200);
}

function syncState(req, res, next) {
    model.syncState(req.body.id).then( value => {
    } ).catch( err => {
     } );


}

const renderRegister = (req, res, next) =>
{
    res.render( 'signup' );
}

const renderLogin = ( req, res, next ) =>
{
    res.render( 'signin' );
}


/**
 * Check is request is authenticated and if yes call the next handler in row
 * if not then responde with redirection
 *
 * @param {express.req} req
 * @param {express.res} res
 * @param {express.callback} next
 */
const isLoggedIn = ( req, res, next ) =>
{
    if (req.isAuthenticated()){
        return next();
    }

    req.session.destroy( ( err ) => {
        res.sendStatus(403);
    } )

}

function checkLogin( err, user, info ) {
    debug( err );
    debug( user );
    debug( info );

    if (err) { return this.next(err) }

    if (!user) { return this.res.sendStatus( 401 ) }

    this.req.logIn( user, (err) => {
        if( err )
        {
            this.res.sendStatus( 500 )
        }
        else
        {
            model.login( user.id ).then( ( value ) => {
                this.res.json( { "user" : user } );
            } ).catch( ( errr ) => {
                this.res.json( { "user" : user } );
            } )
        }
    } )
}

function checkRegister(err, user, info) {
    debug( err );
    debug( user );
    debug( info );

    if (err) { return this.next(err) }

    if (!user) { return this.res.sendStatus( 302 ) }

    this.req.logIn( user, function(err) {
        this.res.json( { "user" : user } );
    } )
}

function doLogin( req, res, next )
{
    debug( "Handling login post" );
    const theThis = { req : req, res : res, next : next }
    passport.authenticate('local-signin', checkLogin.bind(theThis))(req, res, next);
}

function doRegister( req, res, next )
{
    debug( "Handling register post" );
    const theThis = { req : req, res : res, next : next }
    passport.authenticate('local-signup', checkRegister.bind( theThis ) )(req, res, next);
}

/**
 * Logout driver in DB and set the state destroy the session and send response
 *
 * @param {Express.Request} req
 * @param {Express.Response} res
 * @param {Express.callback} next
 */
function doLogout( req, res, next )
{
    driver.logout( req.user.id ).then( ( data ) => {
        req.logout()
        req.session.destroy( function(err) {
            res.sendStatus( 200 );
        } );
    } ).catch( ( err ) => {
        console.log( err );
        res.sendStatus( 500 );
    } )
}

function init( router ) {
    passportConfig( passport );

    router.post("/driver/:id/location", updateLocation);
    router.post("/driver/:id/panic", panic);
    router.get("/driver/:id", syncState);
    router.get('/register', renderRegister );
    router.get('/login', renderLogin );
    router.get('/logout', isLoggedIn, doLogout );
    router.post('/register', doRegister );
    router.post('/login', doLogin );
}

module.exports = init