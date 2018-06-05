const session    = require('express-session')
const MySQLStore = require('express-mysql-session')(session);

// load options from config file and use it as connection settings for
// session db
const options = require('./config.json').dbSession;
const sessionStore = new MySQLStore(options);

const sessionParser = session({
    secret: 'taxiapp',
    resave: true,
    store: sessionStore,
    saveUninitialized:true,
    cookie : {
      maxAge : 86400000
    }
})

module.exports = sessionParser;