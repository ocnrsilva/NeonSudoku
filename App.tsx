
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, GameState, CellData, Settings } from './types';
import { generateSudoku } from './utils/sudokuLogic';
import { 
  Undo, Trash2, Lightbulb, Play, Pause, 
  Moon, Sun, Award, Target, BrainCircuit, Plus, X, AlertTriangle
} from 'lucide-react';

const INITIAL_SETTINGS: Settings = {
  darkMode: true,
  highlightIdentical: true,
  autoCheckErrors: true,
  smartFocus: true,
  neuralFeedback: true
};

const DIFFICULTY_CONFIG = {
  [Difficulty.EASY]: { color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/20', hover: 'hover:bg-green-500/20' },
  [Difficulty.MEDIUM]: { color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', hover: 'hover:bg-yellow-500/20' },
  [Difficulty.HARD]: { color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', hover: 'hover:bg-red-500/20' },
  [Difficulty.EXPERT]: { color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20', hover: 'hover:bg-purple-500/20' },
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [settings, setSettings] = useState<Settings>(INITIAL_SETTINGS);
  const [completedNumbers, setCompletedNumbers] = useState<Set<number>>(new Set());
  const [isNewGameModalOpen, setIsNewGameModalOpen] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState<Difficulty | null>(null);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const serializeBoard = (board: CellData[][]) => {
    return JSON.stringify(board, (key, value) => 
      value instanceof Set ? Array.from(value) : value
    );
  };

  const startNewGame = useCallback((difficulty: Difficulty = Difficulty.EASY, zen: boolean = false) => {
    const { puzzle, solution } = generateSudoku(difficulty);
    const initialBoard: CellData[][] = puzzle.map((row, r) => 
      row.map((val, c) => ({
        value: val,
        fixed: val !== null,
        notes: new Set<number>(),
        error: false
      }))
    );

    setGameState({
      board: initialBoard,
      solution,
      difficulty,
      time: 0,
      errors: 0,
      maxErrors: zen ? 999 : 3,
      isPaused: false,
      selectedCell: null,
      history: [],
      zenMode: zen,
      focusMode: false,
      noteMode: false,
      isGameOver: false,
      isWon: false
    });
    setCompletedNumbers(new Set());
    setIsNewGameModalOpen(false);
    setShowConfirmReset(null);
  }, []);

  useEffect(() => {
    startNewGame();
    const saved = localStorage.getItem('sudoku-settings');
    if (saved) setSettings(JSON.parse(saved));
  }, [startNewGame]);

  useEffect(() => {
    localStorage.setItem('sudoku-settings', JSON.stringify(settings));
    if (settings.darkMode) {
      document.body.classList.add('bg-slate-900', 'text-white');
      document.body.classList.remove('bg-gray-50', 'text-slate-900');
    } else {
      document.body.classList.remove('bg-slate-900', 'text-white');
      document.body.classList.add('bg-gray-50', 'text-slate-900');
    }
  }, [settings]);

  useEffect(() => {
    if (gameState && !gameState.isPaused && !gameState.isGameOver && !gameState.isWon && !isNewGameModalOpen && !showConfirmReset) {
      timerRef.current = setInterval(() => {
        setGameState(prev => prev ? { ...prev, time: prev.time + 1 } : null);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.isPaused, gameState?.isGameOver, gameState?.isWon, isNewGameModalOpen, showConfirmReset]);

  useEffect(() => {
    if (!gameState) return;
    const counts = new Array(10).fill(0);
    gameState.board.forEach(row => row.forEach(cell => {
      if (cell.value) counts[cell.value]++;
    }));
    const completed = new Set<number>();
    counts.forEach((count, num) => { if (count === 9) completed.add(num); });
    setCompletedNumbers(completed);

    const isComplete = gameState.board.every((row, r) => 
      row.every((cell, c) => cell.value === gameState.solution[r][c])
    );
    if (isComplete && !gameState.isWon) {
      setGameState(prev => prev ? { ...prev, isWon: true, isGameOver: true } : null);
    }
  }, [gameState?.board]);

  const hasProgress = () => {
    if (!gameState) return false;
    // Se o jogo acabou, não consideramos como "progresso a proteger" para facilitar o reinício
    if (gameState.isGameOver || gameState.isWon) return false;
    return gameState.board.some(row => row.some(cell => !cell.fixed && (cell.value !== null || cell.notes.size > 0)));
  };

  const handleDifficultyClick = (d: Difficulty) => {
    if (hasProgress()) {
      setShowConfirmReset(d);
    } else {
      startNewGame(d, gameState?.zenMode);
    }
  };

  const handleCellSelect = (r: number, c: number) => {
    if (gameState?.isPaused || gameState?.isGameOver || isNewGameModalOpen || showConfirmReset) return;
    setGameState(prev => prev ? { ...prev, selectedCell: [r, c] } : null);
  };

  const handleInput = useCallback((num: number | null) => {
    if (!gameState || !gameState.selectedCell || gameState.isPaused || gameState.isGameOver || isNewGameModalOpen) return;
    const [r, c] = gameState.selectedCell;
    const cell = gameState.board[r][c];
    if (cell.fixed) return;

    const historySnapshot = serializeBoard(gameState.board);

    setGameState(prev => {
      if (!prev) return null;
      const newBoard = prev.board.map(row => row.map(cell => ({ ...cell, notes: new Set(cell.notes) })));
      
      if (prev.noteMode && num !== null) {
        const notes = newBoard[r][c].notes;
        if (notes.has(num)) notes.delete(num);
        else notes.add(num);
        newBoard[r][c].value = null;
      } else {
        const isError = num !== null && num !== prev.solution[r][c];
        newBoard[r][c].value = num;
        newBoard[r][c].error = isError;
        newBoard[r][c].notes = new Set();
        
        if (num !== null && !isError) {
          const startR = r - (r % 3), startC = c - (c % 3);
          for (let i = 0; i < 9; i++) {
            newBoard[r][i].notes.delete(num);
            newBoard[i][c].notes.delete(num);
            newBoard[startR + Math.floor(i/3)][startC + (i%3)].notes.delete(num);
          }
        }
      }

      const newErrors = (!prev.noteMode && num !== null && num !== prev.solution[r][c]) ? prev.errors + 1 : prev.errors;
      const isGameOver = newErrors >= prev.maxErrors;

      return {
        ...prev,
        board: newBoard,
        errors: newErrors,
        isGameOver: isGameOver,
        history: [historySnapshot, ...prev.history].slice(0, 30)
      };
    });
  }, [gameState, isNewGameModalOpen]);

  const undo = () => {
    setGameState(prev => {
      if (!prev || prev.history.length === 0) return prev;
      try {
        const lastBoardData = JSON.parse(prev.history[0]);
        const restoredBoard = lastBoardData.map((row: any) => row.map((cell: any) => ({
          ...cell,
          notes: new Set(cell.notes)
        })));
        return { ...prev, board: restoredBoard, history: prev.history.slice(1) };
      } catch (err) {
        return prev;
      }
    });
  };

  const hint = () => {
    if (!gameState || !gameState.selectedCell || gameState.isGameOver) return;
    const [r, c] = gameState.selectedCell;
    handleInput(gameState.solution[r][c]);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') handleInput(parseInt(e.key));
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') handleInput(null);
      if (e.key === 'n' || e.key === 'N') setGameState(prev => prev ? { ...prev, noteMode: !prev.noteMode } : null);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInput]);

  if (!gameState) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  const isRelated = (r: number, c: number) => {
    if (!gameState.selectedCell) return false;
    const [sr, sc] = gameState.selectedCell;
    const srBox = sr - (sr % 3), scBox = sc - (sc % 3);
    const rBox = r - (r % 3), cBox = c - (c % 3);
    return r === sr || c === sc || (srBox === rBox && scBox === cBox);
  };

  const isIdentical = (val: number | null) => {
    if (!gameState.selectedCell || val === null) return false;
    const [sr, sc] = gameState.selectedCell;
    return gameState.board[sr][sc].value === val;
  };

  const progress = Math.floor((gameState.board.flat().filter(c => c.value && !c.error).length / 81) * 100);

  return (
    <div className={`min-h-screen flex flex-col items-center px-4 py-8 transition-colors duration-300 ${settings.darkMode ? 'dark bg-slate-900 text-white' : 'bg-gray-50 text-slate-900'}`}>
      
      {/* Modal: Novo Jogo */}
      {isNewGameModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <Plus className="text-cyan-500" /> Novo Jogo
              </h2>
              <button type="button" onClick={() => setIsNewGameModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              {Object.values(Difficulty).map(d => {
                const config = DIFFICULTY_CONFIG[d];
                return (
                  <button key={d} type="button" onClick={() => handleDifficultyClick(d)} className={`w-full p-4 rounded-2xl border ${config.border} ${config.bg} ${config.hover} flex justify-between items-center transition-all group active:scale-95`}>
                    <span className={`font-bold ${config.color}`}>{d}</span>
                    <Plus size={16} className={config.color} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Reinício */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xs rounded-3xl shadow-2xl p-6 text-center border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-black mb-2 text-slate-900 dark:text-white">Reiniciar Jogo?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Você perderá o progresso da partida atual.</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setShowConfirmReset(null)} className="py-3 rounded-xl bg-slate-100 dark:bg-slate-700 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
              <button type="button" onClick={() => startNewGame(showConfirmReset, gameState?.zenMode)} className="py-3 rounded-xl bg-red-500 font-bold text-white">Reiniciar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-lg flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 tracking-tighter italic">
            <Target className="text-cyan-500" size={28} />
            NEON SUDOKU
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-md border ${gameState.zenMode ? 'bg-pink-500 border-pink-500 text-white' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600'}`}>
              {gameState.zenMode ? 'Modo Zen' : gameState.difficulty}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-md transition active:scale-95 border border-slate-100 dark:border-slate-700">
            {settings.darkMode ? <Sun size={18} className="text-yellow-500" /> : <Moon size={18} className="text-slate-700" />}
          </button>
          <button type="button" onClick={() => setIsNewGameModalOpen(true)} className="px-4 py-2 rounded-xl bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/30 transition active:scale-95">
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="w-full max-w-lg grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 text-center">
          <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-black mb-1">Erros</p>
          <p className={`text-xl font-black ${gameState.errors >= gameState.maxErrors ? 'text-red-500' : 'text-slate-900 dark:text-white'}`}>
            {gameState.errors}/{gameState.maxErrors}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 text-center">
          <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-black mb-1">Tempo</p>
          <p className="text-xl font-mono font-black text-slate-900 dark:text-white">
            {Math.floor(gameState.time / 60).toString().padStart(2, '0')}:{(gameState.time % 60).toString().padStart(2, '0')}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-black mb-1">Progresso</p>
          <span className="text-sm font-black text-slate-900 dark:text-white">{progress}%</span>
        </div>
      </div>

      {/* Sudoku Grid + Popups */}
      <div className="relative w-full max-w-lg sudoku-grid bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden border-4 border-slate-200 dark:border-slate-700 select-none transition-all duration-300">
        
        {/* Vitória Pop-up */}
        {gameState.isWon && (
          <div className="absolute inset-0 z-[40] bg-cyan-500/95 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in zoom-in duration-500">
            <Award size={80} className="mb-4 animate-bounce" />
            <h2 className="text-5xl font-black mb-2 italic">PARABÉNS!</h2>
            <p className="text-lg opacity-90 mb-8 bg-black/10 px-4 py-1 rounded-full">
              {gameState.difficulty} • {Math.floor(gameState.time / 60)}m {gameState.time % 60}s
            </p>
            <button type="button" onClick={() => setIsNewGameModalOpen(true)} className="bg-white text-cyan-600 px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition active:scale-95 uppercase">
              Jogar Novamente
            </button>
          </div>
        )}

        {/* Derrota Pop-up */}
        {gameState.isGameOver && !gameState.isWon && (
          <div className="absolute inset-0 z-[40] bg-red-500/95 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in zoom-in duration-500">
            <AlertTriangle size={80} className="mb-4" />
            <h2 className="text-4xl font-black mb-2 uppercase italic text-white">GAME OVER</h2>
            <p className="text-lg opacity-80 mb-8 italic text-white">Você cometeu {gameState.errors} erros.</p>
            <button type="button" onClick={() => setIsNewGameModalOpen(true)} className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition active:scale-95 uppercase">
              Tentar Novamente
            </button>
          </div>
        )}

        {/* Pausa Overlay */}
        {gameState.isPaused && !gameState.isGameOver && !gameState.isWon && (
          <div className="absolute inset-0 z-10 bg-white/90 dark:bg-slate-900/90 flex flex-col items-center justify-center backdrop-blur-md animate-in fade-in duration-300">
            <button type="button" onClick={() => setGameState(p => p ? { ...p, isPaused: false } : null)} className="w-20 h-20 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition active:scale-95 mb-4">
              <Play size={40} fill="currentColor" />
            </button>
            <h2 className="text-2xl font-black uppercase text-slate-900 dark:text-white">Pausado</h2>
          </div>
        )}

        <div className="grid grid-cols-9 h-full">
          {gameState.board.map((row, r) => 
            row.map((cell, c) => {
              const isSel = gameState.selectedCell?.[0] === r && gameState.selectedCell?.[1] === c;
              const isRel = isRelated(r, c);
              const isIden = settings.highlightIdentical && isIdentical(cell.value);
              return (
                <div key={`${r}-${c}`} onClick={() => handleCellSelect(r, c)} className={`relative flex items-center justify-center cursor-pointer border-[0.5px] border-slate-200 dark:border-slate-700 text-xl md:text-3xl font-bold transition-all duration-150 ${r % 3 === 2 && r < 8 ? 'border-b-2 md:border-b-4 border-b-slate-400 dark:border-b-slate-600' : ''} ${c % 3 === 2 && c < 8 ? 'border-r-2 md:border-r-4 border-r-slate-400 dark:border-r-slate-600' : ''} ${isSel ? 'bg-cyan-500 text-white z-10 shadow-[inset_0_0_15px_rgba(255,255,255,0.4)]' : isIden ? 'bg-cyan-100 dark:bg-cyan-900/40' : isRel ? 'bg-slate-100 dark:bg-slate-700/60' : ''}`}>
                  {cell.value ? (
                    <span className={`${isSel ? 'text-white' : cell.fixed ? 'text-slate-900 dark:text-white' : 'text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]'} ${cell.error ? 'text-red-500 dark:text-red-400 drop-shadow-[0_0_12px_rgba(239,68,68,0.7)]' : ''}`}>
                      {cell.value}
                    </span>
                  ) : cell.notes.size > 0 ? (
                    <div className="grid grid-cols-3 w-full h-full p-1 pointer-events-none">
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                        <div key={n} className={`flex items-center justify-center text-[8px] md:text-[11px] font-black ${isSel ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                          {cell.notes.has(n) ? n : ''}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Controls */}
      <div className="w-full max-w-lg mt-6 grid grid-cols-5 gap-3">
        <button type="button" onClick={undo} disabled={!gameState || gameState.history.length === 0} className="flex flex-col items-center justify-center gap-1.5 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-90 disabled:opacity-30">
          <Undo size={22} className="text-slate-700 dark:text-slate-200" /><span className="text-[9px] uppercase font-black text-slate-500 dark:text-slate-400">Voltar</span>
        </button>
        <button type="button" onClick={() => handleInput(null)} className="flex flex-col items-center justify-center gap-1.5 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-90">
          <Trash2 size={22} className="text-red-500" /><span className="text-[9px] uppercase font-black text-slate-500 dark:text-slate-400">Apagar</span>
        </button>
        <button type="button" onClick={() => setGameState(p => p ? { ...p, noteMode: !p.noteMode } : null)} className={`flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl shadow-md transition active:scale-90 ${gameState.noteMode ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-slate-800'}`}>
          <BrainCircuit size={22} className={gameState.noteMode ? 'text-white' : 'text-cyan-500'} /><span className={`text-[9px] uppercase font-black ${gameState.noteMode ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`}>Notas</span>
        </button>
        <button type="button" onClick={hint} className="flex flex-col items-center justify-center gap-1.5 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-90">
          <Lightbulb size={22} className="text-yellow-500" /><span className="text-[9px] uppercase font-black text-slate-500 dark:text-slate-400">Dica</span>
        </button>
        <button type="button" onClick={() => setGameState(p => p ? { ...p, isPaused: !p.isPaused } : null)} className="flex flex-col items-center justify-center gap-1.5 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-90">
          {gameState.isPaused ? <Play size={22} className="text-slate-700 dark:text-slate-200" fill="currentColor" /> : <Pause size={22} className="text-slate-700 dark:text-slate-200" fill="currentColor" />}
          <span className="text-[9px] uppercase font-black text-slate-500 dark:text-slate-400">{gameState.isPaused ? 'Resumir' : 'Pausar'}</span>
        </button>
      </div>

      {/* Number Pad */}
      <div className="w-full max-w-lg mt-6 grid grid-cols-9 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button key={num} type="button" disabled={completedNumbers.has(num)} onClick={() => handleInput(num)} className={`relative h-14 md:h-18 flex items-center justify-center rounded-2xl font-black text-2xl transition-all shadow-md overflow-hidden border border-slate-100 dark:border-slate-700/50 ${completedNumbers.has(num) ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-300 dark:text-slate-700 opacity-40' : 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 hover:scale-105 active:scale-75'}`}>
            {num}
            {completedNumbers.has(num) && <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500/50" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;
