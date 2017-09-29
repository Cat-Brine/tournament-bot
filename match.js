class Match {

  constructor () {
    this.player1 = undefined;
    this.player2 = undefined;
    this.leftChild = undefined;
    this.rightChild = undefined;
  }

  sanitise () {
    if (this.leftChild && this.leftChild.player1 === 0) {
      if (this.player1 === undefined) this.player1 = this.leftChild.player2;
      else this.player2 = this.leftChild.player2;
    }
    if (this.rightChild && this.rightChild.player1 === 0) {
      if (this.player1 === undefined) this.player1 = this.rightChild.player2;
      else this.player2 = this.rightChild.player2;
    }
    if (this.leftChild !== undefined) this.leftChild.sanitise();
    if (this.rightChild !== undefined) this.rightChild.sanitise();
  }

  findNextGame () {
    let next;
    let nextDepth = -1;
    function recurseOnMatch (match, depth = 0) {
      if (match.player1 && match.player2 && depth > nextDepth) {
        nextDepth = depth;
        next = match;
      }
      if (!match.player1 && match.leftChild) recurseOnMatch(match.leftChild, depth + 1 );
      if (!match.player2 && match.rightChild) recurseOnMatch(match.rightChild, depth + 1);
    }
    recurseOnMatch(this);
    return next;
  };

};

module.exports = Match;
