const debug = require("debug")("backend:routes:communication")

/**
 * Send message to user
 */
function postMessage(req, res) {
    console.log(req.body)
    res.sendStatus(200)
}

/**
 * Get all pending messages from chat
 */
function readMessages(req, res) {
    console.log(req.body)
    res.send("comunication")
}

function install(router) {
    debug("Installing")

    // API for driver or customer
    router.post("/communication", postMessage)
    router.get("/comunication", readMessages)
}

module.exports = {
    install
}
