import { useState, useEffect, useRef } from 'react';
import { Terminal, Code, Copy, Check, ChevronDown } from 'lucide-react';

function CodeTogether({ socket }) {
  const [code, setCode] = useState('// Start pair programming here...\n\nfunction helloWorld() {\n  console.log("Hello from Antigravity!");\n}');
  const [language, setLanguage] = useState('javascript');
  const [terminalOutput, setTerminalOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef(null);

  // Regex-based lightweight syntax highlighter
  const highlightCode = (text, lang) => {
    if (!text) return '';
    
    // Escape HTML characters
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Basic Javascript/Python keywords
    const keywords = /\b(const|let|var|function|return|class|import|from|export|default|if|else|for|while|def|print|console|log|async|await|try|catch)\b/g;
    // Strings
    const strings = /(["'`])(.*?)\1/g;
    // Comments
    const comments = /(\/\/.*|#.*|\/\*[\s\S]*?\*\/)/g;
    // Numbers
    const numbers = /\b(\d+)\b/g;

    html = html
      .replace(comments, '<span class="text-gray-500 font-mono italic">$1</span>')
      .replace(strings, '<span class="text-emerald-400 font-mono">$1$2$1</span>')
      .replace(keywords, '<span class="text-purple-400 font-bold font-mono">$1</span>')
      .replace(numbers, '<span class="text-amber-400 font-mono">$1</span>');

    return html;
  };

  useEffect(() => {
    if (!socket) return;

    // Listen to live edits
    socket.on('code-change', ({ code: newCode }) => {
      setCode(newCode);
    });

    socket.on('code-language-change', ({ language: newLang }) => {
      setLanguage(newLang);
    });

    socket.on('terminal-output-change', ({ output: newOutput }) => {
      setTerminalOutput(newOutput);
    });

    return () => {
      socket.off('code-change');
      socket.off('code-language-change');
      socket.off('terminal-output-change');
    };
  }, [socket]);

  // Handle local text changes & emit
  const handleCodeChange = (e) => {
    const val = e.target.value;
    setCode(val);
    if (socket) {
      socket.emit('code-change', { code: val });
    }
  };

  // Handle local language change & emit
  const handleLanguageChange = (e) => {
    const val = e.target.value;
    setLanguage(val);
    if (socket) {
      socket.emit('code-language-change', { language: val });
    }
  };

  // Handle local terminal changes & emit
  const handleTerminalChange = (e) => {
    const val = e.target.value;
    setTerminalOutput(val);
    if (socket) {
      socket.emit('terminal-output-change', { output: val });
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate line numbers
  const lineNumbers = code.split('\n').map((_, index) => index + 1);

  return (
    <div className="flex flex-col h-full bg-[#070612]/95 border border-white/5 rounded-2xl overflow-hidden font-sans text-sm shadow-inner relative">
      
      {/* Editor top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Code className="text-purple-400" size={16} />
          <span className="text-xs font-bold text-white font-display">Code Together</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <div className="relative">
            <select
              value={language}
              onChange={handleLanguageChange}
              className="appearance-none bg-[#110f24] border border-white/10 hover:border-purple-500/50 text-gray-300 text-[10px] font-bold font-display pl-3 pr-8 py-1.5 rounded-lg cursor-pointer transition focus:outline-none focus:border-purple-500"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={10} />
          </div>

          {/* Copy code button */}
          <button
            onClick={handleCopyCode}
            className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 rounded-lg cursor-pointer transition flex items-center justify-center"
            title="Copy Code"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          </button>
        </div>
      </div>

      {/* Editor Core */}
      <div className="flex-grow min-h-0 flex relative bg-black/40 overflow-hidden font-mono">
        {/* Line numbers column */}
        <div className="w-10 bg-black/20 border-r border-white/5 py-4 select-none text-right pr-2 text-gray-600 text-xs flex flex-col font-mono leading-[20px]">
          {lineNumbers.map((num) => (
            <span key={num}>{num}</span>
          ))}
        </div>

        {/* Textarea container */}
        <div className="flex-1 relative h-full overflow-hidden">
          {/* Overlay highlighted preview */}
          <pre
            className="absolute inset-0 p-4 m-0 text-xs font-mono leading-[20px] pointer-events-none whitespace-pre-wrap break-all overflow-hidden text-transparent select-none z-0"
            dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
          />

          {/* Actual transparent input textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            placeholder="Type code here..."
            className="absolute inset-0 w-full h-full p-4 bg-transparent text-gray-200 focus:outline-none resize-none font-mono text-xs leading-[20px] whitespace-pre-wrap break-all border-none focus:ring-0 overflow-y-auto z-10"
            style={{ caretColor: '#a855f7' }}
          />
        </div>
      </div>

      {/* Shared Terminal Output Panel */}
      <div className="h-44 border-t border-white/5 flex flex-col bg-[#05040a] flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-1.5 bg-white/5 border-b border-white/5">
          <div className="flex items-center gap-1.5">
            <Terminal className="text-gray-400" size={14} />
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest font-display">Shared Terminal Output</span>
          </div>
          <span className="text-[9px] text-gray-500 italic">Pasted output syncs instantly</span>
        </div>

        <textarea
          value={terminalOutput}
          onChange={handleTerminalChange}
          placeholder="$ npm run build&#10;> vite build&#10;✓ built in 1.94s&#10;[Paste outputs here for all members to see...]"
          className="flex-grow w-full bg-[#05040a] text-emerald-400 p-3 font-mono text-[10px] leading-normal resize-none focus:outline-none scrollbar-thin border-none"
        />
      </div>

    </div>
  );
}

export default CodeTogether;
