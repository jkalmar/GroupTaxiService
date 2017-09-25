const driver = require( '../models/driver' );
const debug = require('debug')('backend:config:passport');

const initialize = (passport) => 
{
    //var User = user;
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
                    done( null, false, { message: 'Username already exist' } );
                }

                // driver does not exist, so register him
                driver.insertTaxi( username, password ).then( ( result ) => {
                    debug( result.insertId );

                    // call the done with my last ID that we will serialize into the session
                    // this ID will be used in future requests to load/update driver in DB
                    done( null, result.insertId );
                    
                } ).catch( ( value ) => {
                    done( value, false );
                } );
            } ).catch( (value) => {
                done(value, false);
            } )
        } )
    );

//LOCAL SIGNIN
passport.use('local-signin', new LocalStrategy(
    {
        // by default, local strategy uses username and password, we will override with email
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true // allows us to pass back the entire request to the callback
    },
    function(req, username, password, done) {
        const isValidPassword = ( userpass, password ) => {
            return password === userpass;
        }

        driver.getTaxiByNamePassword( username, password ).then( ( result ) => {
            if( result.length == 1 )
            {
                debug( "User succesfully loged in" );
                done( null, result[0].id );
            }
            else
            {
                debug( "Wrong username or password" );
                done( null, false, { message : "Wrong username or password" } );
            }
        } ).catch( ( value ) =>{
            done( value, false );
        } );
    }

));


    passport.serializeUser(function(user, done) {
        console.log("serialize");
        done(null, user);
    });

    passport.deserializeUser(function(id, done) {
        console.log("deserialize");
        console.log(id);
        done(null, id);
    });


}

module.exports = initialize;


