
import { Difficulty } from '../types';

export const isValid = (board: (number | null)[][], row: number, col: number, num: number): boolean => {
  for (let x = 0; x < 9; x++) if (board[row][x] === num) return false;
  for (let x = 0; x < 9; x++) if (board[x][col] === num) return false;
  let startRow = row - (row % 3), startCol = col - (col % 3);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i + startRow][j + startCol] === num) return false;
    }
  }
  return true;
};

export const solveSudoku = (board: (number | null)[][]): boolean => {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === null) {
        for (let num = 1; num <= 9; num++) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (solveSudoku(board)) return true;
            board[row][col] = null;
          }
        }
        return false;
      }
    }
  }
  return true;
};

const countSolutions = (board: (number | null)[][]): number => {
  let count = 0;
  const solve = (b: (number | null)[][]) => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (b[row][col] === null) {
          for (let num = 1; num <= 9; num++) {
            if (isValid(b, row, col, num)) {
              b[row][col] = num;
              solve(b);
              b[row][col] = null;
              if (count > 1) return;
            }
          }
          return;
        }
      }
    }
    count++;
  };
  solve(board);
  return count;
};

export const generateSudoku = (difficulty: Difficulty): { puzzle: (number | null)[][], solution: number[][] } => {
  const board: (number | null)[][] = Array(9).fill(null).map(() => Array(9).fill(null));
  
  // Fill diagonal blocks for randomization
  for (let i = 0; i < 9; i += 3) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        let num;
        do { num = Math.floor(Math.random() * 9) + 1; }
        while (!isValid(board, i + j, i + k, num));
        board[i + j][i + k] = num;
      }
    }
  }

  solveSudoku(board);
  const solution = board.map(row => [...row as number[]]);
  const puzzle = board.map(row => [...row]);

  let attempts = 0;
  let cellsToRemove = 0;
  switch (difficulty) {
    case Difficulty.EASY: cellsToRemove = 35; break;
    case Difficulty.MEDIUM: cellsToRemove = 45; break;
    case Difficulty.HARD: cellsToRemove = 55; break;
    case Difficulty.EXPERT: cellsToRemove = 60; break;
  }

  while (attempts < cellsToRemove) {
    let r = Math.floor(Math.random() * 9);
    let c = Math.floor(Math.random() * 9);
    if (puzzle[r][c] !== null) {
      let temp = puzzle[r][c];
      puzzle[r][c] = null;
      if (countSolutions(JSON.parse(JSON.stringify(puzzle))) !== 1) {
        puzzle[r][c] = temp;
      } else {
        attempts++;
      }
    }
  }

  return { puzzle, solution };
};
