const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('../db.js');

const playerSchema = new mongoose.Schema({
  telegram_id: Number,
  first_name: String,
  tournament_id: Object,
});

const Player = mongoose.model('player', playerSchema);

Player.createPlayer = async playerInfo => {
  const newPlayer = new Player({
    telegram_id: playerInfo.playerId,
    first_name: playerInfo.name
  });
  return newPlayer.save();
};

Player.findOrCreate = async playerInfo => {
  const player = Player.findOne({telegram_id: playerId});
  if (!player) {
    return Player.createPlayer(playerInfo);
  }
  return player;
};

module.exports = Player;
