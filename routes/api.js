var express = require('express');
var router = express.Router();
const debug = require('debug')('backend:api');
const auth = require('../controllers/auth');
const issues = require('../models/issues');
const views = require("../models/views");

const taxi_drivers = require('../models/driver');

const trouble = require('../models/trouble');
const orders = require("../models/orders")
const blacklist = require("../models/blacklist")
const users = require("../controllers/users")
const ordersApi = require("./orders")
const driverApi = require("./driver")

users(router)
ordersApi(router)
driverApi(router)

router.get('/v1', function (req, res, next) {
    views.incView("index").then(value => {
        res.render("index");
    }).catch(value => {
        res.sendStatus(500);
    })
});

router.get('/drivers', function (req, res, next) {
    taxi_drivers.getTaxis().then(value => {
        res.json({ users: value });
    }).catch(value => {
        res.sendStatus(500);
    })
});

/**
 * Send message to user
 */
router.post('/communication', (req, res, next) => {
    console.log(req.body)
    res.sendStatus(200);
});

/**
 * Get all pending messages from chat
 */
router.get('/comunication', (req, res, next) => {
    console.log(req.body)
    res.send("comunication");
});

/**
 * Post new order from user to system
 */
router.post('/order', (req, res, next) => {
    orders.createNewOrder(res, req.body);
});

router.get("/order/:id/cancel", orders.cancelOrder);

router.get("/order/:id/check", orders.checkOrder)

/**
 * Get new orders from system to taxi
 * This considers also driver total orders
 */
router.get('/order/:driverId', (req, res, next) => {

});

/**
 * Get all orders from system that belongs to a user
 */
router.get('/order', (req, res, next) => {
    res.send("Orders");
});

/**
 * Take specific order
 * This will send confirmating respons to driver in case there are more
 * drivers taking this order simultanuosly
 */
router.post('/take/:id', (req, res, next) => {

});

/**
 * Rate driver
 * Registered user can rate driver
 */
router.post('/rate/:driverId', (req, res, next) => {

});

/**
 * Blacklist a user
 * Blaclisted user can not make new order as this user was doing something bad in the past
 * In the post body there has to be info about who to blacklist, newer blacklist user by his
 * registered id, but rather phone id or name or phone number so the user can be detected
 * even from different location/registration
 */
router.post('/blacklist', auth.isLoggedIn, function (req, res, next) {

});

/**
 * Get all blacklisted users
 * Send all blacklisted users to driver
 */
router.get('/blacklist', auth.isLoggedIn, (req, res, next) => {
    blacklist.getAll().then(value => {
        res.json({ data: value });
    }).catch(err => {
        res.sendStatus(500);
    })
});

/**
 * Deletes blacklisted user from blacklist
 * User can now make orders, json send to server is generater from GET /blacklist and from those
 * information about user so he/she can be removed from DB
 */
router.delete('/blacklist/:id', auth.isLoggedIn, function (req, res, next) {
    blacklist.deleteItem(req.params.id).then(value => {
        res.sendStatus(200);
    }).catch(err => {
        res.sendStatus(500);
    })
});

/**
 * Get all taxis that are in trouble
 */
router.get('/trouble', auth.isLoggedIn, function (req, res, next) {
    trouble.getAll(req, res, next);
})

/**
 * Post that handle a trouble
 * Tapping panic button will send post here to indicate that a driver has
 * a problem
 */
router.post('/trouble', auth.isLoggedIn, function (req, res, next) {
    trouble.addNew(req, res, next);
})

/**
 * Delete that handle a trouble
 * Tapping panic button will send post here to indicate that a driver has
 * a problem, but after the driver is safe he will send a delete several time
 * to indicate that he is ok
 */
router.delete('/trouble', auth.isLoggedIn, function (req, res, next) {
    trouble.deleteDriver(req, res, next);
})

router.post("/issue", function (req, res, next) {
    debug("got issue: " + JSON.stringify(req.body));

    issues.insertIssue(req.body).then(value => {
        res.sendStatus(200);
    }).catch(err => {
        debug("Sending 500");
        debug(err);
        res.sendStatus(500);
    })
})

router.get("/issues", function (req, res, next) {
    issues.getAll().then(value => {
        debug(value);
        res.render('issues', { "issues": value });
    }).catch(err => {
        debug(err);
        res.sendStatus(500);
    })
})

router.get("/broken", function (req, res, next) {
    taxi_drivers.getBrokenConnections().then(value => {
        res.render("broken", { "data": value });
    }).catch(err => {
        debug(err)
        res.sendStatus(500);
    })
})

/**
 * Handles the new phone number
 * Checks database and generate new validation code
 */
router.post("/auth/number", function (req, res, next) {
    debug("new auth number: " + req.body.phoneNum)
    setTimeout(() => {
        res.sendStatus(200);
    }, 2000)

})

/**
 * Handles validation code on phone number
 */
router.post("/auth/code", function (req, res, next) {
    debug("Validation code: " + req.body.valCode)

    setTimeout(() => {
        res.sendStatus(200);
    }, 2000)
})

module.exports = (app) => {
    app.use("/", router);
};