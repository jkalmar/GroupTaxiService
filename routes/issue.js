const debug = require("debug")("backend:routes:issue")

var issues = require("../models/issues")

function createIssue(req, res) {
    debug("got issue: " + JSON.stringify(req.body))

    issues
        .insertIssue(req.body)
        .then((/* value */) => {
            res.sendStatus(200)
        })
        .catch(err => {
            debug("Sending 500")
            debug(err)
            res.sendStatus(500)
        })
}

function getAllIssues(req, res) {
    issues
        .getAll()
        .then(value => {
            debug(value)
            res.render("issues", { issues: value })
        })
        .catch(err => {
            debug(err)
            res.sendStatus(500)
        })
}

function install(router) {
    debug("Installing")

    // API for driver
    router.post("/issue", createIssue)
    router.get("/issues", getAllIssues)
}

module.exports = {
    install
}
