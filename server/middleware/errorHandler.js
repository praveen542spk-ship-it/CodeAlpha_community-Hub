module.exports = function (err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500).json({
    msg: err.message || 'An internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
};
