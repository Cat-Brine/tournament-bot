'use strict';

const createPNG = require('./d3');
const Match = require('./match');

class Tournament {

  constructor (chatId, chatAdmin) {
    this.chatId = chatId;
    this.chatAdmin = chatAdmin;
    this.players = {};
    this.playingPlayers = [];
    this.registering = true;
    this.playing = false;
    this.root;
    this.finals = {};
    this.round;
  };

  createTournament (callback) {
    const numberOfPlayers = Object.keys(this.players).length;
    const numberOfZeros = findNextPowerOfTwo(numberOfPlayers) - numberOfPlayers;
    const playersArr = Object.keys(this.players);
    const matches = [];
    this.playingPlayers = Object.keys(this.players);

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
    createPNG(this.root, this.players, (data) => {
      callback(data)
    });
  }

  addPlayer (name, id) {
    this.players[id] = {
      name,
      id,
      played: [],
      goals: 0
    };
  }

  gamePlayed (result, nextGame, callback) {
    const game = nextGame;
    game.result = formatResult(result);
    game.winner = game.result[0] > game.result[1] ? game.player1 : game.player2;
    game.loser = game.result[0] < game.result[1] ? game.player1 : game.player2;

    const playerIndex = this.playingPlayers.indexOf(game.loser);
    this.playingPlayers.splice(playerIndex, 1);

    this.players[game.winner].played.push(game);
    this.players[game.loser].played.push(game);
    this.players[game.winner].goals += Math.max.apply(null, game.result);
    this.players[game.loser].goals += Math.min.apply(null, game.result);

    this.placeInNextGame(game.winner);
    game.playing = false;
    createPNG(this.root, this.players, (data) => {
      callback(data)
    });
  };

  placeInNextGame (winner) {
    function recurseOnMatch (match) {
      if (match.leftChild && match.leftChild.winner === winner && match.leftChild.playing) {
        if (match.player1 && !match.player2) match.player2 = winner;
        else match.player1 = winner;
      } else if (match.rightChild && match.rightChild.winner === winner && match.rightChild.playing) {
        if (match.player1 && !match.player2) match.player2 = winner;
        else match.player1 = winner;
      } else {
        if(match.leftChild) recurseOnMatch(match.leftChild);
        if(match.rightChild) recurseOnMatch(match.rightChild);
      }
    }
    recurseOnMatch(this.root);
  };

  getStats (id) {
    const player = this.players[id];
    const avgScore = Math.round(player.goals / player.played.length || 0);
    let highest = 0;
    let lowest = 0;
    player.played.forEach(game => {
      const max = Math.max.apply(null, game.result);
      const min = Math.min.apply(null, game.result);
      if (game.winner === id ) {
        if (max > highest) highest = max;
        if (max < lowest) lowest = max;
      }
      else if (min > highest) highest = min;
      else if (min < lowest) lowest = min;
    });

    const ranking = this.getRanking();

    let playersRank;
    for (let i = 0; i < ranking.length; i++) {
      if (ranking[i].name === player.name) playersRank = i + 1;
    };
    return({
      highest,
      lowest,
      avgScore,
      playersRank,
    });
  };

  getRanking () {
    const players = this.players;
    const ranking = [];
    for (let id in players) {
      if (players.hasOwnProperty(id)) {
        ranking.push({
          name: players[id].name,
          goals : players[id].goals
        });
      }
    };
    return ranking.sort((a, b) => b.goals - a.goals)
  };
};

const findNextPowerOfTwo = num => {
  return Math.pow(2, Math.ceil(Math.log2(num)));
};

const formatResult = (res) => res.replace(/\s/g, '').split('-').map(el => +el);

module.exports = Tournament;
