const express = require('express');
const router = express.Router();
const User = require('../Schemas/User')
const { Authmiddlewhere, Adminonly} = require('../middlewhere/Authmiddlewhere')

router.get('/user', Authmiddlewhere, Adminonly, async(req, res) => {
    const user = await User.find().select("-Password -refreshToken")
    res.json(user)
})

router.delete('/user/:id', Authmiddlewhere, Adminonly, async(req, res) => {
    const user = await User.findByIdAndDelete(req.params.id)
    res.json({ 'message': `User ${user?.Username} deleted`})
})

module.exports = router