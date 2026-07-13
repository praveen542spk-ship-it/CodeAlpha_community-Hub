import { useEffect, useRef, useState } from 'react';
import { Square, Circle, Eraser, Trash2, Undo, Redo, Download, Edit3, Type, Minus } from 'lucide-react';

function Whiteboard({ socket }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#8b5cf6'); // purple-500
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState('pen'); // pen, rectangle, circle, line, eraser, text
  const [history, setHistory] = useState([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [showTextPrompt, setShowTextPrompt] = useState(false);

  const startPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions based on client bounding rect
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight || 480;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    contextRef.current = context;

    // Save initial blank canvas state to history
    const initialData = canvas.toDataURL();
    setHistory([initialData]);
    setHistoryStep(0);

    // Socket drawing listeners
    if (socket) {
      socket.on('drawing', (data) => {
        const { x0, y0, x1, y1, color: remoteColor, size: remoteSize, tool: remoteTool, type, text: remoteText } = data;
        
        if (type === 'draw') {
          drawOnCanvas(x0, y0, x1, y1, remoteColor, remoteSize, remoteTool, false);
        } else if (type === 'shape') {
          drawShapeOnCanvas(x0, y0, x1, y1, remoteColor, remoteSize, remoteTool, false);
        } else if (type === 'text') {
          drawTextOnCanvas(remoteText, x0, y0, remoteColor, remoteSize, false);
        }
      });

      socket.on('clear-board', () => {
        clearLocalBoard();
      });
    }

    return () => {
      if (socket) {
        socket.off('drawing');
        socket.off('clear-board');
      }
    };
  }, [socket]);

  // Handle canvas sizing dynamically on window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Keep backup of current drawing
      const tempImage = canvas.toDataURL();
      
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight || 480;

      const context = canvas.getContext('2d');
      context.lineCap = 'round';
      context.lineJoin = 'round';
      contextRef.current = context;

      // Restore drawing
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, 0, 0);
      };
      img.src = tempImage;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support touches and mouse clicks
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    const { x, y } = getCoordinates(e);
    startPosRef.current = { x, y };

    if (tool === 'text') {
      setTextPos({ x, y });
      setShowTextPrompt(true);
      return;
    }

    setIsDrawing(true);

    if (tool === 'pen' || tool === 'eraser') {
      contextRef.current.beginPath();
      contextRef.current.moveTo(x, y);
    }
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const startX = startPosRef.current.x;
    const startY = startPosRef.current.y;

    if (tool === 'pen' || tool === 'eraser') {
      const activeColor = tool === 'eraser' ? '#070611' : color;
      const prevX = startPosRef.current.x;
      const prevY = startPosRef.current.y;

      drawOnCanvas(prevX, prevY, x, y, activeColor, size, tool, true);
      startPosRef.current = { x, y };
    } else if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
      // For shapes, we want to redraw from history state to show live preview outline
      const img = new Image();
      img.onload = () => {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        contextRef.current.drawImage(img, 0, 0);
        drawShapeOnCanvas(startX, startY, x, y, color, size, tool, false);
      };
      img.src = history[historyStep];
    }
  };

  const stopDrawing = (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'pen' || tool === 'eraser') {
      contextRef.current.closePath();
      saveHistory();
    } else if (tool === 'rectangle' || tool === 'circle' || tool === 'line') {
      const { x, y } = getCoordinates(e);
      const startX = startPosRef.current.x;
      const startY = startPosRef.current.y;

      drawShapeOnCanvas(startX, startY, x, y, color, size, tool, true);
      saveHistory();
    }
  };

  // Raw drawing paths
  const drawOnCanvas = (x0, y0, x1, y1, brushColor, brushSize, brushTool, emit) => {
    const ctx = contextRef.current;
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();

    if (emit && socket) {
      socket.emit('drawing', {
        x0, y0, x1, y1,
        color: brushColor,
        size: brushSize,
        tool: brushTool,
        type: 'draw'
      });
    }
  };

  // Drawing static shapes
  const drawShapeOnCanvas = (x0, y0, x1, y1, brushColor, brushSize, shapeTool, emit) => {
    const ctx = contextRef.current;
    ctx.strokeStyle = brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    if (shapeTool === 'rectangle') {
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    } else if (shapeTool === 'circle') {
      const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
      ctx.arc(x0, y0, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shapeTool === 'line') {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.closePath();

    if (emit && socket) {
      socket.emit('drawing', {
        x0, y0, x1, y1,
        color: brushColor,
        size: brushSize,
        tool: shapeTool,
        type: 'shape'
      });
    }
  };

  // Draw Text block
  const drawTextOnCanvas = (textStr, x, y, textColor, textSize, emit) => {
    const ctx = contextRef.current;
    ctx.fillStyle = textColor;
    ctx.font = `${textSize * 4 + 12}px Space Grotesk`;
    ctx.fillText(textStr, x, y);

    if (emit && socket) {
      socket.emit('drawing', {
        x0: x,
        y0: y,
        color: textColor,
        size: textSize,
        text: textStr,
        type: 'text'
      });
    }
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (textInput.trim()) {
      drawTextOnCanvas(textInput, textPos.x, textPos.y, color, size, true);
      saveHistory();
    }
    setTextInput('');
    setShowTextPrompt(false);
  };

  // Save history state for undo/redo
  const saveHistory = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    
    const newHistory = history.slice(0, historyStep + 1);
    setHistory([...newHistory, dataUrl]);
    setHistoryStep(newHistory.length);
  };

  // Undo Action
  const handleUndo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      const img = new Image();
      img.onload = () => {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        contextRef.current.drawImage(img, 0, 0);
        setHistoryStep(prevStep);
      };
      img.src = history[prevStep];
    }
  };

  // Redo Action
  const handleRedo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      const img = new Image();
      img.onload = () => {
        contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        contextRef.current.drawImage(img, 0, 0);
        setHistoryStep(nextStep);
      };
      img.src = history[nextStep];
    }
  };

  // Clear Board local + remote
  const handleClear = () => {
    clearLocalBoard();
    saveHistory();
    if (socket) {
      socket.emit('clear-board');
    }
  };

  const clearLocalBoard = () => {
    const canvas = canvasRef.current;
    if (canvas && contextRef.current) {
      contextRef.current.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // PNG Export
  const handleExport = () => {
    const link = document.createElement('a');
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-[#070611] rounded-2xl border border-white/5 overflow-hidden relative">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-4 items-center justify-between p-3 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Brush Color */}
          <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-white/15 cursor-pointer">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
            />
          </div>

          {/* Size slider */}
          <input
            type="range"
            min="2"
            max="20"
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-20 accent-purple-500 h-1 rounded-full cursor-pointer bg-white/10"
          />

          <div className="h-6 w-px bg-white/10 mx-1"></div>

          {/* Tool Toggles */}
          {[
            { id: 'pen', icon: <Edit3 size={16} />, label: 'Pen' },
            { id: 'rectangle', icon: <Square size={16} />, label: 'Rect' },
            { id: 'circle', icon: <Circle size={16} />, label: 'Circle' },
            { id: 'line', icon: <Minus size={16} />, label: 'Line' },
            { id: 'text', icon: <Type size={16} />, label: 'Text' },
            { id: 'eraser', icon: <Eraser size={16} />, label: 'Eraser' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`p-2 rounded-lg cursor-pointer transition ${
                tool === t.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
              title={t.label}
            >
              {t.icon}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={historyStep <= 0}
            className="p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
            title="Undo"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyStep >= history.length - 1}
            className="p-2 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
            title="Redo"
          >
            <Redo size={16} />
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-lg text-red-400 hover:bg-red-950/20 hover:text-red-300 cursor-pointer transition"
            title="Clear Board"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-950/20 hover:text-emerald-300 cursor-pointer transition"
            title="Export PNG"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 w-full min-h-0 bg-[#070611] relative">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="block w-full h-full cursor-crosshair"
        />

        {/* Text Tool Prompt Modal */}
        {showTextPrompt && (
          <form
            onSubmit={handleTextSubmit}
            className="absolute p-3 glass rounded-xl flex gap-2 border border-purple-500/35 shadow-xl shadow-black/50 z-20"
            style={{ left: textPos.x, top: textPos.y }}
          >
            <input
              type="text"
              required
              autoFocus
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter text..."
              className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 font-sans"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold font-display cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowTextPrompt(false)}
              className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs cursor-pointer font-sans"
            >
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default Whiteboard;
