function ok(res, data) {
    return res.json(data);
}

function fail(res, { message = 'Internal server error', code = 500, details }) {
    const payload = { error: message };
    if (details) {
        payload.details = details;
    }
    return res.status(code).json(payload);
}

module.exports = {
    ok,
    fail,
};
