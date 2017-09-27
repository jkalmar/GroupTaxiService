const debug = require('debug')('backend:auth');
const passportConfig = require('../config/passport');
const passport = require('passport');

const register = (req, res, next) =>
{
    res.render( 'signup' );
}

const login = ( req, res, next ) =>
{
    res.render( 'signin' );
}

const processRegister = (req, res, next) =>
{
    res.sendStatus(200);
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

    res.sendStatus(401);
}

function authHandler( req, res, next )
{
    debug( "Handling login post" );
    
    passport.authenticate('local-signin', function(err, user, info)
    {
        debug( err );
        debug( user );
        debug( info );
    
        if (err) { return next(err) }

        if (!user) { return res.sendStatus( 401 ) }
        
        req.logIn( user, function(err) {
            res.sendStatus( 200 );
        } )        
    })(req, res, next); 
}

function registerHandler( req, res, next )
{
    debug( "Handling register post" );

    passport.authenticate('local-signup', function(err, user, info)
    {
        debug( err );
        debug( user );
        debug( info );
    
        if (err) { return next(err) }

        if (!user) { return res.sendStatus( 302 ) }
        
        req.logIn( user, function(err) {
            res.sendStatus( 200 );
        } )        
    })(req, res, next); 
}

function logout( req, res, next )
{
    req.logout();
    req.session.destroy( function(err) {
        res.redirect('/');
    } );
}

/**
 * Setup routes for handling the authentication
 * 
 * @param {express.router} router 
 */
const setUp = ( router ) =>
{
    passportConfig( passport );

    router.get('/register', register );
    router.get('/login', login );
    router.get('/logout', logout );
    
    router.post('/register', registerHandler );
    router.post('/login', authHandler );
};

module.exports = {
    setUp,
    isLoggedIn
};