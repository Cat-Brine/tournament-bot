const mongoose = require('mongoose');

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/tournament-db', { useMongoClient: true });

module.exports = mongoose;
