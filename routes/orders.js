const debug = require("debug")("backend:routes:orders")

const db = require("../models/database")

const model = require("../models/orders")
const auth = require("../controllers/auth")

function createNewOrder(req, res) {}

function checkOrder(req, res) {
    const theId = req.params.id

    if (theId === undefined) {
        res.sendStatus(400)
        return
    }

    db.c.query(sqlOrderCheck, [theId], (err, result, fields) => {
        if (err) {
            debug(err)
            res.sendStatus(400)
        } else if (result.length > 0) {
            res.json({ data: result[0] })

            //debug(util.inspect(result[0], false, null))
            //res.setHeader('Content-Type', 'application/json');
            //res.send(`{"id": ${theId}, "data": ${util.inspect(result[0], false, null)}`);
        } else {
            res.sendStatus(400)
        }
    })
}

function deleteOrder(req, res) {}

function handleTakeOrder(req, res) {}

function handleDenyOrder(req, res) {}

function handleCancelOrder(req, res) {}

function handleFwdOrder(req, res) {}

function handleDoneOrder(req, res) {}

function handleReportOrder(req, res) {}

function install(router) {
    debug("Installing")
    // API for customer
    router.post("/order", createNewOrder)
    router.get("/order/:id", checkOrder)
    router.delete("/order/:id", deleteOrder)

    // API for drivers
    router.post("/order/:id/take", auth.isLoggedIn, handleTakeOrder)
    router.post("/order/:id/deny", auth.isLoggedIn, handleDenyOrder)
    router.post("/order/:id/cancel", auth.isLoggedIn, handleCancelOrder)
    router.post("/order/:id/fwd", auth.isLoggedIn, handleFwdOrder)
    router.post("/order/:id/done", auth.isLoggedIn, handleDoneOrder)
    router.post("/order/:id/report", auth.isLoggedIn, handleReportOrder)
}

module.exports = {
    install
}
