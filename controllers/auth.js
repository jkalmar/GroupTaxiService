const passportConfig = require('../config/passport');

const register = (req, res, next) =>
{
    res.render( 'signup' );
}

const login = ( req, res, next ) =>
{
    res.render( 'signin' );
}

const logout = (req, res, next) => 
{
    req.session.destroy(function(err) {
        res.redirect('/');
    });
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
    res.redirect('/login');    
}

/**
 * Setup routes for handling the authentication
 * 
 * @param {express.router} router 
 */
const setUp = ( router, passport ) =>
{
    passportConfig( passport );

    router.get('/register', register );
    router.get('/login', login );
    
    router.post('/register', passport.authenticate('local-signup', {
        successRedirect: '/profile',
        failureRedirect: '/signup'
      }
    ));

    router.post('/login', passport.authenticate('local-signin', {
        successRedirect: '/profile',
        failureRedirect: '/signin'
    }
    ));
};

module.exports = {
    setUp,
    isLoggedIn
};