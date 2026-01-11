
export enum Difficulty {
  EASY = 'Fácil',
  MEDIUM = 'Médio',
  HARD = 'Difícil',
  EXPERT = 'Expert'
}

export interface CellData {
  value: number | null;
  fixed: boolean;
  notes: Set<number>;
  error: boolean;
}

export interface GameState {
  board: CellData[][];
  solution: number[][];
  difficulty: Difficulty;
  time: number;
  errors: number;
  maxErrors: number;
  isPaused: boolean;
  selectedCell: [number, number] | null;
  history: string[]; // Serialized snapshots for undo
  zenMode: boolean;
  focusMode: boolean;
  noteMode: boolean;
  isGameOver: boolean;
  isWon: boolean;
}

export interface Settings {
  darkMode: boolean;
  highlightIdentical: boolean;
  autoCheckErrors: boolean;
  smartFocus: boolean;
  neuralFeedback: boolean;
}
