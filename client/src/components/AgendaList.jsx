import { useState, useEffect } from 'react';
import { Plus, CheckSquare, Square, Trash, ListTodo } from 'lucide-react';

function AgendaList({ socket, isHost }) {
  const [agendas, setAgendas] = useState([
    { id: 1, text: 'Sprint Planning & Backlog', checked: false },
    { id: 2, text: 'System Architecture Review', checked: false },
    { id: 3, text: 'Database Mongoose Schemas', checked: false },
    { id: 4, text: 'WebRTC Signaling Tests', checked: false },
    { id: 5, text: 'Deployment & QA verification', checked: false },
  ]);
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    if (socket) {
      socket.on('agenda-updated', (updatedAgendas) => {
        setAgendas(updatedAgendas);
      });
    }
    return () => {
      if (socket) {
        socket.off('agenda-updated');
      }
    };
  }, [socket]);

  // Toggle checklist checkbox
  const handleToggle = (id) => {
    const nextState = agendas.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setAgendas(nextState);

    if (socket) {
      socket.emit('agenda-updated', nextState);
    }
  };

  // Add agenda topic card
  const handleAddTopic = (e) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    const newItem = {
      id: Date.now(),
      text: newTopic.trim(),
      checked: false,
    };
    const nextState = [...agendas, newItem];
    setAgendas(nextState);
    setNewTopic('');

    if (socket) {
      socket.emit('agenda-updated', nextState);
    }
  };

  // Remove topic from list
  const handleDeleteTopic = (id) => {
    const nextState = agendas.filter((item) => item.id !== id);
    setAgendas(nextState);

    if (socket) {
      socket.emit('agenda-updated', nextState);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a19]/90 border border-white/5 rounded-2xl p-4 gap-4 overflow-y-auto no-scrollbar font-sans text-sm">
      
      {/* Title */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <ListTodo className="text-purple-400" size={16} />
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display">Meeting Agenda</h4>
      </div>

      {/* Agenda list */}
      <div className="flex flex-col gap-2">
        {agendas.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-xl hover:border-purple-500/10 transition group"
          >
            <div
              onClick={() => handleToggle(item.id)}
              className="flex items-center gap-3 cursor-pointer select-none flex-1 min-w-0"
            >
              {item.checked ? (
                <CheckSquare size={16} className="text-purple-400 flex-shrink-0" />
              ) : (
                <Square size={16} className="text-gray-500 flex-shrink-0" />
              )}
              <span className={`text-xs text-gray-200 truncate pr-2 font-medium ${item.checked ? 'line-through text-gray-500' : ''}`}>
                {item.text}
              </span>
            </div>
            
            {/* Host delete control */}
            {isHost && (
              <button
                onClick={() => handleDeleteTopic(item.id)}
                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
              >
                <Trash size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add Topic form (Only Host) */}
      {isHost && (
        <form onSubmit={handleAddTopic} className="mt-auto border-t border-white/5 pt-4 flex gap-2">
          <input
            type="text"
            required
            value={newTopic}
            onChange={(e) => setNewTopic(e.target.value)}
            placeholder="Add Sprint Topic..."
            className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 font-sans"
          />
          <button
            type="submit"
            className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl cursor-pointer transition flex items-center justify-center"
          >
            <Plus size={16} />
          </button>
        </form>
      )}
    </div>
  );
}

export default AgendaList;
