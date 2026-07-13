import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar, Clock, Users, ArrowLeft, Download, Award, BarChart2 } from 'lucide-react';
import API from '../utils/api';

function AnalyticsDashboard({ user, logout }) {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const [sumRes, histRes] = await Promise.all([
          API.get('/analytics/summary'),
          API.get('/analytics/history')
        ]);
        setSummary(sumRes.data);
        setHistory(histRes.data);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  const formatDuration = (sec) => {
    if (!sec) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    return `${hrs > 0 ? hrs + 'h ' : ''}${mins > 0 ? mins + 'm ' : ''}${secs}s`;
  };

  const handleExportCSV = () => {
    if (history.length === 0) {
      alert('No meeting history available to export.');
      return;
    }

    const headers = ['Room ID', 'Start Date', 'Start Time', 'End Time', 'Duration', 'Participants Count'];
    const rows = history.map(s => [
      s.roomId,
      new Date(s.startTime).toLocaleDateString(),
      new Date(s.startTime).toLocaleTimeString(),
      s.endTime ? new Date(s.endTime).toLocaleTimeString() : 'N/A',
      formatDuration(s.durationSeconds),
      s.participantCount
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `meeting-history-${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#040209]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-start bg-[#040209] relative overflow-hidden font-sans pb-16 text-gray-200">
      {/* Background ambient floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/5 relative z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-purple-400 hover:text-white transition duration-300 cursor-pointer"
            title="Back to Lobby"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold shadow-md shadow-purple-500/25">
              🚀
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-white tracking-tight leading-tight">Analytics Dashboard</h1>
              <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">Host Performance & Metrics</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-300 font-display">
              {user.username}
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 relative z-10 flex flex-col gap-8">
        
        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass rounded-3xl p-6 flex items-center gap-5 border border-white/10 shadow-lg hover:border-purple-500/20 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Calendar size={22} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider font-display">Meetings Hosted</span>
              <span className="text-3xl font-extrabold text-white font-mono mt-1">{summary?.totalMeetings || 0}</span>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 flex items-center gap-5 border border-white/10 shadow-lg hover:border-purple-500/20 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Clock size={22} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider font-display">Avg Call Duration</span>
              <span className="text-2xl font-extrabold text-white font-mono mt-1.5">{formatDuration(summary?.avgDurationSeconds)}</span>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 flex items-center gap-5 border border-white/10 shadow-lg hover:border-purple-500/20 transition-all duration-300">
            <div className="w-12 h-12 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
              <Users size={22} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-gray-400 font-bold uppercase tracking-wider font-display">Participants Guided</span>
              <span className="text-3xl font-extrabold text-white font-mono mt-1">
                {history.reduce((acc, curr) => acc + (curr.participantCount || 0), 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Charts and Active list split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Card */}
          <div className="lg:col-span-2 glass rounded-3xl p-6 flex flex-col gap-5 border border-white/10 shadow-lg">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5 font-display">
              <BarChart2 size={18} className="text-purple-400" /> Meetings Frequency
            </h2>
            <div className="w-full h-64 mt-2">
              {summary?.chartData && summary.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.chartData}>
                    <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} />
                    <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        background: '#0d0d21',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        color: '#fff',
                        fontFamily: 'sans-serif',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="meetings" fill="url(#colorMeetings)" radius={[6, 6, 0, 0]}>
                      <defs>
                        <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.2}/>
                        </linearGradient>
                      </defs>
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 italic">
                  No chart data available yet.
                </div>
              )}
            </div>
          </div>

          {/* Active Speakers Card */}
          <div className="glass rounded-3xl p-6 flex flex-col gap-4 border border-white/10 shadow-lg">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5 font-display">
              <Award size={18} className="text-yellow-400" /> Most Active Participants
            </h2>
            <p className="text-[11px] text-gray-400 leading-normal font-sans">
              Based on the speaking time registered during meeting calls hosted by you.
            </p>
            <div className="flex-1 flex flex-col gap-3 mt-2 overflow-y-auto no-scrollbar max-h-60">
              {!summary?.activeParticipants || summary.activeParticipants.length === 0 ? (
                <p className="text-xs text-gray-500 italic text-center my-auto">No speaking activity logged yet.</p>
              ) : (
                summary.activeParticipants.map((p, idx) => (
                  <div key={p.username} className="flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all duration-300">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-300 font-display">
                        #{idx + 1}
                      </div>
                      <span className="text-xs font-semibold text-white font-display">{p.username}</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-purple-400">{Math.floor(p.speakingTimeSeconds / 60)}m {p.speakingTimeSeconds % 60}s</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* History Table */}
        <div className="glass rounded-3xl p-6 flex flex-col gap-5 border border-white/10 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white font-display">Meeting Session History</h2>
            <button
              onClick={handleExportCSV}
              className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/20 text-xs font-bold font-display flex items-center gap-2 cursor-pointer transition"
            >
              <Download size={14} />
              <span>Export as CSV</span>
            </button>
          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-white/5">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-gray-400 font-bold uppercase tracking-wider font-display">
                  <th className="p-4">Room ID</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Time</th>
                  <th className="p-4">Duration</th>
                  <th className="p-4 text-center">Participants</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500 italic">No meetings hosted yet.</td>
                  </tr>
                ) : (
                  history.map((s) => (
                    <tr key={s._id} className="hover:bg-white/5 transition duration-200">
                      <td className="p-4 font-mono font-semibold text-purple-300">{s.roomId}</td>
                      <td className="p-4">{new Date(s.startTime).toLocaleDateString()}</td>
                      <td className="p-4">
                        {new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {s.endTime && ` - ${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                      </td>
                      <td className="p-4 font-mono font-medium">{formatDuration(s.durationSeconds)}</td>
                      <td className="p-4 text-center font-bold font-mono text-gray-300">{s.participantCount || 1}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}

export default AnalyticsDashboard;
