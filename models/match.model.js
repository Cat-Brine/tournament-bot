const mongoose = require('../db.js');
const Player = require('./player.model');
const Tournament = require('./tournament.model');

const MatchSchema = new mongoose.Schema({
  tournamentId: Object,
  player1: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
  player2: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
  leftChild: {type: mongoose.Schema.Types.ObjectId, ref: 'match'},
  rightChild: {type: mongoose.Schema.Types.ObjectId, ref: 'match'},
  score: Object,
});

const Match = mongoose.model('match', MatchSchema);

MatchSchema.methods.sanitise = function () {
  const root = this.root;
  if (root.leftChild && root.leftChild.player1 === 0) {
    if (root.player1 === undefined) root.player1 = root.leftChild.player2;
    else root.player2 = root.leftChild.player2;
  }
  if (root.rightChild && root.rightChild.player1 === 0) {
    if (root.player1 === undefined) root.player1 = root.rightChild.player2;
    else root.player2 = root.rightChild.player2;
  }
  if (root.leftChild !== undefined) root.leftChild.sanitise();
  if (root.rightChild !== undefined) root.rightChild.sanitise();
};

module.exports = Match;
