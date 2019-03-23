const debug = require("debug")("backend:routes:blacklist")

var blacklist = require("../models/blacklist")
var auth = require("../controllers/auth")

/**
 * Blacklist a user
 * Blaclisted user can not make new order as this user was doing something bad in the past
 * In the post body there has to be info about who to blacklist, newer blacklist user by his
 * registered id, but rather phone id or name or phone number so the user can be detected
 * even from different location/registration
 */
function addToBlacklist(req, res) {}

/**
 * Get all blacklisted users
 * Send all blacklisted users to driver
 */
function getBlacklist(req, res) {
    blacklist
        .getAll()
        .then(value => {
            res.json({ data: value })
        })
        .catch(() => {
            res.sendStatus(500)
        })
}

/**
 * Deletes blacklisted user from blacklist
 * User can now make orders, json send to server is generater from GET /blacklist and from those
 * information about user so he/she can be removed from DB
 */
function deleteFromBlacklist(req, res) {
    blacklist
        .deleteItem(req.params.id)
        .then((/* value */) => {
            res.sendStatus(200)
        })
        .catch((/* err */) => {
            res.sendStatus(500)
        })
}

function install(router) {
    debug("Installing")

    // API for driver
    router.post("/blacklist", auth.isLoggedIn, addToBlacklist)
    router.get("/blacklist", auth.isLoggedIn, getBlacklist)
    router.delete("/blacklist/:id", auth.isLoggedIn, deleteFromBlacklist)
}

module.exports = {
    install
}
