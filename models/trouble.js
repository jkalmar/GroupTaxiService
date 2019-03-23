/**
 * Get all drivers that are in some kind of trouble
 * All clients should periodically check if someone has trouble
 * so they can help that driver
 */
const getAll = (req, res) => {
    const result = { code: 200 }

    res.json(result)
}

/**
 * Add new driver to drivers in trouble db
 * Tapping panic button will send post here to indicate that a driver has
 * a problem, but after the driver is safe he will send a delete several time
 * to indicate that he is ok
 * This function is reentrant and so client can send periodically that
 * he needs help
 * New driver is in req.body json data structure
 */
const addNew = (req, res) => {
    res.sendStatus(200)
}

/**
 * Delete driver from trouble db
 * If client send DELETE with his id then he is deleted from trouble DB and
 * everybody will not need to help him anymore
 *
 */
const deleteDriver = (req, res) => {
    res.sendStatus(200)
}

module.exports = {
    getAll,
    addNew,
    deleteDriver
}
