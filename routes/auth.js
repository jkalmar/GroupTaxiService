const debug = require("debug")("backend:routes:auth")

/**
 * Handles the new phone number
 * Checks database and generate new validation code
 */
function newCustomer(req, res ) {
    debug("new auth number: " + req.body.phoneNum)
    setTimeout(() => {
        res.sendStatus(200)
    }, 2000)
}

/**
 * Handles validation code on phone number
 */
function validateCustomer(req, res) {
    debug("Validation code: " + req.body.valCode)

    setTimeout(() => {
        res.sendStatus(200)
    }, 2000)
}

function install(router) {
    debug("Installing")

    // API for customer
    router.post("/auth/number", newCustomer)
    router.post("/auth/code", validateCustomer)
}

module.exports = {
    install
}