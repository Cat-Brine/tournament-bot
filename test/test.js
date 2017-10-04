'use strict';

const mocha = require('mocha');
const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
const TournamentBot = require('../controllers');
const mocks = require('./mocks');
const Tournament = require('../models/tournament.model');

const bot = new TournamentBot();

const createMessage = (user, chatId) => {
  return {
    message_id: user.msg_id,
    from: { id: user.id, first_name: user.first_name, username: user.username },
    chat: {
      id: chatId,
      title: 'BOT',
      type: 'group',
      all_members_are_administrators: true
    },
    date: 1489160360,
    text: '/start',
    entities: [ { type: 'bot_command', offset: 0, length: 6 } ]
  };
};

mocks.forEach(chat => {
  chat.users.forEach((user, index, arr) => {
    arr[index] = createMessage(user, chat.chatId);
  });
});

describe('Tournament Bot', function ()  {
  let getChatAdministrators;
  let sendMessage;
  const chatAdmins = mocks.map(chat => chat.users[0]);

  beforeEach(function () {
    getChatAdministrators = sinon.stub(bot.telegram, 'getChatAdministrators');
    sendMessage = sinon.stub(bot.telegram, 'sendMessage');
  });

  afterEach(function () {
    getChatAdministrators.restore();
    sendMessage.restore();
  });

  describe('start', function () {
    const chatAdmins = mocks.map(chat => {
      return chat.users[0];
    });
    const res = chatAdmins.map(admin => {
      return [{
        user: {
          id: admin.from.id,
          first_name: admin.from.first_name,
          username: admin.from.username,
        },
        status: 'creator'
      }];
    });

    it ('should add 1 tournament to chatsOpen', function (done) {
      getChatAdministrators.returns(new Promise((resolve, reject) => resolve(res[0])));
      bot.start(chatAdmins[0]).then(() => {
        bot.chatsOpen.should.have.property(mocks[0].chatId);
        done();
      });
    });
    it('should add multiple tournaments to chatsOpen', function (done) {
      getChatAdministrators.returns(new Promise((resolve, reject) => resolve(res[1])));
      bot.start(chatAdmins[1]).then(() => {
        bot.chatsOpen.should.have.property(mocks[1].chatId);
        done();
      });
    });
  });

  describe('register', function () {
    it('should add a player to the tournament', async function () {
      let tournament;
      for (let i=0; i < mocks.length; i++) {
        const chat = mocks[i];
        tournament = bot.chatsOpen[chat.chatId];
        for (let j=0; j < chat.users.length; j++ ) {
          const msg = chat.users[j];
          let userId = msg.from.id;
          await bot.register(msg);
          tournament.getPlayer(userId).should.not.be.null;
        }
      }
      tournament.isNew.should.be.true;

    });
  });

  describe('go', function () {
    it('should start a tournament with 4 players or more', async () => {
      await Promise.all(chatAdmins.map(async (admin) => {
        const chatId = admin.chat.id;
        const tournament = bot.chatsOpen[chatId];
        await bot.go(admin);
        const playingPlayers = tournament.playingPlayers.length;
        const players = tournament.players.length;
        tournament.playing.should.be.true;
        playingPlayers.should.eql(players);
      }));
    });
  });

  describe('play a game and input results', function () {

    const chatAdmins = mocks.map(chat => chat.users[0]);
    const correctMatch = [ '/result 1-2', '1-2', 'index: 0', 'input: /result 1-2' ];
    it('should update the current game with the scores and winner', function () {
      const expectedResult = correctMatch[1];
      const exResultArr = expectedResult.split('-').map(el => +el);
      const winningScore = Math.max.apply(null, exResultArr);
      const losingScore = Math.min.apply(null, exResultArr);
      const msgFromAdmin = chatAdmins[0];
      const chatId = msgFromAdmin.chat.id;
      const tournament = bot.chatsOpen[chatId];
      const currGame = tournament.root.findNextGame();
      const expectedWinner = exResultArr[0] > exResultArr[1] ? currGame.player1 : currGame.player2;
      const expectedLoser = exResultArr[0] < exResultArr[1] ? currGame.player1 : currGame.player2;

      let player1 = tournament.players.filter(player => {
        if (player.first_name === currGame.player1.first_name) return player;
      });
      player1 = player1[0];
      let player2 = tournament.players.filter(player => {
        if (player.first_name === currGame.player2.first_name) return player;
      });
      player2 = player2[0];

      const prev_player1_goals = player1.goals;
      const prev_player2_goals = player2.goals;
      bot.go(msgFromAdmin);
      bot.result(msgFromAdmin, correctMatch);
      should.equal(currGame.result, undefined);
      bot.game(msgFromAdmin);
      bot.result(msgFromAdmin, correctMatch);

      const actualResult = `${currGame.score.player1}-${currGame.score.player2}`;
      const actualWinner = currGame.winner;
      const actualLoser = currGame.loser;

      const new_player1_goals = expectedWinner === currGame.player1 ?
        winningScore + prev_player1_goals :
        losingScore + prev_player1_goals;
      player1.goals = new_player1_goals;
      const new_player2_goals = expectedWinner === currGame.player2 ?
        winningScore + prev_player2_goals :
        losingScore + prev_player2_goals;
      player2.goals = new_player2_goals;

      should.not.equal(currGame.score, undefined);
      actualResult.should.be.eql(expectedResult);
      actualWinner.should.be.eql(expectedWinner);
      actualLoser.should.be.eql(expectedLoser);
      player1.goals.should.be.eql(new_player1_goals);
      player2.goals.should.be.eql(new_player2_goals);
    });

    it('should only accept numbers as valid results', function () {
      const incorrectMatch = [ '/result hello-world', 'hello-world', 'index: 0', 'input: /result hello-world' ];
      const expectedResult = incorrectMatch[1];
      const msgFromAdmin = chatAdmins[1];
      const username = msgFromAdmin.from.username;
      const chatId = msgFromAdmin.chat.id;
      const tournament = bot.chatsOpen[chatId];
      const currGame = tournament.root.findNextGame();

      bot.go(msgFromAdmin);
      bot.game(msgFromAdmin);
      bot.result(msgFromAdmin, incorrectMatch);

      should.equal(currGame.result, undefined);

    });

    it('should add the winner of the previous match to the next game', async function () {
      const msgFromAdmin = chatAdmins[1];
      const chatId = msgFromAdmin.chat.id;
      const tournament = bot.chatsOpen[chatId];

      const currGame = tournament.root.findNextGame();

      currGame.player1.telegram_id.should.eql(23121935);
      currGame.player2.telegram_id.should.eql(23121936);

      await bot.go(msgFromAdmin);
      bot.game(msgFromAdmin);
      await bot.result(msgFromAdmin, correctMatch);

      let nextGame = tournament.root.findNextGame();

      should.not.equal(nextGame, undefined);
      should.not.equal(nextGame.player1, undefined);
      should.not.equal(nextGame.player2, undefined);

      nextGame.player1.telegram_id.should.eql(23121931);
      nextGame.player2.telegram_id.should.eql(23121932);

      bot.game(msgFromAdmin);
      await bot.result(msgFromAdmin, correctMatch);

      nextGame = tournament.root.findNextGame();

      should.not.equal(nextGame, undefined);
      should.not.equal(nextGame.player1, undefined);
      should.not.equal(nextGame.player2, undefined);

      nextGame.player1.telegram_id.should.eql(23121933);
      nextGame.player2.telegram_id.should.eql(23121936);

      await bot.game(msgFromAdmin);
      await bot.result(msgFromAdmin, correctMatch);

      nextGame = tournament.root.findNextGame();

      should.not.equal(nextGame, undefined);
      should.not.equal(nextGame.player1, undefined);
      should.not.equal(nextGame.player2, undefined);

      nextGame.player1.telegram_id.should.eql(23121932);
      nextGame.player2.telegram_id.should.eql(23121936);

      await bot.game(msgFromAdmin);
      await bot.result(msgFromAdmin, correctMatch);

      nextGame.winner.telegram_id.should.equal(23121936);
    });

  });

  describe('user statistics' , function () {

    it('should send user statistics for each user', async function () {
      let tournament;
      await Promise.all(mocks.map(async (chat) => {
        tournament = bot.chatsOpen[chat.chatId];
        await Promise.all(chat.users.map(async msg => {
          bot.stats(msg);
          const stats = await tournament.getStats(msg.from.id);
          stats.should.have.property('highest');
          stats.highest.should.be.at.least(0);
          stats.should.have.property('lowest');
          stats.lowest.should.be.at.least(0);
          // stats.should.have.property('playersRank');
          // stats.playersRank.should.to.be.within(0, Object.keys(tournament.players).length + 1);
          stats.should.have.property('avgScore');
          stats.avgScore.should.be.at.least(0);
        }));
      }));
    });
  });

  describe('deleteTournament', function () {
    const msgFromAdmin = chatAdmins[0];
    const chatId = msgFromAdmin.chat.id;

    it('should not delete a tournament if the user selects no', function () {
      const tournament = bot.chatsOpen[chatId];

      bot.deleteTournament(msgFromAdmin);
      should.not.equal(bot.chatsOpen[chatId], undefined);
      bot.cancelDeletion(msgFromAdmin);
      should.not.equal(bot.chatsOpen[chatId], undefined);
    });

    it('should successfully delete a tournament if the user selectects yes', async function () {
      const tournament = bot.chatsOpen[chatId];
      bot.deleteTournament(msgFromAdmin);
      should.not.equal(bot.chatsOpen[chatId], undefined);
      await bot.confirmDeletion(msgFromAdmin);
      should.equal(bot.chatsOpen[chatId], undefined);
    });
  });

});
