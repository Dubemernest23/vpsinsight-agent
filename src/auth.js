const httpStatusCodes = require('./constants/httpStatusCodes');

function authMiddleware(req, res, next) {

    if (!process.env.TOKEN) {
        console.error('TOKEN is not set in environment variables');
        return res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'Server misconfiguration' });
    }

    const authHeader = req.headers['authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(httpStatusCodes.UNAUTHORIZED).json({ error: 'Authorization header missing or malformed' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== process.env.TOKEN) {
        return res.status(httpStatusCodes.UNAUTHORIZED).json({ error: 'Invalid token' });
    }

    next();
}

module.exports = authMiddleware;