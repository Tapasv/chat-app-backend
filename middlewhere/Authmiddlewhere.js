const jwt = require('jsonwebtoken')
const User = require('../Schemas/User')

const Authmiddlewhere = async (req, res, next) => {
    const authHeaders = req.headers["authorization"]
    const token = authHeaders && authHeaders.split(' ')[1]

    if (!token) {
        return res.status(403).json({ message: "No token provided" })
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        const user = await User.findById(decoded.userID).select("_id Username role")
        
        if (!user) {
            return res.status(403).json({ message: "User not found" })
        }

        req.userID = decoded.userID
        req.user = user
        req.UserRole = decoded.role
        next()
    } catch (err) {
        console.error("Auth error:", err.message)
        return res.status(401).json({ message: "Invalid or expired token" })
    }
}

const Adminonly = async (req, res, next) => {
    console.log(`Role: ${req.UserRole}`)
    if (req.UserRole !== "Admin") {
        return res.status(403).json({ message: 'Admin only' })
    }
    next()
}

module.exports = { Authmiddlewhere, Adminonly }
