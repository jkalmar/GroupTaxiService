const db = require('./database');

const sqlGetAllUsers = "SELECT id, nick, phone, email, address FROM customers"
const sqlInserNewUser = "INSERT INTO customers (`phone`) VALUES (?)"
const sqlUpdateNick = "UPDATE LOW_PRIORITY `customers` SET `nick`=? WHERE `id`=? limit 1"
const sqlUpdateEmail = "UPDATE LOW_PRIORITY `customers` SET `email`=? WHERE `id`=? limit 1"
const sqlUpdateAddress = "UPDATE LOW_PRIORITY `customers` SET `address`=? WHERE `id`=? limit 1"

function newUser( phone ){


}







/**
 *
 * @param {Express.Router} app
 */
function init( app ) {

}


module.exports = {
    init
}
