import { useState, useEffect } from 'react';
import { Plus, Trash2, ArrowRight, ArrowLeft, Loader, CheckCircle, LayoutGrid } from 'lucide-react';
import API from '../utils/api';
import { motion } from 'framer-motion';
import { ChunkyProgressBar } from './BrutalistAnim';

function TaskBoard({ socket, roomId, username }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/tasks/${roomId}`);
        setTasks(res.data);
        localStorage.setItem(`tasks-${roomId}`, JSON.stringify(res.data));
      } catch (err) {
        console.error('Error fetching tasks, falling back to cache:', err);
        try {
          const cached = localStorage.getItem(`tasks-${roomId}`);
          if (cached) {
            setTasks(JSON.parse(cached));
          }
        } catch (e) {
          console.error('Failed to load cached tasks:', e);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();

    // Socket.io task synchronization
    if (socket) {
      socket.on('task-added', (task) => {
        setTasks((prev) => [task, ...prev]);
      });

      socket.on('task-updated', (updatedTask) => {
        setTasks((prev) =>
          prev.map((t) => (t._id === updatedTask._id ? updatedTask : t))
        );
      });

      socket.on('task-deleted', ({ taskId }) => {
        setTasks((prev) => prev.filter((t) => t._id !== taskId));
      });
    }

    return () => {
      if (socket) {
        socket.off('task-added');
        socket.off('task-updated');
        socket.off('task-deleted');
      }
    };
  }, [roomId, socket]);
  useEffect(() => {
    if (roomId && tasks.length > 0) {
      localStorage.setItem(`tasks-${roomId}`, JSON.stringify(tasks));
    }
  }, [tasks, roomId]);
  // Create new task card
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    try {
      const res = await API.post('/tasks', {
        roomId,
        title: newTask.title,
        description: newTask.description,
        assignedTo: newTask.assignedTo || username,
      });

      setTasks((prev) => [res.data, ...prev]);
      if (socket) {
        socket.emit('task-added', res.data);
      }

      setNewTask({ title: '', description: '', assignedTo: '' });
      setShowAddForm(false);
    } catch (err) {
      console.error('Error creating task:', err);
    }
  };

  // Move task status
  const handleUpdateStatus = async (task, newStatus) => {
    try {
      const res = await API.put(`/tasks/${task._id}`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? res.data : t)));
      if (socket) {
        socket.emit('task-updated', res.data);
      }
    } catch (err) {
      console.error('Error updating task status:', err);
    }
  };

  // Delete task card
  const handleDeleteTask = async (taskId) => {
    try {
      await API.delete(`/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t._id !== taskId));
      if (socket) {
        socket.emit('task-deleted', { taskId });
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const renderTaskCard = (task) => (
    <motion.div
      key={task._id}
      initial={{ scale: 0.9, opacity: 0, y: 10 }}
      animate={task.status === 'done' ? { 
        scale: [1, 1.05, 1],
        boxShadow: ['0px 0px 0px rgba(0,0,0,0)', '4px 4px 0px 0px #10b981', '4px 4px 0px 0px #000'],
        opacity: 1,
        y: 0
      } : { scale: 1, opacity: 1, y: 0, boxShadow: '0px 0px 0px rgba(0,0,0,0)' }}
      transition={{ type: 'spring', stiffness: 350, damping: 15 }}
      className={`p-3 bg-white/5 border rounded-xl flex flex-col gap-2 shadow hover:border-purple-500/20 transition group ${
        task.status === 'done' ? 'border-emerald-500/30' : 'border-white/5'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <h5 className="text-xs font-bold text-white font-display truncate flex-1">{task.title}</h5>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => handleDeleteTask(task._id)}
          className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition cursor-pointer"
        >
          <Trash2 size={12} />
        </motion.button>
      </div>
      
      {task.description && <p className="text-[10px] text-gray-400 font-sans leading-relaxed">{task.description}</p>}
      
      <div className="flex justify-between items-center mt-1 border-t border-white/5 pt-2">
        <span className="text-[9px] bg-purple-500/10 border border-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-display">
          👤 {task.assignedTo}
        </span>
        
        {/* Status triggers */}
        <div className="flex gap-1.5">
          {task.status !== 'todo' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleUpdateStatus(task, task.status === 'done' ? 'in_progress' : 'todo')}
              className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition"
            >
              <ArrowLeft size={10} />
            </motion.button>
          )}
          {task.status !== 'done' && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => handleUpdateStatus(task, task.status === 'todo' ? 'in_progress' : 'done')}
              className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer transition"
            >
              <ArrowRight size={10} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0a19]/90 border border-white/5 rounded-2xl overflow-hidden relative font-sans">
      {/* Title */}
      <div className="bg-purple-950/20 border-b border-white/5 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="text-purple-400" size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 font-display">
            Shared Tasks Board
          </span>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1 rounded bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition"
        >
          <Plus size={14} />
        </motion.button>
      </div>

      {/* Main card panels columns */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 min-h-0 no-scrollbar">
        {loading ? (
          <div className="flex-grow flex items-center justify-center">
            <ChunkyProgressBar label="Syncing Tasks" />
          </div>
        ) : (
          ['todo', 'in_progress', 'done'].map((col) => {
            const list = tasks.filter((t) => t.status === col);
            return (
              <div key={col} className="w-56 flex-shrink-0 flex flex-col gap-3 bg-black/40 border border-white/5 p-3 rounded-2xl">
                <div className="flex justify-between items-center px-1">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-display">
                    {col === 'todo' ? 'To Do' : col === 'in_progress' ? 'In Progress' : 'Done'}
                  </h4>
                  <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-gray-300 font-sans font-semibold">
                    {list.length}
                  </span>
                </div>
                <div className="flex-grow flex flex-col gap-2.5 overflow-y-auto no-scrollbar">
                  {list.map(renderTaskCard)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Task Modal overlay */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTask}
          className="absolute bottom-16 left-4 right-4 p-4 glass rounded-2xl flex flex-col gap-3 border border-purple-500/25 shadow-2xl z-20 animate-fade-in-up"
        >
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-display">Create Task Card</h4>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-white cursor-pointer"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <input
            type="text"
            required
            placeholder="Task Title"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 font-sans"
          />
          <input
            type="text"
            placeholder="Task Description (Optional)"
            value={newTask.description}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 font-sans"
          />
          <input
            type="text"
            placeholder="Assignee Username"
            value={newTask.assignedTo}
            onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
            className="px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-purple-500 font-sans"
          />
          <button
            type="submit"
            className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition"
          >
            Add Task
          </button>
        </form>
      )}
    </div>
  );
}

export default TaskBoard;
