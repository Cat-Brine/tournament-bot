'use strict';

class Tournament {

  constructor (chatId, chatAdmin) {
    this.chatId = chatId;
    this.chatAdmin = chatAdmin;
    this.players = {};
    this.playingPlayers = {};
    this.registering = true;
    this.playing = false;
    this.rounds = [];
    this.wildcards = [];
    this.nextGame = [0,0];
    this.finals = {};
    this.round;
  };

  createTournament () {
    const numberOfPlayers = Object.keys(this.players).length;
    const numberOfRounds = Math.log2(numberOfPlayers);
    const startingNumber = findNextPowerOfTwo(numberOfPlayers);
    const playersArr = [];
    const firstRound = [];

    this.finals = {
      quarterFinals: numberOfRounds - 3,
      semiFinals: numberOfRounds - 2,
      final: numberOfRounds - 1
    };

    this.round = this.chooseRound();

    for (let player in this.players) {
      if (this.players.hasOwnProperty(player)) {
        playersArr.push(this.players[player]);
        this.playingPlayers[player] = this.players[player];
      };
    };

    while (playersArr.length < startingNumber) playersArr.push(0);

    shuffle(playersArr);

    for (let i = 0; i < playersArr.length; i += 2) {
      firstRound.push({player1: playersArr[i], player2: playersArr[i+1]});
    };

    firstRound.forEach(pairing => {
      if (pairing.player1 === 0 && pairing.player2 !== 0) {
        this.wildcards.push(pairing.player2);
      } else if (pairing.player2 === 0 && pairing.player1 !== 0) {
        this.wildcards.push(pairing.player1);
      };
    });

    this.rounds.push(firstRound);
  };

  addPlayer (username) {
    this.players[username] = {
      name: username,
      played: [],
      goals: 0
    }
  }

  findNextOpponent (username) {
    const rounds = this.rounds;
    for (let i = this.nextGame[0]; i < rounds.length; i++) {
      for(let j = this.nextGame[1]; j < rounds[i].length; j++) {
        if (rounds[i][j].player1.name === username) return rounds[i][j].player2;
        else if (rounds[i][j].player2.name === username) return rounds[i][j].player1;
      };
    };
  };

  findNextGame () {
    return this.rounds[this.nextGame[0]][this.nextGame[1]];
  };

  gamePlayed (result) {
    result = formatResult(result);

    const rounds = this.rounds;
    const game = rounds[this.nextGame[0]][this.nextGame[1]];
    const winner = result[0] > result[1] ? game.player1 : game.player2;
    const loser = result[0] < result[1] ? game.player1 : game.player2;

    game.result = result;
    game.winner = winner;
    game.loser = loser;
    delete this.playingPlayers[loser];
    this.players[winner.name].played.push(game)
    this.players[winner.name].goals+= Math.max.apply(null, result)
    this.players[loser.name].played.push(game)
    this.players[loser.name].goals+= Math.min.apply(null, result)

    this.nextGame[0] = this.nextGame[1] < rounds[this.nextGame[0]].length
      ? this.nextGame[0]
      : this.nextGame[0]++;
    this.nextGame[1] = this.nextGame[1] < rounds[this.nextGame[0]].length
      ? this.nextGame[1]++
      : 0;

    for (let i = this.nextGame[0]; i < rounds.length; i++) {
      for(let j = this.nextGame[1]; j < rounds[i].length; j++) {
        if (rounds[i][j].player1 === undefined) {
          return rounds[i][j].player1 = winner;
        } else if (rounds[i][j].player2 === undefined) {
          return rounds[i][j].player2 = winner;
        }
      };
    };
    if (this.round === 'Final') this.round = 'finished';
    else this.round = this.chooseRound();

  };

  chooseRound () {
    switch (this.nextGame[0]) {
      case this.finals.quarterFinals:
        return 'Quarter-finals';
      case this.finals.semiFinals:
        return 'Semi-finals';
      case this.finals.final:
        return 'Final';
      default:
        return 'Preliminary Round';
    };
  };

  getStats (username) {
    const player = this.players[username];
    console.log(player);
    const avgScore = player.goals / player.played.length

    let highest = 0;
    let lowest = 0;
    player.played.forEach(game => {
      const max = Math.max.apply(null, game.result);
      const min = Math.min.apply(null, game.result);
      if (game.winner === username ) {
        if (max > highest) highest = max;
        if (max < lowest) lowest = max
      }
      else if (min > highest) highest = min;
      else if (min < lowest) lowest = min;
    });

    const ranking = this.getRanking();
    let playersRank;
    for (let i = 0; i < ranking.length; i++) {
      if (ranking[i].name === username) playersRank = i + 1;
    }
  }

  getRanking () {
    const players = this.players;
    const ranking = [];
    for (let player in players) {
      if (players.hasOwnProperty(player)) {
        ranking.push({
          name: player,
          goals : players[player].goals
        });
      }
    };
    return ranking.sort((a, b) => b.goals - a.goals)
  };
};

const findNextPowerOfTwo = num => {
  return Math.pow(2, Math.ceil(Math.log2(num)));
};

const shuffle = (a) => {
  for (let i = a.length; i; i--) {
    const j = Math.floor(Math.random() * i);
    [a[i - 1], a[j]] = [a[j], a[i - 1]];
  };
};

const formatResult = (res) => res.replace(/\s/g, '').split('-');


module.exports = Tournament;
