const driver = require( '../models/driver' );
const debug = require('debug')('backend:config:passport');

const passportConfig = {
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true
}

function handleRegister(req, username, password, done) {
    driver.getTaxiByName( username ).then( (result) =>{

        // there already exist a driver with given username
        // just call the done method and pass false to it
        if( result.length > 0 )
        {
            return done( null, null, { message: 'Username already exist' } );
        }

        // driver does not exist, so register him
        driver.insertTaxi( username, password ).then( ( result ) => {
            debug( result.insertId );

            // call the done with my last ID that we will serialize into the session
            // this ID will be used in future requests to load/update driver in DB
            return done( null, result.insertId, { message : "User succesfully added to DB" } );

        } ).catch( ( value ) => {
            done( value, null, { message : "Error happened" } );
        } );
    } ).catch( (value) => {
        done(value, null, { message : "Error happened" } );
    } )
}

function handleLogin(req, username, password, done) {
    driver.getTaxiByNamePassword( username, password ).then( ( result ) => {
        if( result.length == 1 )
        {
            okObject = {
                id : result[0].id,
            }

            done( null, okObject, { message : "User succesfully loged in" } );
        }
        else
        {
            debug(`Bad username: ${username}, password: ${password}`)
            done( null, null, { message : "Wrong username or password" } );
        }
    } ).catch( ( value ) =>{
        done( value, null, { message : "Error happened" } );
    } );
}

/*
 * Visual serialize/deserialize explanation
 * passport.serializeUser(function(user, done) {
 *     done(null, user.id);
 * });              │
 *                  └─────────────────┬──→ saved to session
 *                                    │    req.session.passport.user = {id: '..'}
 *                                    ↓
 * passport.deserializeUser(function(id, done) {
 *                    ┌───────────────┘
 *                    ↓
 *     User.findById(id, function(err, user) {
 *         done(err, user);
 *     });            └──────────────→ user object attaches to the request as req.user
 * });
 **/

function serializer( toSession, done ) {
    debug("serialize: ", toSession);
    done(null, toSession);
}

function deSerializer( fromSession, done ) {
    debug("deserialize: ", fromSession);
    done(null, fromSession);
}

const initialize = (passport) =>
{
    const LocalStrategy = require('passport-local').Strategy;

    passport.use('local-signup', new LocalStrategy( passportConfig, handleRegister ) ) // Register
    passport.use('local-signin', new LocalStrategy( passportConfig, handleLogin ) ) // Login
    passport.serializeUser(serializer);
    passport.deserializeUser(deSerializer);
}

module.exports = initialize;
