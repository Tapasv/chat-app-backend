const User = require('../Schemas/User');

const userRepository = {

    findById: (id, select = '-Password -refreshToken') => {
        return User.findById(id).select(select);
    },

    findByIdFull: (id) => {
        return User.findById(id);
    },

    findByUsername: (username) => {
        return User.findOne({ Username: username });
    },

    findByEmail: (email) => {
        return User.findOne({ Email: email });
    },

    findByRefreshToken: (token) => {
        return User.findOne({ refreshToken: token });
    },

    findByResetToken: (hashedToken) => {
        return User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });
    },

    findByEmailChangeToken: (hashedToken) => {
        return User.findOne({
            emailChangeToken: hashedToken,
            emailChangeExpires: { $gt: Date.now() }
        });
    },

    create: (userData) => {
        return User.create(userData);
    },

    save: (userDocument) => {
        return userDocument.save();
    },

    findByIdAndUpdate: (id, update, options = { new: true }) => {
        return User.findByIdAndUpdate(id, update, options);
    },

    findWithFriends: (id) => {
        return User.findById(id).populate('friends', 'Username profilePicture');
    },

    searchByUsername: (query, excludeId) => {
        return User.find({
            Username: { $regex: query, $options: 'i' },
            _id: { $ne: excludeId }
        }).select('_id Username profilePicture');
    },

    findAll: () => {
        return User.find().select('-Password -refreshToken');
    },

    deleteById: (id) => {
        return User.findByIdAndDelete(id);
    },

    checkUsernameExists: (username, excludeId = null) => {
        const query = { Username: username };
        if (excludeId) query._id = { $ne: excludeId };
        return User.findOne(query);
    },

    checkEmailExists: (email, excludeId = null) => {
        const query = { Email: email };
        if (excludeId) query._id = { $ne: excludeId };
        return User.findOne(query);
    }
};

module.exports = userRepository;