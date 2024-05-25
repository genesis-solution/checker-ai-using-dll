const StructType = require('ref-struct-napi');
const ArrayType = require('ref-array-napi');
const ffi = require('ffi-napi');
const ref = require('ref-napi');
const { buffer } = require('stream/consumers');
const express = require('express');
const app = express();

const port = 3003;

app.use(express.json());

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

var libchecker = ffi.Library('checkerDll_x64.dll', {
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
  try {
    const inputString = command + "\0";
    const inputBuffer = Buffer.from(inputString, 'utf-8');

    const inputCharArray = new CharArray(inputBuffer.length);
    const outCharArray = new CharArray(1024);

    inputBuffer.copy(inputCharArray.buffer);

    const ret = libchecker.enginecommand(inputCharArray, outCharArray)

    reply.value = outCharArray.buffer.toString('utf-8');
    return ret;
  } catch (error) {
    console.error('Error executing engine command:', error);
    throw error;
  }
}

//init and black turn
//color
/* Piece types on Board8x8, used by getmove(), islegal(). */
//#define CB_WHITE 1
//#define CB_BLACK 2

/* Return values of getmove() */
const CB_DRAW = 0
const CB_WIN = 1
const CB_LOSS = 2
const CB_UNKNOWN = 3
var ret = CB_UNKNOWN;

function extractMoveNumbers(data) {
  // Define the regular expression to match "Move: <move>" and capture the numbers
  const moveRegex = /Move: (\d+)-(\d+)/;

  // Execute the regex on the data string
  const match = data.match(moveRegex);

  // Extract the move numbers if there's a match
  if (match) {
    const moveStart = parseInt(match[1]); // First captured group
    const moveEnd = parseInt(match[2]); // Second captured group
    return {
      success: true,
      start: moveStart,
      end: moveEnd
    }; // Return an array with the two numbers
  } else {
    return {
      success: false
    }
  }
}

// console.log(enginecommand("about", gamestate));
// console.log(gamestate.value);

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
  try {
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
  } catch (error) {
    console.error('Error getting move:', error);
    throw error;
  }
}

function rotateArray90Clockwise(matrix) {
  const n = matrix.length;

  // Transpose the matrix
  for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
          // Swap matrix[i][j] and matrix[j][i]
          const temp = matrix[i][j];
          matrix[i][j] = matrix[j][i];
          matrix[j][i] = temp;
      }
  }

  // Reverse each row
  for (let i = 0; i < n; i++) {
      for (let j = 0; j < Math.floor(n / 2); j++) {
          // Swap matrix[i][j] and matrix[i][n - 1 - j]
          const temp = matrix[i][j];
          matrix[i][j] = matrix[i][n - 1 - j];
          matrix[i][n - 1 - j] = temp;
      }
  }
}

function getValueByKey(key) {
  // const x = (key - 1) % 4 * 2 + (Math.floor((key - 1) / 4) % 2);
  // const y = Math.floor((key - 1) / 4);
  const convertTable = {
    1: { x: 1, y: 0},
    2: { x: 3, y: 0},
    3: { x: 5, y: 0},
    4: { x: 7, y: 0},
    5: { x: 0, y: 1},
    6: { x: 2, y: 1},
    7: { x: 4, y: 1},
    8: { x: 6, y: 1},
    9: { x: 1, y: 2},
    10: { x: 3, y: 2},
    11: { x: 5, y: 2},
    12: { x: 7, y: 2},
    13: { x: 0, y: 3},
    14: { x: 2, y: 3},
    15: { x: 4, y: 3},
    16: { x: 6, y: 3},
    17: { x: 1, y: 4},
    18: { x: 3, y: 4},
    19: { x: 5, y: 4},
    20: { x: 7, y: 4},
    21: { x: 0, y: 5},
    22: { x: 2, y: 5},
    23: { x: 4, y: 5},
    24: { x: 6, y: 5},
    25: { x: 1, y: 6},
    26: { x: 3, y: 6},
    27: { x: 5, y: 6},
    28: { x: 7, y: 6},
    29: { x: 0, y: 7},
    30: { x: 2, y: 7},
    31: { x: 4, y: 7},
    32: { x: 6, y: 7},
  }

  return convertTable[key];
}

// console.log(enginecommand("about", gamestate));
// console.log(gamestate.value.toString());

// POST endpoint to extract move numbers
app.post('/extract-move', (req, res) => {
  try {
    const data = req.body.data;
    if (data) {
      let gamestate = { value: "" };
      
      const CB_WHITE = 1;
      const CB_BLACK = 2;
      const CB_MAN = 4;
      const CB_KING = 8;
      const CB_EXACT_TIME = 2;
      const playnow = { value: 0 };
      const move = { value: null };

      // init Checkboard data 
      let b =[];
      for (var i = 0; i < 8; i++) {
        const row = [];
        for (var j = 0; j < 8; j++) {
          row.push(0);
        }
        b.push(row);
      }

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
      for (let index = 0; index < data.length; index++) {
        var xx = parseInt(data[index].nx);
        var yy = parseInt(data[index].ny);
        if (data[index].color == '1') {
          if (parseInt(data[index].isKing) == 1)
            b[yy][xx] = CB_BLACK | CB_KING;     
          else
            b[yy][xx] = CB_BLACK | CB_MAN;     
        } else {
          if (parseInt(data[index].isKing) == 1)
            b[yy][xx] = CB_WHITE | CB_KING;     
          else
            b[yy][xx] = CB_WHITE | CB_MAN;
        } 
      }

      try {
        rotateArray90Clockwise(b);
        rotateArray90Clockwise(b);
        rotateArray90Clockwise(b);

        console.log("--------------- Start -------------------");
        console.table(b);

        ret = getmove(b, CB_BLACK, 5.0, gamestate, playnow, CB_EXACT_TIME, 0, move);
        
        console.log("--------------- End -------------------");
        console.table(b);
        
        var _result = extractMoveNumbers(gamestate.value.toString());

        if(ret == CB_WIN || ref==CB_LOSS)
        {
          console.log("End");
        }

        if (_result.success == true) {
          console.log(_result)
          var startPostion = getValueByKey(_result.start);
          var endPostion = getValueByKey(_result.end);

          res.json({ success: true, start: startPostion, end: endPostion });  
        }
        else {
          res.json({ success: false });  
        }
      } catch (error) {
        console.log(error)
        res.json({ success: false });  
      }
    } else {
      // res.status(400).json({ error: 'No data provided' });
      res.json({ success: false });  
    }
  } catch (error) {
    console.error('Error in /extract-move route:', error);
    res.json({ success: false });  
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Checker AI Server is running on http://localhost:${port}`);
});