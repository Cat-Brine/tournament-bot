const mongoose = require('../db.js');
const Player = require('./player.model');
const Tournament = require('./tournament.model');

const MatchSchema = new mongoose.Schema({
  tournamentId: Object,
  player1: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
  player2: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
  leftChild: {type: mongoose.Schema.Types.ObjectId, ref: 'match'},
  rightChild: {type: mongoose.Schema.Types.ObjectId, ref: 'match'},
  score: { type: Object, default: null },
  playing: Boolean,
  winner: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
  loser: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
});

MatchSchema.methods.sanitise = function () {
  if (this.leftChild && this.leftChild.player1 === null) {
    if (this.player1 === undefined) this.player1 = this.leftChild.player2;
    else this.player2 = this.leftChild.player2;
  }
  if (this.rightChild && this.rightChild.player1 === null) {
    if (this.player1 === undefined) this.player1 = this.rightChild.player2;
    else this.player2 = this.rightChild.player2;
  }
  if (this.leftChild !== undefined) this.leftChild.sanitise();
  if (this.rightChild !== undefined) this.rightChild.sanitise();
};

MatchSchema.methods.findNextGame = function () {
  let next;
  let nextDepth = -1;

  function recurseOnMatch (match, depth = 0) {
    if (match.player1 && match.player2 && match.score === null && depth > nextDepth) {
      nextDepth = depth;
      next = match;
    }
    if (!match.player1 && match.leftChild) recurseOnMatch(match.leftChild, depth + 1 );
    if (!match.player2 && match.rightChild) recurseOnMatch(match.rightChild, depth + 1);
  }
  recurseOnMatch(this);
  return next;
};

MatchSchema.methods.render = function (prefix = '', indentation = 0) {
  //eslint-disable-next-line
  if (indentation===0) console.log();
  const indentationString = `${'\t'.repeat(indentation)}`;
  const scoreString = this.score !== null
    ? `${this.score.player1} - ${this.score.player2}`
    : '';

  const player1 = this.player1 ? this.player1.telegram_id : 'Not set';
  const player2 = this.player2 ? this.player2.telegram_id : 'Not set';
  console.log(`${prefix}${player1} vs ${player2} \t ${scoreString}`);

  if (this.leftChild) {
    console.log(`${indentationString}┃`);
    this.leftChild.render(`${indentationString}┣   `, indentation+1);
  }
  if (this.rightChild) {
    console.log(`${indentationString}┃`);
    this.rightChild.render(`${indentationString}┣   `, indentation+1);
  }
};

MatchSchema.methods.placeInNextGame = async function (winner) {
  if (
    !this.player1 && this.leftChild && this.leftChild.winner
    && this.leftChild.winner.telegram_id === winner.telegram_id
  ) {
    this.player1 = winner;
    await this.save();
  } else if (
    !this.player2 && this.rightChild && this.rightChild.winner
    && this.rightChild.winner.telegram_id === winner.telegram_id
  ) {
    this.player2 = winner;
    await this.save();
  } else {
    if (this.leftChild) await this.leftChild.placeInNextGame(winner);
    if (this.rightChild) await this.rightChild.placeInNextGame(winner);
  }
};

const autoPopulate = function (next) {
  this
    .populate('player1')
    .populate('player2')
    .populate('leftChild')
    .populate('rightChild')
    .populate('winner')
    .populate('loser');
  next();
};

MatchSchema
  .pre('findOne', autoPopulate)
  .pre('find', autoPopulate);

const Match = mongoose.model('match', MatchSchema);

Match.findPlayersAllGamesInTournament = async function (playerId, tournamentId) {
  let allMatches = await Match.find({tournamentId});
  return allMatches = allMatches
    .filter(match => match.loser !== null)
    .filter(match => match.player1.telegram_id === playerId || match.player2.telegram_id === playerId);
};

module.exports = Match;
