/**
 * Get all drivers that are in some kind of trouble
 * All clients should periodically check if someone has trouble
 * so they can help that driver
 */
const getAll = ( req, res, next ) => {
    const result = { "code" : 200 }

    res.json(result);
}


/**
 * Add new driver to drivers in trouble db
 * This function is reentrant and so client can send periodically that
 * he needs help
 * New driver is in req.body json data structure
 */
const addNew = ( req, res, next ) => {
    res.sendStatus(200);
}


/**
 * Delete driver from trouble db
 * If client send DELETE with his id then he is deleted from trouble DB and
 * everybody will not need to help him anymore
 */
const deleteDriver = ( req, res, next ) => {
    res.sendStatus(200);
}

module.exports = {
    getAll,
    addNew,
    deleteDriver
}