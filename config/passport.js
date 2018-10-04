const driver = require( '../models/driver' );
const debug = require('debug')('backend:config:passport');

const initialize = (passport) =>
{
    const LocalStrategy = require('passport-local').Strategy;

    passport.use('local-signup', new LocalStrategy(
        {
            usernameField: 'username',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass back the entire request to the callback
        },
        function(req, username, password, done) {
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
        } )
    );

//Login is handled here
passport.use('local-signin', new LocalStrategy(
    {
        // by default, local strategy uses username and password, we will override with email
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) {
        driver.getTaxiByNamePassword( username, password ).then( ( result ) => {
            if( result.length == 1 )
            {
                okObject = {
                    "id" : result[0].id,
                    "appVersion" : req.body.appVersion
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

));


    passport.serializeUser(function(okObject, done) {
        debug("serialize: ", okObject);
        done(null, okObject);
    });

    passport.deserializeUser(function(okObject, done) {
        debug("deserialize: ", okObject);
        done(null, okObject);
    });


}

module.exports = initialize;


