var express = require("express")
var router = express.Router()

const debug = require("debug")("backend:api")

const authApi = require("./auth")
const blacklistApi = require("./blacklist")
const communicationApi = require("./communication")
const driverApi = require("./driver")
const issueApi = require("./issue")
const ordersApi = require("./orders")

/* TODO: Fix web
router.get("/v1", function(req, res) {
    views
        .incView("index")
        .then(value => {
            res.render("index")
        })
        .catch(value => {
            res.sendStatus(500)
        })
})

router.get("/drivers", function(req, res, next) {
    taxi_drivers
        .getTaxis()
        .then(value => {
            res.json({ users: value })
        })
        .catch(value => {
            res.sendStatus(500)
        })
})

router.get("/broken", function(req, res, next) {
    taxi_drivers
        .getBrokenConnections()
        .then(value => {
            res.render("broken", { data: value })
        })
        .catch(err => {
            debug(err)
            res.sendStatus(500)
        })
})
*/

module.exports = app => {
    debug("Installing")

    authApi.install(router)
    blacklistApi.install(router)
    communicationApi.install(router)
    driverApi.install(router)
    issueApi.install(router)
    ordersApi.install(router)

    app.use("/", router)
}
