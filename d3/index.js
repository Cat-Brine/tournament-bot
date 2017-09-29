'use strict';

const printPNG = require('./png.js');
const createPNG = (root, players, callback) => {
  root = Object.assign({}, root);
  const arrayify = (node) => {
    const player1 = node.player1 ? players[node.player1].name : '';
    const player2 = node.player2 ? players[node.player2].name : '';
    node.name = `${player1} - ${player2}`;
    node.winners = [];
    if (node.leftChild) {
      node.winners.push(node.leftChild);
      arrayify(node.leftChild);
    } if (node.rightChild) {
      node.winners.push(node.rightChild);
      arrayify(node.rightChild);
    }
  };

  arrayify(root);

  printPNG(root, (data) => {
    callback(data);
  });
};

module.exports = createPNG;
