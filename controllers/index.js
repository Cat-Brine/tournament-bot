'use strict';

const nconf = require('nconf');
const TelegramBot = require('node-telegram-bot-api');

nconf.argv().env().file({ file: './env.json' });
const messages = require('../messages');

const token = nconf.get('TELEGRAM_TOKEN');
const telegram = new TelegramBot(token, {polling: true});

const Tournament = require('../models/tournament.model');
const Player = require('../models/player.model');
const Match = require('../models/match.model');

class TournamentBot {

  constructor () {
    this.chatsOpen = {};
    this.telegram = telegram;
    this.Tournament = Tournament;
  }

  async start (msg) {
    const chatId = msg.chat.id;
    const response = messages.start;
    if (msg.chat.type === 'group') {
      this.telegram.getChatAdministrators(chatId)
        .then((data) => {
          if (msg.from.id === data[0].user.id) {
            if (this.chatsOpen[chatId] === undefined) {
              const admin = new Player({
                telegram_id: data[0].user.id,
                first_name: data[0].user.first_name,
              });
              const playing = false;
              const start_date = new Date();
              const end_date = new Date();
              end_date.setDate(end_date.getDate() + 10);
              this.chatsOpen[chatId] = new this.Tournament({chatId, admin, playing, start_date, end_date});
              this.telegram.sendMessage(chatId, response, {parse_mode: 'Markdown'});
            } else if (this.chatsOpen[chatId].playing === true) {
              this.telegram.sendMessage(chatId, messages.alreadyPlaying);
            } else this.telegram.sendMessage(chatId, messages.alreadyPlaying);
          } else this.telegram.sendMessage(chatId, messages.notAdmin(chatAdmin.name));
        })
        .catch(err => console.log(err));
    }
  }

  async register (msg) {
    const chatId = msg.chat.id;
    const name = msg.from.first_name;
    const userId = msg.from.id;
    const player = new Player({
      telegram_id: userId,
      first_name: name,
    });
    await player.save();
    const tournament = this.chatsOpen[chatId];
    if (tournament && tournament.isNew) {
      if (!tournament.getPlayer(player.telegram_id)) {
        tournament.addPlayer(player);
        const playerCount = tournament.players.length;
        this.telegram.sendMessage(chatId, messages.userRegistered(name, playerCount));
      } else this.telegram.sendMessage(chatId, messages.alreadyRegistered);
    } else this.telegram.sendMessage(chatId, messages.registrationClosed);
  }

  go (msg) {
    const chatId = msg.chat.id;
    const tournament = this.chatsOpen[chatId];
    const user = msg.from;
    const username = msg.from.first_name;
    const admin = tournament.admin;
    if (tournament) {
      if (tournament.admin.telegram_id === user.id) {
        if (!tournament.playing) {
          const playerCount = tournament.players.length;
          if (playerCount >= 4) {
            tournament.playing = true;
            // oldTournament.createTournament((png) => {
            //   this.telegram.sendPhoto(chatId, png);
            // });
            Tournament.createTournament(tournament);
            this.telegram.sendMessage(chatId, messages.newTournament(playerCount));
          } else this.telegram.sendMessage(chatId, messages.notEnoughPlayers(playerCount));
        } else this.telegram.sendMessage(chatId, messages.alreadyPlaying);
      } else this.telegram.sendMessage(chatId, messages.notAdmin(chatAdmin.name));
    } else this.telegram.sendMessage(chatId, messages.notPlaying);
  }

  game (msg) {
    // Try/catch
    const chatId = msg.chat.id;
    const user = msg.from;
    const username = user.first_name;
    const tournament = this.chatsOpen[chatId];
    const chatAdmin = tournament.chatAdmin;
    if (tournament && tournament.playing) {
      if (user.id === chatAdmin.id) {
        const nextGame = tournament.root.findNextGame();
        nextGame.playing = true;
        const player1 = tournament.players[nextGame.player1].name;
        const player2 = tournament.players[nextGame.player2].name;
        const tournamentId = Tournament.search(chatId);
        // const tournamentId = Tournament.schema.statics.search(chatId);
        // Match.createMatch({player1, player2, tournament});
        this.telegram.sendMessage(chatId, `${messages.game(player1, player2)}`);
      } else this.telegram.sendMessage(chatId, messages.notAdmin(chatAdmin.name));
    } else this.telegram.sendMessage(chatId, messages.notPlaying);
  }

  result (msg, match) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const tournament = this.chatsOpen[chatId];
    const chatAdmin = tournament.chatAdmin;
    const nextGame = tournament.root.findNextGame();
    if (user.id === chatAdmin.id) {
      if (tournament.playing) {
        const result = match[1];
        const isValidResult = /\s*\d+\s*-\s*\d+\s*/.test(result);
        if (nextGame.playing) {
          if (isValidResult) {
            tournament.gamePlayed(result, nextGame, (png) => {
              this.telegram.sendPhoto(chatId, png);
            });
            const winner = tournament.players[nextGame.winner].name;
            if (tournament.root === nextGame) {
              this.telegram.sendMessage(chatId, messages.overallWinner(winner));
              tournament.playing = false;
            } else this.telegram.sendMessage(chatId, messages.gameWinner(winner));
          } else this.telegram.sendMessage(chatId, messages.resultFormat);
        } else this.telegram.sendMessage(chatId, messages.gameNotStarted);
      } else this.telegram.sendMessage(chatId, messages.notPlaying);
    } else this.telegram.sendMessage(chatId, messages.notAdmin(chatAdmin.name));
  }

  deleteTournament (msg) {
    const chatId = msg.chat.id;
    const tournament = this.chatsOpen[chatId];
    const chatAdmin = tournament.chatAdmin;
    const user = msg.from;
    const opts = {
      reply_markup: JSON.stringify({
        keyboard: [['YES', 'NO']],
        one_time_keyboard: true,
        resize_keyboard: true,
        selective: true
      }),
      reply_to_message_id: msg.message_id,
    };

    if (tournament) {
      if (chatAdmin.id === user.id) {
        this.telegram.sendMessage(chatId, 'Are you sure?', opts);
      } else this.telegram.sendMessage(chatId, messages.notAdmin(chatAdmin.name));
    } else this.telegram.sendMessage(chatId, messages.notPlaying);
  }

  confirmDeletion (msg) {
    const chatId = msg.chat.id;
    const hideKeyboard = {reply_markup: JSON.stringify({hide_keyboard: true})};

    delete this.chatsOpen[chatId];
    this.telegram.sendMessage(chatId, 'Current tournament deleted.', hideKeyboard);
  }

  cancelDeletion (msg) {
    const chatId = msg.chat.id;
    const hideKeyboard = {reply_markup: JSON.stringify({hide_keyboard: true})};
    this.telegram.sendMessage(chatId, 'The tournament has not been deleted.', hideKeyboard);
  }

  help (msg) {
    const chatId = msg.chat.id;
    const resp = messages.help;

    this.telegram.sendMessage(chatId, resp, {parse_mode: 'Markdown'});
  }

  next (msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const username = user.first_name;
    const tournament = this.chatsOpen[chatId];
    if (tournament && tournament.playing) {
      if (tournament.players[user.id]) {
        if (tournament.playingPlayers[user.id]) {
          const opponent = tournament.findNextOpponent(username);
          if (opponent) {
            this.telegram.sendMessage(chatId, messages.opponent(username, opponent));
          } else this.telegram.sendMessage(chatId, messages.undecidedOpponent);
        } else this.telegram.sendMessage(chatId, messages.knockedOut);
      } else this.telegram.sendMessage(chatId, messages.userNotPlaying);
    } else this.telegram.sendMessage(chatId, messages.notPlaying);
  }

  stats (msg) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const tournament = this.chatsOpen[chatId];
    if (tournament) {
      if (tournament.players[user.id]) {
        const name = tournament.players[user.id].name;
        const stats = tournament.getStats(user.id);
        this.telegram.sendMessage(chatId, messages.stats(name, stats), {parse_mode: 'Markdown', reply_to_message_id: msg.msg_id});
      } else this.telegram.sendMessage(chatId, messages.userNotPlaying);
    } else this.telegram.sendMessage(chatId, messages.notPlaying);
  }
}

module.exports = TournamentBot;
