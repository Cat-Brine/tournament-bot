const mongoose = require('../db.js');
const _ = require('underscore');

const TelegramBot = require('node-telegram-bot-api');
const Player = require('./player.model');

const findNextPowerOfTwo = num => Math.pow(2, Math.ceil(Math.log2(num)));

const TournamentSchema = new mongoose.Schema({
  admin: {type: mongoose.Schema.Types.ObjectId, ref: 'player'},
  chatId: Number,
  start_date: Date,
  end_date: Date,
  games: Array,
  playing: Boolean,
  players: [{type: mongoose.Schema.Types.ObjectId, ref: 'player', default: [] }],
  playingPlayers: [{type: mongoose.Schema.Types.ObjectId, ref: 'player', default: [] }],
  root: { type: mongoose.Schema.Types.ObjectId, ref: 'match' },
});

TournamentSchema.methods.createMatches = function () {
  const playersArr = Object.keys(this.players);
  const numberOfPlayers = playersArr.length;
  const numberOfZeros = findNextPowerOfTwo(numberOfPlayers) - numberOfPlayers;
  const matches = [];
  this.playingPlayers = this.players;

  for (let i = 0; i < numberOfZeros; i++) {
    playersArr.splice(i*2, 0, 0);
  }

  for (let i = 0; i < playersArr.length; i+=2) {
    const match = new Match();
    match.player1 = playersArr[i];
    match.player2 = playersArr[i+1];
    matches.push(match);
  }

  let remainingMatches = matches.length;

  while (remainingMatches > 1) {
    remainingMatches /= 2;
    for (let i = 0; i < remainingMatches; i++) {
      const match = new Match();
      match.leftChild = matches.shift();
      match.rightChild = matches.shift();
      matches.push(match);
    }
  }

  this.root = matches.shift();
  this.root.sanitise();
};

TournamentSchema.methods.getPlayer = function (userId) {
  return this.players.find(player => player.telegram_id === userId);
};

TournamentSchema.methods.addPlayer = function (player) {
  this.players.push(player);
};

const Tournament = mongoose.model('tournament', TournamentSchema);

Tournament.createTournament = async tournamentInfo => {
  const {chatAdmin, players , date, chatId} = tournamentInfo;
  const playersArr = _.reduce(players, (accum, val, key, collection) => {
    accum.push({playerId: key, name:val.name});
    return accum;
  }, []);
  const admin = await Player.findOne({telegram_id: chatAdmin.id});

  const tournamentPlayers = await Promise.all(playersArr.map(player => Player.findOrCreate(item)));

  const newTournament = new Tournament({
    admin: admin,
    chatId,
    start_date: date,
    end_date: null,
    games: [],
    playing: false,
    players: tournamentPlayers,
  });
  newTournament.createMatches();
  await newTournament.save();
  return newTournament;
};

// Tournament.search = async function search (chatId) {
//   return await Tournament.find({chatId}).sort({date}).limit(1);
// };

module.exports = Tournament;
