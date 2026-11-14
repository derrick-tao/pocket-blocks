export const SHAPES = {
  I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  J: [[1,0,0],[1,1,1],[0,0,0]], L: [[0,0,1],[1,1,1],[0,0,0]],
  O: [[1,1],[1,1]], S: [[0,1,1],[1,1,0],[0,0,0]],
  T: [[0,1,0],[1,1,1],[0,0,0]], Z: [[1,1,0],[0,1,1],[0,0,0]]
};
export class Game {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
    this.state = 'ready';
  }
  pick() { return Object.keys(SHAPES)[Math.floor(this.random() * 7)]; }
  reset() {
    this.board = Array.from({length:20}, () => Array(10).fill(null));
    this.score = 0; this.lines = 0; this.level = 1; this.elapsed = 0;
    this.lastClear = 0; this.lastClearEvent = null; this.locks = 0; this.state = 'playing';
    this.next = this.pick(); this.spawn();
  }
  spawn() {
    const type = this.next;
    this.next = this.pick();
    this.piece = {type, cells: SHAPES[type].map(row => [...row]), x: Math.floor((10-SHAPES[type].length)/2), y: type === 'I' ? -1 : 0};
    this.elapsed = 0;
    if (!this.fits(this.piece)) this.state = 'over';
  }
  fits(piece) {
    return piece.cells.every((row, dy) => row.every((cell, dx) => {
      if (!cell) return true;
      const x = piece.x + dx, y = piece.y + dy;
      return x >= 0 && x < 10 && y < 20 && (y < 0 || !this.board[y][x]);
    }));
  }
  move(dx) {
    if (this.state !== 'playing') return false;
    const moved = {...this.piece, x:this.piece.x + dx};
    if (!this.fits(moved)) return false;
    this.piece = moved; return true;
  }
  rotate(direction = 1) {
    if (this.state !== 'playing' || this.piece.type === 'O') return false;
    const cells = this.piece.cells;
    const rotated = cells.map((row, y) => row.map((_, x) => direction === 1 ? cells[cells.length-1-x][y] : cells[x][cells.length-1-y]));
    const piece = {...this.piece, cells:rotated};
    if (!this.fits(piece)) return false;
    this.piece = piece; return true;
  }
  down(manual = false) {
    if (this.state !== 'playing') return false;
    const piece = {...this.piece, y:this.piece.y + 1};
    if (this.fits(piece)) {
      this.piece = piece; if (manual) this.score++;
      return true;
    }
    this.lock(); return false;
  }
  drop() {
    if (this.state !== 'playing') return;
    while (this.fits({...this.piece, y:this.piece.y+1})) {
      this.piece.y++; this.score += 2;
    }
    this.lock();
  }
  landingPiece() {
    if (!this.piece || !this.fits(this.piece)) return null;
    const landing = {...this.piece};
    while (this.fits({...landing, y:landing.y+1})) landing.y++;
    return landing;
  }
  lock() {
    this.lastClear = 0; this.lastClearEvent = null;
    let above = false;
    this.piece.cells.forEach((row,dy) => row.forEach((cell,dx) => {
      if (!cell) return;
      const y = this.piece.y + dy;
      if (y < 0) above = true;
      else this.board[y][this.piece.x+dx] = this.piece.type;
    }));
    this.locks++;
    if (above) { this.state = 'over'; return; }
    const remaining = this.board.filter(row => row.some(cell => !cell));
    const cleared = 20 - remaining.length;
    const rows = this.board.flatMap((row,y) => row.every(Boolean) ? [y] : []);
    const levelBefore = this.level;
    const points = [0,40,100,300,1200][cleared] * levelBefore;
    this.lastClear = cleared;
    this.score += points;
    this.lines += cleared; this.level = Math.floor(this.lines / 10) + 1;
    if (cleared) this.lastClearEvent = {rows, points, levelBefore, levelAfter:this.level};
    this.board = [...Array.from({length:cleared}, () => Array(10).fill(null)), ...remaining];
    this.spawn();
  }
  get interval() { return Math.max(80, 800 * 0.8 ** (this.level-1)); }
  tick(ms) {
    if (this.state !== 'playing') return;
    this.elapsed += ms;
    while (this.elapsed >= this.interval && this.state === 'playing') {
      this.elapsed -= this.interval;
      this.down();
    }
  }
  pause() { if (this.state === 'playing') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'playing'; }
}
