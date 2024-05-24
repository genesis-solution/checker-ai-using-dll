const StructType = require('ref-struct-napi');
const ArrayType = require('ref-array-napi');
const ffi = require('ffi-napi');
const ref = require('ref-napi');
const { buffer } = require('stream/consumers');

const IntArray = ArrayType('int');
const CharArray = ArrayType('char');

const coor = StructType({
  x: ref.types.int,
  y: ref.types.int,
});
const CoorArray = ArrayType(coor);
const CBmove = StructType({
  jumps: ref.types.int,
  newpiece: ref.types.int,
  oldpiece: ref.types.int,
  from: coor,
  to: coor,
  path: CoorArray,
  del: CoorArray,
  delpiece: IntArray,
});
const CBmoveRef = ref.refType(CBmove);
const IntRef = ref.refType(ref.types.int);

var libchecker = ffi.Library('checkerDll_x64_SSE2.dll', {
  'enginecommand': [
    'int',
    [
      CharArray, // command
      CharArray, // reply
    ]],
    'getmove': [
      'int', 
      [
      IntArray, // int board[8][8]
      'int',     // int color
      'double',  // double maxtime
      CharArray, // char str[1024]
      'pointer', // int* playnow
      'int',     // int info
      'int',     // int moreinfo
      'pointer'  // struct CBmove* move
    ]]
});

/**
 * 
 * @param {String} command 
 * @param { {value:string} } reply 
 * @returns {int}
 */
const enginecommand = (command, reply) => {
  const inputString = command + "\0";
  const inputBuffer = Buffer.from(inputString, 'utf-8');

  const inputCharArray = new CharArray(inputBuffer.length);
  const outCharArray = new CharArray(1024);

  inputBuffer.copy(inputCharArray.buffer);

  const ret = libchecker.enginecommand(inputCharArray, outCharArray)

  reply.value = outCharArray.buffer.toString('utf-8');
  return ret;
}

const gamestate = { value: "" };
console.log(enginecommand("about", gamestate));
console.log(gamestate.value);

/**
 * @param {int[8][8]} board
 * @param {int} color
 * @param {double} maxtime
 * @param { {value:string}} str
 * @param { {value:int} } playnow
 * @param {int} info
 * @param {int} moreInfo
 * @param { {value:any} } move
 * @returns {int}
 */
const getmove = (board, color, maxtime, str, playnow, info, moreInfo, move) => {
  // board array
  const boardBuffer = new IntArray(board.flat());
  // str array
  const strBuffer = Buffer.from(str.value, 'utf-8');
  const strArray = new CharArray(1024);
  strBuffer.copy(strArray.buffer); 

  // playnow ref
  const playnowRef = ref.alloc('int', playnow.value);

  // move ref
  const cbmove = new CBmove();
  const moveRef = cbmove.ref();

  const ret = libchecker.getmove(boardBuffer, color, maxtime, strArray, playnowRef, info, moreInfo, moveRef);
  move.value = moveRef.deref();
  playnow.value = playnowRef.deref();
  for(var i = 0; i < 8; i++){
    for(var j = 0; j < 8; j++)
    board[i][j] = boardBuffer[i*8 + j];
  }
  str.value = strArray.buffer.toString('utf-8');
  return ret;
}
const CB_WHITE = 1;
const CB_BLACK = 2;
const CB_MAN = 4;
const CB_KING = 8;

const playnow = { value: 1 };
const move = { value: null };
const board = [];
//void boardtocrbitboard(Board8x8 b, pos *position) in Checkboard, bitboard.c
/*
  CB_WHITE
    28  29  30  31
  24  25  26  27
    20  21  22  23
  16  17  18  19
    12  13  14  15
  8   9  10  11
    4   5   6   7
  0   1   2   3
      CB_BLACK
*/
// init Checkboard data 
const b =[];
for (var i = 0; i < 32; i++) {
  board[i] = 0
}

for (var i = 0; i < 8; i++) {
  const row = [];
  for (var j = 0; j < 8; j++) {
    row.push(0);
  }
  b.push(row);
}
for (var i = 0; i < 12; i++) {
    board[i] = CB_BLACK | CB_MAN;      
    board[i + 20] = CB_WHITE | CB_MAN;
}

b[0][0] = board[0];
b[2][0] = board[1];
b[4][0] = board[2];
b[6][0] = board[3];
b[1][1] = board[4];
b[3][1] = board[5];
b[5][1] = board[6];
b[7][1] = board[7];
b[0][2] = board[8];
b[2][2] = board[9];
b[4][2] = board[10];
b[6][2] = board[11];
b[1][3] = board[12];
b[3][3] = board[13];
b[5][3] = board[14];
b[7][3] = board[15];
b[0][4] = board[16];
b[2][4] = board[17];
b[4][4] = board[18];
b[6][4] = board[19];
b[1][5] = board[20];
b[3][5] = board[21];
b[5][5] = board[22];
b[7][5] = board[23];
b[0][6] = board[24];
b[2][6] = board[25];
b[4][6] = board[26];
b[6][6] = board[27];
b[1][7] = board[28];
b[3][7] = board[29];
b[5][7] = board[30];
b[7][7] = board[31];

//init and black turn
//color
/* Piece types on Board8x8, used by getmove(), islegal(). */
//#define CB_WHITE 1
//#define CB_BLACK 2
console.log(getmove(b, CB_BLACK, 5.0, gamestate, playnow, 1, 0, move));
console.table(b);
console.log(gamestate.value.toString());

console.log(enginecommand("about", gamestate));
console.log(gamestate.value.toString());
/* Return values of getmove() */
const CB_DRAW = 0
const CB_WIN = 1
const CB_LOSS = 2
const CB_UNKNOWN = 3
var ret = CB_UNKNOWN;
var k = 0;
while(true)
{ 
  k++;
  ret = getmove(b, k%2, 5.0, gamestate, playnow, 0, 0, move);
  console.log(ret);
  console.table(b);
  console.log(gamestate.value.toString());
  if(ret == CB_WIN || ref==CB_LOSS)
  {
    console.log("End");
    break;
  }
}

console.log(enginecommand("about", gamestate));
console.log(gamestate.value.toString());