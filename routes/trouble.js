const debug = require("debug")("backend:routes:orders")

var trouble = require("../models/trouble")
var auth = require("../controllers/auth")

function install(router) {
    debug("Installing")

    router.get("/trouble", auth.isLoggedIn, trouble.getAll)
    router.post("/trouble", auth.isLoggedIn, trouble.addNew)
    router.delete("/trouble", auth.isLoggedIn, trouble.deleteDriver)
}

module.exports = {
    install
}
