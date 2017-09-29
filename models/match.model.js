const mongoose = require('../db.js');

const matchSchema = new mongoose.Schema({
  date: Date,
  tournament_id: {type: mongoose.Schema.Types.ObjectId, ref: 'Tournament'},
  player1: {
    name: String,
    score: Number,
    telegram_id: Number,
  },
  player2: {
    name: String,
    score: Number,
    telegram_id: Number,
  },
});

const MatchModel = mongoose.model('match', matchSchema);

MatchModel.createMatch = async matchInfo => {
  console.log('match info!!!!!!!!!!!!');
};

module.exports = MatchModel;
