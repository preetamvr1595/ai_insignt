
import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, ScatterChart, Scatter, Legend
} from 'recharts';
import { 
  LayoutDashboard, Database, FileText, Settings, Upload, Send, 
  ChevronRight, Download, Moon, Sun, Table as TableIcon, MessageSquare,
  Sparkles, DownloadCloud, FileSpreadsheet, Trash2, Github, XCircle, 
  FileJson, FileCode, ImageIcon, FileType, Check
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { analyzeData } from './services/geminiService';
import { Dataset, Message, AIResponse, AppTheme, DataRow } from './types';

// --- Utility: Robust CSV Parser ---
const parseCSV = (text: string): { headers: string[], rows: DataRow[] } => {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string) => {
    const result = [];
    let startValue = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuotes = !inQuotes;
      if (line[i] === ',' && !inQuotes) {
        result.push(line.substring(startValue, i).replace(/^"|"$/g, '').trim());
        startValue = i + 1;
      }
    }
    result.push(line.substring(startValue).replace(/^"|"$/g, '').trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = parseLine(line);
    const obj: DataRow = {};
    headers.forEach((header, i) => {
      const val = values[i];
      // Try to parse numbers, otherwise keep as string
      if (val !== undefined && val !== '' && !isNaN(Number(val.replace(/,/g, '')))) {
        obj[header] = Number(val.replace(/,/g, ''));
      } else {
        obj[header] = val;
      }
    });
    return obj;
  });

  return { headers, rows };
};

// --- Components ---

const SidebarItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none' 
        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const ChartView: React.FC<{ response: AIResponse; chartRef: React.RefObject<HTMLDivElement> }> = ({ response, chartRef }) => {
  const { chartType, chartData, xAxisLabel, yAxisLabel } = response;
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

  if (chartType === 'none' || !chartData || chartData.length === 0) return null;

  return (
    <div ref={chartRef} className="h-80 w-full mt-6 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-inner chart-container overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 'bar' ? (
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" fontSize={11} tick={{ fill: '#64748b' }} angle={-25} textAnchor="end" label={{ value: xAxisLabel, position: 'insideBottom', offset: -25, fontSize: 12 }} />
            <YAxis fontSize={11} tick={{ fill: '#64748b' }} label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', offset: 10, fontSize: 12 }} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
            <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : chartType === 'line' ? (
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" fontSize={11} tick={{ fill: '#64748b' }} />
            <YAxis fontSize={11} tick={{ fill: '#64748b' }} />
            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
            <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} dot={{ r: 5, fill: '#3b82f6' }} activeDot={{ r: 7 }} />
          </LineChart>
        ) : chartType === 'pie' ? (
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={8} dataKey="value" nameKey="name" animationDuration={1000}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        ) : (
          <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="x" name={xAxisLabel} fontSize={11} type="number" label={{ value: xAxisLabel, position: 'insideBottom', offset: -10 }} />
            <YAxis dataKey="y" name={yAxisLabel} fontSize={11} type="number" label={{ value: yAxisLabel, angle: -90, position: 'insideLeft' }} />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Data" data={chartData} fill="#3b82f6" />
          </ScatterChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(AppTheme.LIGHT);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'dataset' | 'chat'>('dashboard');
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Refs for chart elements to enable PNG/PDF export
  const chartRefs = useRef<{ [key: string]: React.RefObject<HTMLDivElement> }>({});

  useEffect(() => {
    if (theme === AppTheme.DARK) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const toggleTheme = () => setTheme(prev => prev === AppTheme.LIGHT ? AppTheme.DARK : AppTheme.LIGHT);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const { headers, rows } = parseCSV(text);
        if (headers.length === 0) throw new Error("Could not detect columns.");
        setDataset({ id: Math.random().toString(36).substr(2, 9), name: file.name, columns: headers, data: rows });
        setActiveTab('dataset');
      } catch (err) {
        alert("Invalid CSV format. Please ensure it's a valid CSV with a header row.");
      }
    };
    reader.readAsText(file);
  };

  const handleSendMessage = async (textOverride?: string) => {
    const query = textOverride || input;
    if (!query.trim() || !dataset || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: query, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await analyzeData(query, dataset, history);
      
      const assistantMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response.insight, 
        response, 
        timestamp: new Date() 
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      const errorMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: error.message, timestamp: new Date() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    chartRefs.current = {};
  };

  // --- Export Functions ---

  const downloadCSV = () => {
    if (!dataset) return;
    const headers = dataset.columns.join(',');
    const rows = dataset.data.map(row => dataset.columns.map(col => `"${row[col] ?? ''}"`).join(','));
    const content = [headers, ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InsightAI_${dataset.name.split('.')[0]}_export.csv`;
    a.click();
  };

  const downloadJSON = (message: Message) => {
    if (!message.response) return;
    const content = JSON.stringify(message.response, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InsightAI_Analysis_${message.id}.json`;
    a.click();
  };

  const downloadTXT = (message: Message) => {
    const content = `InsightAI Analysis Report\n\nQuery: ${message.content}\n\nSummary: ${message.response?.summary}\n\nInsights:\n${message.content}\n\nTimestamp: ${message.timestamp.toLocaleString()}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `InsightAI_Report_${message.id}.txt`;
    a.click();
  };

  const downloadPNG = async (messageId: string) => {
    const ref = chartRefs.current[messageId];
    if (!ref || !ref.current) return;
    
    setDownloading(messageId);
    try {
      const canvas = await html2canvas(ref.current, {
        backgroundColor: theme === AppTheme.DARK ? '#0f172a' : '#ffffff',
        scale: 2
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `InsightAI_Chart_${messageId}.png`;
      a.click();
    } catch (e) {
      console.error("PNG generation failed", e);
    } finally {
      setDownloading(null);
    }
  };

  const downloadPDF = async (message: Message) => {
    if (!message.response) return;
    setDownloading(message.id);
    
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(59, 130, 246); // Blue-600
      doc.text('InsightAI Report', 20, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`Generated on ${new Date().toLocaleString()}`, 20, 38);
      
      // Summary
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text('Executive Summary', 20, 50);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(message.response.summary, 20, 58, { maxWidth: 170 });
      
      // Details
      doc.setFont('helvetica', 'normal');
      doc.text(message.response.insight, 20, 70, { maxWidth: 170 });
      
      // Chart (if exists)
      const ref = chartRefs.current[message.id];
      if (ref && ref.current && message.response.chartType !== 'none') {
        const canvas = await html2canvas(ref.current, { scale: 1.5 });
        const imgData = canvas.toDataURL('image/png');
        // Add chart image to PDF
        doc.addPage();
        doc.text('Visualization', 20, 20);
        doc.addImage(imgData, 'PNG', 20, 30, 170, 100);
      }
      
      doc.save(`InsightAI_Full_Report_${message.id}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-500">
      
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col hidden lg:flex shadow-sm">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 dark:shadow-none">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold font-outfit tracking-tight">Insight<span className="text-blue-600">AI</span></h1>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={<Database size={20} />} label="Data Table" active={activeTab === 'dataset'} onClick={() => setActiveTab('dataset')} />
          <SidebarItem icon={<MessageSquare size={20} />} label="AI Chat" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
          <SidebarItem icon={<Settings size={20} />} label="Settings" />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-4">Storage</p>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
             <div className="flex justify-between text-xs mb-2">
               <span className="font-semibold">Local Storage</span>
               <span className="text-slate-500">2.4 MB</span>
             </div>
             <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
               <div className="w-1/4 h-full bg-blue-500"></div>
             </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
            <span className="capitalize">{activeTab}</span>
            <ChevronRight size={14} />
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[250px]">
              {dataset ? dataset.name : 'Ready for Analysis'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme} 
              className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400"
            >
              {theme === AppTheme.LIGHT ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            {dataset && (
               <button 
                 onClick={downloadCSV}
                 className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm shadow-md transition-transform hover:scale-105 active:scale-95"
               >
                 <DownloadCloud size={18} />
                 Download CSV
               </button>
            )}
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-8 relative scroll-smooth custom-scrollbar">
          
          {/* DASHBOARD VIEW */}
          {activeTab === 'dashboard' && (
            <div className="max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="mb-12">
                <h2 className="text-4xl font-bold font-outfit mb-4">Intelligent Data Insights.</h2>
                <p className="text-slate-500 text-lg">Upload your dataset to unlock the power of conversational analytics.</p>
              </div>

              {!dataset ? (
                <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-20 text-center hover:border-blue-500 dark:hover:border-blue-600 transition-all group relative cursor-pointer">
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                    <Upload className="text-blue-600 w-10 h-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Begin your project</h3>
                  <p className="text-slate-500 mb-10 text-lg">Drop a CSV file or click to browse</p>
                  <div className="inline-flex items-center gap-4 text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-6 py-2.5 rounded-full uppercase tracking-widest">
                    <span>Supports CSV</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span>Excel Ready</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div onClick={() => setActiveTab('dataset')} className="group p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:shadow-2xl transition-all cursor-pointer">
                      <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-100 transition-colors shadow-sm">
                        <FileSpreadsheet className="text-emerald-600 w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Explore Data</h3>
                      <p className="text-slate-500 leading-relaxed">View all {dataset.data.length} records in a clean tabular format with search capabilities.</p>
                   </div>
                   <div onClick={() => setActiveTab('chat')} className="group p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 hover:shadow-2xl transition-all cursor-pointer">
                      <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors shadow-sm">
                        <Sparkles className="text-blue-600 w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Ask InsightAI</h3>
                      <p className="text-slate-500 leading-relaxed">Generate instant charts and analytical reports using natural language prompts.</p>
                   </div>
                </div>
              )}
            </div>
          )}

          {/* TABLE VIEW */}
          {activeTab === 'dataset' && dataset && (
            <div className="animate-in fade-in duration-500">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
                 <div>
                   <h2 className="text-3xl font-bold font-outfit mb-2">{dataset.name}</h2>
                   <p className="text-slate-500 font-medium">
                     <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs mr-2">{dataset.columns.length} Columns</span>
                     {dataset.data.length.toLocaleString()} total rows
                   </p>
                 </div>
                 <div className="flex gap-3">
                   <button onClick={downloadCSV} className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50 transition-all">
                     <Download size={18} /> Download
                   </button>
                   <button onClick={() => {setDataset(null); setActiveTab('dashboard'); clearChat();}} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-xl hover:bg-red-100 transition-all">
                     <Trash2 size={24} />
                   </button>
                 </div>
               </div>
               
               <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                 <div className="overflow-auto max-h-[65vh]">
                   <table className="w-full text-left border-collapse">
                     <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 backdrop-blur-md z-10">
                       <tr>
                         {dataset.columns.map(c => (
                           <th key={c} className="px-6 py-5 text-[11px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                             {c}
                           </th>
                         ))}
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {dataset.data.slice(0, 200).map((r, i) => (
                         <tr key={i} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                           {dataset.columns.map(c => (
                             <td key={c} className="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                               {r[c]?.toString() || '-'}
                             </td>
                           ))}
                         </tr>
                       ))}
                     </tbody>
                   </table>
                   {dataset.data.length > 200 && (
                     <div className="p-8 text-center text-slate-400 font-medium bg-slate-50/50">
                        Showing first 200 of {dataset.data.length.toLocaleString()} rows.
                     </div>
                   )}
                 </div>
               </div>
            </div>
          )}

          {/* CHAT VIEW */}
          {activeTab === 'chat' && (
            <div className="max-w-4xl mx-auto flex flex-col min-h-full pb-32">
              {!dataset ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mt-10">
                  <Database className="text-slate-300 w-16 h-16 mb-6" />
                  <h3 className="text-2xl font-bold">No Dataset Active</h3>
                  <p className="text-slate-500 mt-3 max-w-sm leading-relaxed">Please upload a file to start asking questions and generating visualizations.</p>
                  <button onClick={() => setActiveTab('dashboard')} className="mt-8 px-10 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all">
                    Go to Dashboard
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-10">
                  <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-6">
                     <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-sm font-bold text-slate-600 uppercase tracking-tighter">Analyzing: {dataset.name}</span>
                     </div>
                     <button onClick={clearChat} className="text-xs font-bold text-slate-400 hover:text-red-500 flex items-center gap-2 transition-colors">
                        <XCircle size={16} /> Reset Context
                     </button>
                  </div>

                  {messages.length === 0 && (
                    <div className="py-20 text-center animate-in fade-in zoom-in duration-1000">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl rotate-3">
                        <Sparkles className="text-white w-10 h-10" />
                      </div>
                      <h3 className="text-3xl font-bold mb-4 font-outfit">Consult InsightAI</h3>
                      <p className="text-slate-500 max-w-lg mx-auto mb-12 text-lg leading-relaxed">Ask me to summarize trends, compare columns, or visualize complex relationships in your data.</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                        {[
                          "What are the main trends in this data?",
                          "Summarize categorical columns",
                          "Visualize top 10 records by value",
                          "Is there any correlation between columns?"
                        ].map(q => (
                          <button 
                            key={q} 
                            onClick={() => handleSendMessage(q)}
                            className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold hover:border-blue-500 hover:shadow-xl transition-all text-left flex items-center justify-between group shadow-sm"
                          >
                            <span className="max-w-[85%]">{q}</span>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map(m => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-5 duration-500`}>
                      <div className={`w-full max-w-[95%] p-8 rounded-3xl shadow-sm ${
                        m.role === 'user' 
                          ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 dark:shadow-none ml-10' 
                          : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 mr-10'
                      }`}>
                        {m.role === 'assistant' && (
                          <div className="flex items-center justify-between mb-6">
                            <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.3em] flex items-center gap-2">
                              <Sparkles size={14} /> Expert Analysis
                            </div>
                            {/* DOWNLOAD OPTIONS MENU */}
                            {m.response && (
                              <div className="flex items-center gap-2">
                                <div className="group relative">
                                  <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-all uppercase tracking-tighter">
                                    <Download size={14} /> Export Report
                                  </button>
                                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 space-y-1">
                                    <button onClick={() => downloadPDF(m)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-600 dark:text-slate-300">
                                      <FileType size={16} className="text-red-500" /> Full PDF Report
                                    </button>
                                    {m.response.chartType !== 'none' && (
                                      <button onClick={() => downloadPNG(m.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-600 dark:text-slate-300">
                                        <ImageIcon size={16} className="text-emerald-500" /> Export Chart as PNG
                                      </button>
                                    )}
                                    <button onClick={downloadCSV} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-600 dark:text-slate-300">
                                      <FileSpreadsheet size={16} className="text-blue-500" /> Processed CSV
                                    </button>
                                    <button onClick={() => downloadJSON(m)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-600 dark:text-slate-300">
                                      <FileJson size={16} className="text-amber-500" /> Raw Response JSON
                                    </button>
                                    <button onClick={() => downloadTXT(m)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all text-slate-600 dark:text-slate-300">
                                      <FileCode size={16} className="text-slate-500" /> Summary Text
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <p className={`text-base leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'font-semibold' : 'text-slate-700 dark:text-slate-200'}`}>
                          {m.content}
                        </p>
                        
                        {m.response && (
                          <div className="mt-8 animate-in fade-in duration-700 delay-200">
                            <h4 className="text-lg font-bold mb-3 font-outfit text-slate-900 dark:text-white">{m.response.summary}</h4>
                            
                            {/* Pass a specific ref for each message chart */}
                            {(() => {
                              if (!chartRefs.current[m.id]) {
                                chartRefs.current[m.id] = React.createRef<HTMLDivElement>();
                              }
                              return <ChartView response={m.response} chartRef={chartRefs.current[m.id]} />;
                            })()}
                            
                            {m.response.suggestion && (
                              <div className="mt-10 flex flex-col gap-3">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recommended Follow-up</span>
                                 <button 
                                  onClick={() => handleSendMessage(m.response!.suggestion)} 
                                  className="text-sm text-blue-500 hover:text-blue-700 font-bold text-left transition-colors flex items-center gap-2 group"
                                 >
                                   <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:scale-125 transition-all"></div>
                                   "{m.response.suggestion}"
                                 </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex justify-start">
                       <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 rounded-3xl w-full max-w-lg shadow-sm">
                          <div className="flex items-center gap-4 mb-6">
                             <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                             <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-48 animate-pulse"></div>
                          </div>
                          <div className="space-y-4">
                             <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-full animate-pulse"></div>
                             <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-5/6 animate-pulse"></div>
                             <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full w-3/4 animate-pulse"></div>
                          </div>
                          <div className="mt-8 h-40 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-pulse"></div>
                       </div>
                    </div>
                  )}

                  {downloading && (
                    <div className="fixed top-24 right-8 bg-blue-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-10 z-50">
                       <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                       <span className="font-bold text-sm">Generating your export...</span>
                    </div>
                  )}
                  
                  <div ref={chatEndRef} className="h-10" />
                </div>
              )}

              {/* Chat Input Bar */}
              {dataset && (
                <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-3xl px-6 lg:ml-36 z-30">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 group-focus-within:opacity-50 transition duration-1000"></div>
                    <input 
                      type="text" 
                      value={input} 
                      onChange={e => setInput(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()} 
                      placeholder="Ask a question about your data..." 
                      className="relative w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] py-6 px-8 pr-20 text-lg shadow-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                    <button 
                      onClick={() => handleSendMessage()} 
                      disabled={!input.trim() || loading} 
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-xl hover:bg-blue-700 disabled:opacity-30 disabled:grayscale transition-all active:scale-90"
                    >
                      {loading ? (
                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <Send size={24} />
                      )}
                    </button>
                  </div>
                  <div className="mt-4 flex justify-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Export as PDF</span>
                    <span className="flex items-center gap-2"><Check size={12} className="text-green-500" /> PNG Graphics</span>
                    <span className="flex items-center gap-2"><Check size={12} className="text-green-500" /> Smart Suggestions</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
