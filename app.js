var express = require("express")
var path = require("path")
var favicon = require("serve-favicon")
var logger = require("morgan")
var passport = require("passport")
var bodyParser = require("body-parser")

const db = require("./models/database")

const api_routes = require("./routes/api")
const sessionParser = require("./config/session")

var app = express()

// disable etag generating for every route
// it should not be used for API that change with every request either way
app.set("etag", false)

// require the config json from filesystem
// save all configurable parameters to that file
var config = require(path.join(__dirname, "config", "config.json"))

// view engine setup
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "ejs")

app.use(favicon(path.join(__dirname, "public", "favicon.ico")))

// set parsing of urlencoded and json encoded body parameters
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

// add session middleware
// this will add sessionId to every response and retieve it from every request
// the session is stored into cookie and TODO: mariadb
app.use(sessionParser)

// add passport middleware
// responsible of handling the user authorization to the system
// the passport is configured in ./config/passport.js module
app.use(passport.initialize())
app.use(passport.session()) // persistent login sessions

api_routes(app)

const auth = require("./controllers/auth")
auth.setUp(app)

// handling of static files
app.use(express.static(path.join(__dirname, "public")))

// log everything except api calls
app.use(logger("dev"))

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error("Not Found")
    err.status = 404
    next(err)
})

// error handler
app.use(function(err, req, res) {
    // set locals, only providing error in development

    res.locals.message = err.message
    res.locals.error = req.app.get("env") === "development" ? err : {}

    // render the error page
    res.status(err.status || 500)
    res.render("error")
})

module.exports = app
