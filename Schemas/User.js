const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema(
    {
        Username: { type: String, required: true, unique: true },
        Password: { type: String, required: true },
        role: { type: String, enum: ["Admin", "User"], default: "User" },
        Email: { type: String, required: true, unique: true },
        refreshToken: { type: String },
        friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        profilePicture: { type: String, default: null }, // NEW
        resetPasswordToken: {type: String},
        resetPasswordExpires: {type: Date}
    }
)

module.exports = mongoose.model("User", UserSchema)