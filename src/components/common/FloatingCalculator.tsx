import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Calculator as CalcIcon,
  X,
  Minus,
  Maximize2,
  Copy,
  Check,
  Move,
} from 'lucide-react';

export const FloatingCalculator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  // Position state (defaults to lower right quadrant)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 320) : 20;
    const defaultY = typeof window !== 'undefined' ? Math.max(80, window.innerHeight - 440) : 100;
    return { x: defaultX, y: defaultY };
  });

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Calculator logic state
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [formulaHistory, setFormulaHistory] = useState<string>('');

  // Clamp position within screen boundaries
  const clampPosition = useCallback((x: number, y: number, width = 290, height = 380) => {
    if (typeof window === 'undefined') return { x, y };
    const maxX = window.innerWidth - width - 8;
    const maxY = window.innerHeight - height - 8;
    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  }, []);

  // Update bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Pointer drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag from header handle
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const newX = dragStartRef.current.initialX + dx;
    const newY = dragStartRef.current.initialY + dy;
    setPosition(clampPosition(newX, newY));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  };

  // Math operations
  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplayValue(digit);
      setWaitingForOperand(false);
    } else {
      setDisplayValue(displayValue === '0' ? digit : displayValue + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplayValue('0,');
      setWaitingForOperand(false);
      return;
    }
    if (!displayValue.includes(',')) {
      setDisplayValue(displayValue + ',');
    }
  };

  const clearAll = () => {
    setDisplayValue('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
    setFormulaHistory('');
  };

  const backspace = () => {
    if (waitingForOperand) return;
    if (displayValue.length > 1) {
      setDisplayValue(displayValue.slice(0, -1));
    } else {
      setDisplayValue('0');
    }
  };

  const toggleSign = () => {
    const val = parseFloat(displayValue.replace(',', '.'));
    if (!isNaN(val)) {
      const toggled = -val;
      setDisplayValue(String(toggled).replace('.', ','));
    }
  };

  const performOperation = (nextOp: string) => {
    const inputValue = parseFloat(displayValue.replace(',', '.'));

    if (previousValue === null) {
      setPreviousValue(inputValue);
      setFormulaHistory(`${displayValue} ${nextOp}`);
    } else if (operation) {
      const currentValue = previousValue || 0;
      let newValue = currentValue;

      switch (operation) {
        case '+':
          newValue = currentValue + inputValue;
          break;
        case '−':
        case '-':
          newValue = currentValue - inputValue;
          break;
        case '×':
        case '*':
          newValue = currentValue * inputValue;
          break;
        case '÷':
        case '/':
          newValue = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
        default:
          break;
      }

      newValue = Number(newValue.toFixed(6));
      setPreviousValue(newValue);
      const strVal = String(newValue).replace('.', ',');
      setDisplayValue(strVal);
      setFormulaHistory(`${strVal} ${nextOp}`);
    }

    setWaitingForOperand(true);
    setOperation(nextOp);
  };

  const calculateEquals = () => {
    if (operation === null || previousValue === null) return;
    const inputValue = parseFloat(displayValue.replace(',', '.'));
    const currentValue = previousValue;
    let newValue = currentValue;

    switch (operation) {
      case '+':
        newValue = currentValue + inputValue;
        break;
      case '−':
      case '-':
        newValue = currentValue - inputValue;
        break;
      case '×':
      case '*':
        newValue = currentValue * inputValue;
        break;
      case '÷':
      case '/':
        newValue = inputValue !== 0 ? currentValue / inputValue : 0;
        break;
      default:
        break;
    }

    newValue = Number(newValue.toFixed(6));
    const strVal = String(newValue).replace('.', ',');
    setFormulaHistory(`${currentValue} ${operation} ${displayValue} =`);
    setDisplayValue(strVal);
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(true);
  };

  const calculatePercentage = () => {
    const current = parseFloat(displayValue.replace(',', '.'));
    if (isNaN(current)) return;

    if (previousValue !== null && operation) {
      // Percentage of previous value (e.g., 200 + 10% = 20)
      const pctValue = (previousValue * current) / 100;
      setDisplayValue(String(Number(pctValue.toFixed(4))).replace('.', ','));
    } else {
      const pctValue = current / 100;
      setDisplayValue(String(Number(pctValue.toFixed(6))).replace('.', ','));
    }
  };

  const copyResult = () => {
    navigator.clipboard.writeText(displayValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Floating launcher trigger button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 rounded-2xl bg-brand-navy hover:bg-brand-navy-light text-white shadow-xl shadow-brand-navy/30 border-2 border-brand-gold/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
          title="Abrir Calculadora Móvel"
          aria-label="Abrir Calculadora Móvel"
        >
          <CalcIcon className="w-5 h-5 text-brand-gold" />
        </button>
      )}

      {/* Floating Calculator Window */}
      {isOpen && (
        <div
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
          className={`fixed z-50 transition-shadow select-none ${
            isMinimized
              ? 'w-64 rounded-2xl bg-white border border-slate-200 shadow-xl'
              : 'w-72 sm:w-80 rounded-3xl bg-white border border-slate-200 shadow-2xl'
          }`}
        >
          {/* Draggable Header */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-brand-navy to-brand-navy-light text-white rounded-t-3xl cursor-move touch-none border-b border-brand-navy-light/40"
          >
            <div className="flex items-center gap-1.5 text-xs font-black tracking-tight pointer-events-none">
              <Move className="w-3.5 h-3.5 text-brand-gold/80" />
              <span>Calculadora</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                title={isMinimized ? 'Expandir' : 'Minimizar'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-300 hover:text-rose-400 rounded-lg hover:bg-white/10 transition cursor-pointer"
                title="Fechar Calculadora"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Minimized View */}
          {isMinimized ? (
            <div className="p-3 flex items-center justify-between">
              <div className="truncate pr-2">
                <span className="text-[10px] text-slate-400 block">Resultado:</span>
                <span className="text-base font-black text-brand-navy truncate">{displayValue}</span>
              </div>
              <button
                type="button"
                onClick={copyResult}
                className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Copiar valor"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            /* Full Calculator View */
            <div className="p-3.5 space-y-3">
              {/* Display Screen */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-right relative overflow-hidden">
                <div className="text-[11px] font-mono text-slate-400 min-h-[16px] truncate">
                  {formulaHistory || '\u00A0'}
                </div>
                <div className="text-2xl font-black text-brand-navy tracking-tight font-mono truncate mt-0.5">
                  {displayValue}
                </div>

                {/* Copy button */}
                <button
                  type="button"
                  onClick={copyResult}
                  className="absolute left-2.5 bottom-2.5 p-1 rounded-md text-slate-400 hover:text-brand-navy hover:bg-slate-200 transition cursor-pointer"
                  title="Copiar resultado"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Keypad Buttons Grid */}
              <div className="grid grid-cols-4 gap-1.5 text-sm font-bold">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={clearAll}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-rose-600 transition cursor-pointer active:scale-95"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={backspace}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer active:scale-95"
                  title="Apagar último dígito"
                >
                  ⌫
                </button>
                <button
                  type="button"
                  onClick={calculatePercentage}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer active:scale-95"
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => performOperation('÷')}
                  className={`py-2.5 rounded-xl font-black text-white transition cursor-pointer active:scale-95 ${
                    operation === '÷' ? 'bg-brand-blue' : 'bg-brand-navy hover:bg-brand-navy-light'
                  }`}
                >
                  ÷
                </button>

                {/* Row 2 */}
                <button
                  type="button"
                  onClick={() => inputDigit('7')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  7
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('8')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  8
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('9')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  9
                </button>
                <button
                  type="button"
                  onClick={() => performOperation('×')}
                  className={`py-2.5 rounded-xl font-black text-white transition cursor-pointer active:scale-95 ${
                    operation === '×' ? 'bg-brand-blue' : 'bg-brand-navy hover:bg-brand-navy-light'
                  }`}
                >
                  ×
                </button>

                {/* Row 3 */}
                <button
                  type="button"
                  onClick={() => inputDigit('4')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  4
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('5')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  5
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('6')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  6
                </button>
                <button
                  type="button"
                  onClick={() => performOperation('−')}
                  className={`py-2.5 rounded-xl font-black text-white transition cursor-pointer active:scale-95 ${
                    operation === '−' ? 'bg-brand-blue' : 'bg-brand-navy hover:bg-brand-navy-light'
                  }`}
                >
                  −
                </button>

                {/* Row 4 */}
                <button
                  type="button"
                  onClick={() => inputDigit('1')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  1
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('2')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  2
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('3')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  3
                </button>
                <button
                  type="button"
                  onClick={() => performOperation('+')}
                  className={`py-2.5 rounded-xl font-black text-white transition cursor-pointer active:scale-95 ${
                    operation === '+' ? 'bg-brand-blue' : 'bg-brand-navy hover:bg-brand-navy-light'
                  }`}
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  type="button"
                  onClick={toggleSign}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer active:scale-95 text-xs"
                >
                  ±
                </button>
                <button
                  type="button"
                  onClick={() => inputDigit('0')}
                  className="py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 transition cursor-pointer active:scale-95"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={inputDecimal}
                  className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black transition cursor-pointer active:scale-95"
                >
                  ,
                </button>
                <button
                  type="button"
                  onClick={calculateEquals}
                  className="py-2.5 rounded-xl bg-brand-gold hover:bg-brand-gold-hover text-brand-navy font-black shadow-sm transition cursor-pointer active:scale-95"
                >
                  =
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
