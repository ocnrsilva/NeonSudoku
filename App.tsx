
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Difficulty, GameState, CellData, Settings } from './types';
import { generateSudoku } from './utils/sudokuLogic';
import { 
  Undo, Trash2, Lightbulb, RotateCcw, Play, Pause, 
  Moon, Sun, Award, Target, BrainCircuit, Heart, Plus, X, AlertTriangle
} from 'lucide-react';

const INITIAL_SETTINGS: Settings = {
  darkMode: false,
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
    if (gameState && !gameState.isPaused && !gameState.isGameOver && !gameState.isWon && !gameState.zenMode && !isNewGameModalOpen) {
      timerRef.current = setInterval(() => {
        setGameState(prev => prev ? { ...prev, time: prev.time + 1 } : null);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.isPaused, gameState?.isGameOver, gameState?.isWon, gameState?.zenMode, isNewGameModalOpen]);

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
    if (gameState?.isPaused || gameState?.isGameOver || isNewGameModalOpen) return;
    setGameState(prev => prev ? { ...prev, selectedCell: [r, c] } : null);
  };

  const handleInput = useCallback((num: number | null) => {
    if (!gameState || !gameState.selectedCell || gameState.isPaused || gameState.isGameOver || isNewGameModalOpen) return;
    const [r, c] = gameState.selectedCell;
    const cell = gameState.board[r][c];
    if (cell.fixed) return;

    const historySnapshot = JSON.stringify(gameState.board);

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
      return {
        ...prev,
        board: newBoard,
        errors: newErrors,
        isGameOver: newErrors >= prev.maxErrors,
        history: [historySnapshot, ...prev.history].slice(0, 20)
      };
    });
  }, [gameState, isNewGameModalOpen]);

  const undo = () => {
    setGameState(prev => {
      if (!prev || prev.history.length === 0) return prev;
      const lastBoard = JSON.parse(prev.history[0]);
      const restoredBoard = lastBoard.map((row: any) => row.map((cell: any) => ({
        ...cell,
        notes: new Set(cell.notes)
      })));
      return { ...prev, board: restoredBoard, history: prev.history.slice(1) };
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
      
      {/* Modais Overlay */}
      {isNewGameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Plus className="text-cyan-500" /> Novo Jogo
              </h2>
              <button onClick={() => setIsNewGameModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-3">
              <p className="text-sm opacity-60 mb-4">Selecione o nível de dificuldade para começar uma nova partida.</p>
              
              {Object.values(Difficulty).map(d => {
                const config = DIFFICULTY_CONFIG[d];
                return (
                  <button
                    key={d}
                    onClick={() => handleDifficultyClick(d)}
                    className={`w-full p-4 rounded-2xl border ${config.border} ${config.bg} ${config.hover} flex justify-between items-center transition-all group active:scale-95`}
                  >
                    <span className={`font-bold ${config.color}`}>{d}</span>
                    <div className={`w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <Plus size={16} className={config.color} />
                    </div>
                  </button>
                );
              })}

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 mt-4">
                <button 
                  onClick={() => startNewGame(gameState.difficulty, !gameState.zenMode)}
                  className={`w-full p-4 rounded-2xl flex justify-between items-center transition-all active:scale-95 ${gameState.zenMode ? 'bg-pink-500 text-white' : 'bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  <span className="font-bold flex items-center gap-2">
                    <Heart size={18} fill={gameState.zenMode ? "white" : "none"} /> Modo Zen
                  </span>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${gameState.zenMode ? 'bg-white/30' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${gameState.zenMode ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmReset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-xs rounded-3xl p-8 text-center shadow-2xl border border-red-500/20">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-red-500" size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Reiniciar Jogo?</h3>
            <p className="text-sm opacity-60 mb-6">Seu progresso atual será perdido. Deseja continuar?</p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setShowConfirmReset(null)}
                className="py-3 rounded-xl font-bold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
              >
                Cancelar
              </button>
              <button 
                onClick={() => startNewGame(showConfirmReset, gameState.zenMode)}
                className="py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 transition active:scale-95"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="w-full max-w-lg flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="text-cyan-500" />
            NEON SUDOKU
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full border ${gameState.zenMode ? 'bg-pink-500 border-pink-500 text-white' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-600'}`}>
              {gameState.zenMode ? 'Modo Zen' : gameState.difficulty}
            </span>
            <span className="text-[10px] opacity-40 font-bold uppercase tracking-wider">v1.0</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition active:scale-95">
            {settings.darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setIsNewGameModalOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 text-white font-bold shadow-lg shadow-cyan-500/30 hover:bg-cyan-600 transition active:scale-95">
            <Plus size={18} /> <span className="hidden sm:inline">Novo Jogo</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="w-full max-w-lg grid grid-cols-3 gap-3 mb-4 text-center">
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
          <p className="text-[10px] uppercase opacity-40 font-black tracking-widest mb-1">Erros</p>
          <p className={`text-lg font-black ${gameState.errors >= gameState.maxErrors ? 'text-red-500' : ''}`}>
            {gameState.errors}<span className="text-sm opacity-30 mx-1">/</span>{gameState.maxErrors}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50">
          <p className="text-[10px] uppercase opacity-40 font-black tracking-widest mb-1">Tempo</p>
          <p className="text-lg font-mono font-black">
            {Math.floor(gameState.time / 60).toString().padStart(2, '0')}:{(gameState.time % 60).toString().padStart(2, '0')}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-3 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase opacity-40 font-black tracking-widest mb-1">Concluído</p>
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
               <div className="h-full bg-cyan-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="text-sm font-black">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Sudoku Grid */}
      <div className="relative w-full max-w-lg sudoku-grid bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border-4 border-slate-200 dark:border-slate-700 select-none">
        {gameState.isPaused && (
          <div className="absolute inset-0 z-10 bg-white/80 dark:bg-slate-900/80 flex flex-col items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
            <button 
              onClick={() => setGameState(p => p ? { ...p, isPaused: false } : null)}
              className="w-20 h-20 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-cyan-500/40 hover:scale-110 transition active:scale-95 mb-4"
            >
              <Play size={40} fill="currentColor" />
            </button>
            <h2 className="text-2xl font-black tracking-tighter uppercase">Jogo Pausado</h2>
          </div>
        )}

        {gameState.isWon && (
          <div className="absolute inset-0 z-20 bg-cyan-500/95 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Award size={60} />
            </div>
            <h2 className="text-5xl font-black mb-2 tracking-tighter italic">VENCEU!</h2>
            <p className="text-lg font-medium opacity-90 mb-8 bg-black/10 px-4 py-1 rounded-full">
              Dificuldade {gameState.difficulty} • {Math.floor(gameState.time / 60)}m {gameState.time % 60}s
            </p>
            <button onClick={() => setIsNewGameModalOpen(true)} className="bg-white text-cyan-600 px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition active:scale-95 uppercase tracking-tighter">
              Jogar Novamente
            </button>
          </div>
        )}

        {gameState.isGameOver && !gameState.isWon && (
          <div className="absolute inset-0 z-20 bg-red-500/95 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mb-6">
              <X size={50} strokeWidth={3} />
            </div>
            <h2 className="text-4xl font-black mb-2 uppercase tracking-tighter italic">Derrota</h2>
            <p className="text-lg opacity-80 mb-8">Você atingiu o limite de erros.</p>
            <button onClick={() => setIsNewGameModalOpen(true)} className="bg-white text-red-600 px-10 py-4 rounded-2xl font-black shadow-xl hover:scale-105 transition active:scale-95 uppercase tracking-tighter">
              Tentar Novamente
            </button>
          </div>
        )}

        <div className="grid grid-cols-9 h-full">
          {gameState.board.map((row, r) => 
            row.map((cell, c) => {
              const isSel = gameState.selectedCell?.[0] === r && gameState.selectedCell?.[1] === c;
              const isRel = isRelated(r, c);
              const isIden = settings.highlightIdentical && isIdentical(cell.value);
              const isSmartFocus = settings.smartFocus && gameState.selectedCell && !isRel;

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleCellSelect(r, c)}
                  className={`
                    relative flex items-center justify-center cursor-pointer border-[0.5px] border-slate-200 dark:border-slate-700 text-xl md:text-3xl font-bold transition-all duration-200
                    ${r % 3 === 2 && r < 8 ? 'border-b-2 md:border-b-4 border-b-slate-400 dark:border-b-slate-600' : ''}
                    ${c % 3 === 2 && c < 8 ? 'border-r-2 md:border-r-4 border-r-slate-400 dark:border-r-slate-600' : ''}
                    ${isSel ? 'bg-cyan-500 text-white z-10 shadow-[inset_0_0_15px_rgba(255,255,255,0.4)]' : isIden ? 'bg-cyan-100 dark:bg-cyan-900/40' : isRel ? 'bg-slate-100 dark:bg-slate-700/60' : ''}
                    ${isSmartFocus ? 'opacity-30 grayscale-[0.8]' : ''}
                  `}
                >
                  {cell.value ? (
                    <span className={`
                      ${cell.fixed ? 'text-slate-900 dark:text-white' : 'text-cyan-500 dark:text-cyan-400 drop-shadow-[0_0_5px_currentColor]'}
                      ${cell.error ? 'text-red-500 dark:text-red-400 drop-shadow-[0_0_8px_red]' : ''}
                      ${completedNumbers.has(cell.value) && settings.neuralFeedback ? 'animate-completion' : ''}
                    `}>
                      {cell.value}
                    </span>
                  ) : cell.notes.size > 0 ? (
                    <div className="grid grid-cols-3 w-full h-full p-1 pointer-events-none">
                      {[1,2,3,4,5,6,7,8,9].map(n => (
                        <div key={n} className="flex items-center justify-center text-[8px] md:text-[11px] leading-none text-slate-400/80 font-black">
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
      <div className="w-full max-w-lg mt-6 grid grid-cols-5 gap-2">
        <button onClick={undo} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition group active:scale-90">
          <Undo size={20} className="group-hover:-rotate-45 transition-transform" />
          <span className="text-[9px] uppercase font-black opacity-40">Desfazer</span>
        </button>
        <button onClick={() => handleInput(null)} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition group active:scale-90">
          <Trash2 size={20} className="group-hover:text-red-500 transition-colors" />
          <span className="text-[9px] uppercase font-black opacity-40">Apagar</span>
        </button>
        <button 
          onClick={() => setGameState(p => p ? { ...p, noteMode: !p.noteMode } : null)} 
          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl shadow-sm transition active:scale-90 ${gameState.noteMode ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
        >
          <div className="relative">
            <BrainCircuit size={20} />
            <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 transition-colors ${gameState.noteMode ? 'bg-white' : 'bg-slate-300'}`} />
          </div>
          <span className="text-[9px] uppercase font-black opacity-40">Notas: {gameState.noteMode ? 'On' : 'Off'}</span>
        </button>
        <button onClick={hint} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition group active:scale-90">
          <Lightbulb size={20} className="group-hover:text-yellow-500 transition-colors" />
          <span className="text-[9px] uppercase font-black opacity-40">Dica</span>
        </button>
        <button onClick={() => setGameState(p => p ? { ...p, isPaused: !p.isPaused } : null)} className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition group active:scale-90">
          {gameState.isPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
          <span className="text-[9px] uppercase font-black opacity-40">{gameState.isPaused ? 'Resumir' : 'Pausar'}</span>
        </button>
      </div>

      {/* Number Pad */}
      <div className="w-full max-w-lg mt-4 grid grid-cols-9 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            disabled={completedNumbers.has(num)}
            onClick={() => handleInput(num)}
            className={`
              relative h-14 md:h-16 flex items-center justify-center rounded-2xl font-black text-xl md:text-2xl transition-all shadow-sm overflow-hidden
              ${completedNumbers.has(num) ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 active:scale-75 active:opacity-50'}
            `}
          >
            {num}
            {completedNumbers.has(num) && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500/30" />
            )}
          </button>
        ))}
      </div>

      {/* Bottom Selector (Quick Access) */}
      <div className="w-full max-w-lg mt-8 text-center">
        <p className="text-[10px] uppercase font-black opacity-20 tracking-[0.3em] mb-4">Escolha sua Dificuldade</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.values(Difficulty).map(d => {
            const isActive = gameState.difficulty === d && !gameState.zenMode;
            return (
              <button
                key={d}
                onClick={() => handleDifficultyClick(d)}
                className={`py-3 px-2 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all border shadow-sm ${isActive ? 'bg-cyan-500 text-white border-cyan-500 scale-105 shadow-lg shadow-cyan-500/20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-cyan-500/30'}`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-12 text-center opacity-20 uppercase text-[9px] font-black tracking-[0.4em]">
        High-Performance Neon Interface
      </div>
    </div>
  );
};

export default App;
