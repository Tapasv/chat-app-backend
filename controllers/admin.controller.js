const userRepository = require('../repositories/user.repository');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');

const adminController = {

    getAllUsers: async (req, res, next) => {
        try {
            const users = await userRepository.findAll();
            res.status(200).json(new ApiResponse(200, users, 'Users fetched'));
        } catch (err) {
            next(err);
        }
    },

    deleteUser: async (req, res, next) => {
        try {
            const user = await userRepository.deleteById(req.params.id);
            if (!user) throw new ApiError(404, 'User not found');
            res.status(200).json(new ApiResponse(200, null, `User ${user.Username} deleted`));
        } catch (err) {
            next(err);
        }
    }
};

module.exports = adminController;