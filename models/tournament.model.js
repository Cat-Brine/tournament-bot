const mongoose = require('../db.js');
const _ = require('underscore');
const TelegramBot = require('node-telegram-bot-api');
const Player = require('./player.model');
const Match = require('./match.model');

const findNextPowerOfTwo = num => Math.pow(2, Math.ceil(Math.log2(num)));

const TournamentSchema = new mongoose.Schema({
  admin: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
  chatId: Number,
  start_date: Date,
  end_date: Date,
  playing: Boolean,
  players: [{type: mongoose.Schema.Types.ObjectId, ref: 'player', default: []}],
  playingPlayers: [{type: mongoose.Schema.Types.ObjectId, ref: 'player', default: []}],
  matches: Array,
  root: {type: mongoose.Schema.Types.ObjectId, ref: 'match', default: null},
});

TournamentSchema.methods.createMatches = async function () {
  const playersArr = this.players;
  const numberOfPlayers = playersArr.length;
  const numberOfZeros = findNextPowerOfTwo(numberOfPlayers) - numberOfPlayers;
  const tournament = this;
  const tournamentId = this._id;
  const matches = [];
  const score = null;
  this.playingPlayers = this.players;

  const playersTempArr = playersArr.concat();
  for (let i = 0; i < numberOfZeros; i++) playersTempArr.splice(i*2, 0, null);

  for (let i = 0; i < playersTempArr.length; i+=2) {
    const player1 = playersTempArr[i];
    const player2 = playersTempArr[i+1];
    const playing = false;
    const winner = null;
    const loser = null;
    const match = new Match({tournamentId, player1, player2, score, playing, winner, loser});
    await match.save();
    matches.push(match);
    this.matches.push(match._id);
  }

  let remainingMatches = matches.length;

  while (remainingMatches > 1) {
    remainingMatches /= 2;
    for (let i = 0; i < remainingMatches; i++) {
      const leftChild = matches.shift();
      const rightChild = matches.shift();
      const playing = false;
      const winner = null;
      const loser = null;
      const match = new Match({tournamentId, leftChild, rightChild, score, playing, winner, loser});
      await match.save();
      matches.push(match);
      this.matches.push(match._id);
    }
  }
  this.root = matches.shift();
  this.root.sanitise();
  return this;
};

TournamentSchema.methods.getPlayer = function (userId) {
  return this.players.find(player => player.telegram_id === userId);
};

TournamentSchema.methods.addPlayer = function (player) {
  this.players.push(player);
};

TournamentSchema.methods.getStats = async function (id) {
  const player = this.players.reduce((accum, player) => {
    if (player.telegram_id === id) accum = player;
    return accum;
  }, {});
  const tournamentId = this._id;
  const playerId = id;
  const matchesPlayed = await Match.findPlayersAllGamesInTournament(playerId, tournamentId);
  const goalsPerMatch = [];
  const totalGoals = matchesPlayed.reduce((accum, match) => {
    const playerNum = match.player1.telegram_id === playerId ? 'player1' : 'player2';
    goalsPerMatch.push(parseInt(match.score[playerNum]));
    accum += parseInt(match.score[playerNum]);
    return accum;
  }, 0);
  const avgScore = Math.round(totalGoals / matchesPlayed.length || 0);
  const highest = goalsPerMatch.length > 0 ? Math.max.apply(null, goalsPerMatch) : 0;
  const lowest = Math.min.apply(null, goalsPerMatch);
  return ({
    highest,
    lowest,
    avgScore,
  });
};

const autoPopulate = function (next) {
  this
    .populate('admin')
    .populate('playingPlayers')
    .populate('root')
    .populate('players');
  next();
};

TournamentSchema
  .pre('findOne', autoPopulate)
  .pre('find', autoPopulate);

const Tournament = mongoose.model('tournament', TournamentSchema);

Tournament.createTournament = async tournament => {
  const { players } = tournament;
  const tournamentPlayers = await Promise.all(players.map(player => {
    return Player.findOrCreate(player);
  }));
  tournament.start_date = new Date();
  const tournamentWithMatches = await tournament.createMatches();
  return await tournamentWithMatches.save();
};

Tournament.deleteTournament = async id => {
  try {
    await Tournament.remove({_id: id});
  } catch (e) {
    console.log(e);
  }
};

module.exports = Tournament;
