const { useState, useEffect, useRef } = React;

// --- Clean Starting Data (No Mock Data) ---
const MOCK_JOBS = [];
const MOCK_STUDENTS = [];
const MOCK_APPLICATIONS = [];

// --- Backend API helpers ---
// Points to the permanently-deployed backend on Render (works from anywhere, any device)
const API_BASE = 'https://placement-backend-mcne.onrender.com/api';

const api = {
  get: async (path) => {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`GET ${path} failed`);
    return res.json();
  },
  post: async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`POST ${path} failed`);
    return res.json();
  },
  put: async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`PUT ${path} failed`);
    return res.json();
  },
  del: async (path) => {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`DELETE ${path} failed`);
    return res.json();
  }
};

// Simple notification beep using the Web Audio API - no external sound file needed
const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) { /* audio not available, fail silently */ }
};

// Helper to calculate days remaining
const getDaysRemaining = (deadlineDate) => {
  if (!deadlineDate || deadlineDate === "Not Mentioned" || !deadlineDate.match(/\d/)) return { text: 'No specific deadline', color: 'var(--text-muted)' };
  const parsedStr = deadlineDate.replace(/(\d+)(st|nd|rd|th)/, "$1");
  const deadline = new Date(parsedStr);
  if (isNaN(deadline.getTime())) return { text: `Deadline: ${deadlineDate}`, color: 'var(--text-muted)' };
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diffTime = deadline - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return { text: 'Expired', color: 'var(--danger)' };
  if (diffDays === 0) return { text: 'Ends today', color: 'var(--warning)' };
  return { text: `${diffDays} days left`, color: 'var(--success)' };
};

// Generic PDF Preview Modal
const PdfViewerModal = ({ pdfData, onClose }) => (
  <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 animate-fade-in" style={{backdropFilter: 'blur(5px)'}}>
    <div className="glass-card w-11/12 h-5/6 flex flex-col relative" style={{border: '1px solid var(--primary)'}}>
       <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
         <h3 className="text-primary"><i className="fa-solid fa-file-pdf mr-2"></i> Document Preview</h3>
         <button className="btn btn-outline btn-sm" onClick={onClose}><i className="fa-solid fa-times"></i></button>
       </div>
       <iframe src={pdfData} className="w-full h-full rounded bg-white border-0"></iframe>
    </div>
  </div>
);

// --- Student Profile Builder (Locked State with Sem-wise Marksheet) ---
const StudentProfileBuilder = ({ student, onSave, isHrdMode }) => {
  const [formData, setFormData] = useState({
    name: student.name || '',
    email: student.email || '',
    usn: student.usn || '',
    branch: student.branch || '',
    currentSem: student.currentSem || 1,
    marks: student.marks || [{sem: 1, sgpa: ''}],
    classRank: student.classRank || '',
    achievements: student.achievements || '',
    skills: student.skills ? student.skills.join(', ') : '',
    marksheetPdf: student.marksheetPdf || null
  });

  const handleSemChange = (e) => {
    let sem = parseInt(e.target.value);
    if(isNaN(sem) || sem < 1) sem = 1;
    if(sem > 8) sem = 8;
    
    const newMarks = [];
    for(let i=1; i<=sem; i++) {
      newMarks.push(formData.marks[i-1] || { sem: i, sgpa: '' });
    }
    setFormData({...formData, currentSem: sem, marks: newMarks});
  };

  const handleMarkChange = (index, val) => {
    const updated = [...formData.marks];
    updated[index].sgpa = val;
    setFormData({...formData, marks: updated});
  };

  const calculateCGPA = () => {
    const valid = formData.marks.filter(m => m.sgpa && !isNaN(m.sgpa));
    if(valid.length === 0) return "0.00";
    const total = valid.reduce((acc, m) => acc + parseFloat(m.sgpa), 0);
    return (total / valid.length).toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...student,
      ...formData,
      cgpa: calculateCGPA(),
      skills: formData.skills.split(',').map(s => s.trim()),
      status: 'Pending'
    });
  };

  return (
    <div className="glass-card animate-fade-in" style={{maxWidth: '800px', margin: '2rem auto'}}>
      <h2 className="text-gradient mb-2"><i className="fa-solid fa-id-card mr-2"></i> Complete Your Profile</h2>
      <p className="text-muted mb-6">You must enter your complete academic details before you can access placement resources. HRD will review your details for approval.</p>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" className="form-control" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input type="email" className="form-control" required placeholder="Student's Login Email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} disabled={!isHrdMode && !!student.email} />
          </div>
          <div className="form-group">
            <label className="form-label">USN (Roll Number)</label>
            <input type="text" className="form-control" required value={formData.usn} onChange={e=>setFormData({...formData, usn: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Branch / Specialization</label>
            <input type="text" className="form-control" required value={formData.branch} onChange={e=>setFormData({...formData, branch: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Current Semester</label>
            <input type="number" className="form-control" required min="1" max="8" value={formData.currentSem} onChange={handleSemChange} />
          </div>

          {/* Dynamic Marksheet Panel */}
          <div className="form-group col-span-2" style={{gridColumn: 'span 2', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
            <label className="form-label mb-4 text-primary"><i className="fa-solid fa-graduation-cap mr-2"></i> Semester-wise Marksheet (SGPA)</label>
            <div className="grid grid-cols-4 gap-4">
              {formData.marks.map((m, idx) => (
                <div key={idx}>
                  <label className="text-xs text-muted">Sem {m.sem} SGPA</label>
                  <input type="number" step="0.01" min="0" max="10" className="form-control" required placeholder="e.g. 8.5" value={m.sgpa} onChange={e => handleMarkChange(idx, e.target.value)} />
                </div>
              ))}
            </div>
            <div className="mt-4 text-right flex justify-between items-center border-t border-gray-700 pt-4" style={{borderColor: 'var(--border-color)'}}>
              <div className="flex-1 text-left">
                <label className="text-xs text-muted block mb-1">Upload Marksheets (Merged PDF)</label>
                <input type="file" accept=".pdf" className="form-control" required={!formData.marksheetPdf} style={{padding: '0.4rem', fontSize: '0.8rem'}} onChange={(e) => {
                  const file = e.target.files[0];
                  if(file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setFormData({...formData, marksheetPdf: ev.target.result});
                    reader.readAsDataURL(file);
                  }
                }} />
                {formData.marksheetPdf && <span className="text-xs text-success mt-2 block"><i className="fa-solid fa-check-circle mr-1"></i> Marks PDF Loaded Successfully</span>}
              </div>
              <div className="ml-4">
                <span className="text-muted mr-2">Aggregate CGPA:</span> 
                <span className="badge badge-success text-lg">{calculateCGPA()}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Class Rank (Optional)</label>
            <input type="number" className="form-control" value={formData.classRank} onChange={e=>setFormData({...formData, classRank: e.target.value})} />
          </div>

          <div className="form-group col-span-2" style={{gridColumn: 'span 2'}}>
            <label className="form-label">Achievements & Certifications</label>
            <textarea className="form-control" rows="2" required placeholder="E.g. Smart India Hackathon Winner, AWS Certified Cloud Practitioner" value={formData.achievements} onChange={e=>setFormData({...formData, achievements: e.target.value})}></textarea>
          </div>
          <div className="form-group col-span-2" style={{gridColumn: 'span 2'}}>
            <label className="form-label">Technical Skills (comma-separated)</label>
            <input type="text" className="form-control" required placeholder="E.g. React, Node.js, Python, SQL" value={formData.skills} onChange={e=>setFormData({...formData, skills: e.target.value})} />
          </div>
        </div>
        <div className="flex justify-end mt-4 pt-4 border-t" style={{borderTop: '1px solid var(--border-color)'}}>
          <button type="submit" className="btn btn-primary"><i className="fa-solid fa-paper-plane mr-2"></i> Submit for HRD Approval</button>
        </div>
      </form>
    </div>
  );
};

// --- Student Profile View ---
const StudentProfileView = ({ student, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [profileTab, setProfileTab] = useState('info');

  if (isEditing) {
    return (
      <div className="animate-fade-in">
        <button className="btn btn-outline mb-4" onClick={() => setIsEditing(false)}>
          <i className="fa-solid fa-arrow-left mr-2"></i> Cancel Edit
        </button>
        <StudentProfileBuilder student={student} onSave={(updated) => { onUpdate(updated); setIsEditing(false); }} />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2>My Profile</h2>
        <div>
          <span className="badge badge-success mr-4"><i className="fa-solid fa-check-circle mr-1"></i> HRD Approved</span>
          <button className="btn btn-primary btn-sm" onClick={() => setIsEditing(true)}>
            <i className="fa-solid fa-pen mr-2"></i> Edit Details
          </button>
        </div>
      </div>

      <div className="flex mb-6 border-b border-gray-800">
        <button className={`px-6 py-3 font-bold text-lg transition-colors ${profileTab==='info' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-white'}`} onClick={()=>setProfileTab('info')}><i className="fa-solid fa-user mr-2"></i> Profile Details</button>
        <button className={`px-6 py-3 font-bold text-lg transition-colors ${profileTab==='pdf' ? 'border-b-2 border-primary text-primary' : 'text-muted hover:text-white'}`} onClick={()=>setProfileTab('pdf')}><i className="fa-solid fa-file-pdf mr-2"></i> View Exam Result PDF</button>
      </div>

      {profileTab === 'info' ? (
        <div className="animate-fade-in">
          <div className="glass-card mb-6">
            <h3 className="text-primary mb-4 border-b pb-2" style={{borderColor: 'var(--border-color)'}}><i className="fa-solid fa-user mr-2"></i> Personal Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-sm text-muted mb-1">Full Name</p><p className="font-bold">{student.name}</p></div>
              <div><p className="text-sm text-muted mb-1">USN</p><p className="font-bold">{student.usn}</p></div>
              <div><p className="text-sm text-muted mb-1">Email</p><p className="font-bold">{student.email}</p></div>
              <div><p className="text-sm text-muted mb-1">Branch</p><p className="font-bold">{student.branch}</p></div>
            </div>
          </div>

          <div className="glass-card mb-6">
            <div className="flex justify-between items-start mb-4 border-b pb-2" style={{borderColor: 'var(--border-color)'}}>
              <h3 className="text-primary"><i className="fa-solid fa-graduation-cap mr-2"></i> Academic Record</h3>
              <div>
                <span className="text-muted mr-3 text-sm">Approved Aggregate CGPA:</span>
                <span className="badge badge-success text-xl px-4 py-2">{student.cgpa}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><p className="text-sm text-muted mb-1">Current Semester</p><p className="font-bold">Semester {student.currentSem}</p></div>
              <div><p className="text-sm text-muted mb-1">Class Rank</p><p className="font-bold">{student.classRank || 'N/A'}</p></div>
            </div>
            <div className="bg-black bg-opacity-20 p-4 rounded mb-4 border" style={{borderColor: 'var(--border-color)'}}>
              <p className="text-sm text-muted mb-2">Semester-wise SGPA Breakdown:</p>
              <div className="flex gap-4 flex-wrap">
                {student.marks?.map(m => (
                  <div key={m.sem} className="bg-black bg-opacity-40 px-3 py-2 rounded text-center min-w-[80px]">
                    <div className="text-xs text-muted">Sem {m.sem}</div>
                    <div className="font-bold text-lg">{m.sgpa}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="glass-card">
            <h3 className="text-primary mb-4 border-b pb-2" style={{borderColor: 'var(--border-color)'}}><i className="fa-solid fa-trophy mr-2"></i> Skills & Achievements</h3>
            <div className="mb-4">
              <p className="text-sm text-muted mb-2">Achievements & Certifications</p>
              <p className="bg-black bg-opacity-20 p-3 rounded">{student.achievements}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-2">Technical Skills</p>
              <div className="flex flex-wrap gap-2">
                {student.skills?.map(sk => <span key={sk} className="badge badge-warning">{sk}</span>)}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in glass-card" style={{padding: '0', overflow: 'hidden'}}>
          <div className="p-4 border-b border-gray-800 bg-black bg-opacity-30">
             <h3 className="text-primary"><i className="fa-solid fa-file-pdf mr-2"></i> Student Result Sheet</h3>
          </div>
          {student.marksheetPdf ? (
            <iframe src={student.marksheetPdf} className="w-full rounded-b border-0 bg-white" style={{height: '600px'}}></iframe>
          ) : (
            <div className="py-16 text-center text-muted">
              <i className="fa-solid fa-file-excel text-5xl mb-4 opacity-50 block"></i>
              <p className="text-xl">No Exam Result PDF Uploaded</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Chatbot Component ---
const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { text: "Hi! I'm your AI Career Assistant. How can I help you today?", isBot: true }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { if (isOpen) scrollToBottom(); }, [messages, isOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages([...messages, { text: input, isBot: false }]);
    setInput('');
    setTimeout(() => {
      let reply = "I'm a mock AI, but normally I would analyze your request and provide interview tips or career advice!";
      if (input.toLowerCase().includes('interview')) reply = "For interviews, remember to use the STAR method. Need a mock question?";
      setMessages(prev => [...prev, { text: reply, isBot: true }]);
    }, 1000);
  };

  if (!isOpen) return <div className="chatbot-widget collapsed flex items-center justify-center" onClick={() => setIsOpen(true)}><i className="fa-solid fa-robot text-white text-2xl"></i></div>;

  return (
    <div className="chatbot-widget">
      <div className="chatbot-header">
        <span><i className="fa-solid fa-robot mr-2"></i> AI Assistant</span>
        <button className="btn-outline btn-sm" style={{border: 'none', color: 'white'}} onClick={() => setIsOpen(false)}><i className="fa-solid fa-times"></i></button>
      </div>
      <div className="chatbot-body">
        {messages.map((msg, idx) => <div key={idx} className={`chat-message ${msg.isBot ? 'chat-bot' : 'chat-user'}`}>{msg.text}</div>)}
        <div ref={messagesEndRef} />
      </div>
      <form className="chatbot-input" onSubmit={handleSend}>
        <input type="text" placeholder="Ask for career advice..." value={input} onChange={(e) => setInput(e.target.value)} />
        <button type="submit"><i className="fa-solid fa-paper-plane"></i></button>
      </form>
    </div>
  );
};

// --- Landing Page ---
const LandingPage = ({ onNavigate }) => (
  <div className="container animate-fade-in" style={{textAlign: 'center', paddingTop: '5rem'}}>
    <div style={{display: 'inline-block', padding: '0.5rem 1rem', background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', borderRadius: '9999px', marginBottom: '1.5rem', fontWeight: 600}}>
      <i className="fa-solid fa-bolt text-warning mr-2"></i> AI-Powered Career Ecosystem
    </div>
    <h1 style={{fontSize: '4rem', marginBottom: '1.5rem'}}>Next-Gen <span className="text-gradient">Placement Management</span></h1>
    <p style={{fontSize: '1.25rem', maxWidth: '800px', margin: '0 auto 3rem'}}>
      Seamlessly connecting students and HRD officers through intelligent NLP resume parsing, automated job matching, and smart email-to-job extraction.
    </p>
    <div className="flex justify-center gap-4">
      <button className="btn btn-primary" onClick={() => onNavigate('login_student')}><i className="fa-solid fa-user-graduate"></i> Student Portal</button>
      <button className="btn btn-outline" onClick={() => onNavigate('login_hrd')}><i className="fa-solid fa-building-user"></i> HRD Admin Portal</button>
    </div>
  </div>
);

// --- Auth Component ---
const AuthPage = ({ role, onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin({ role, email, name: email.split('@')[0] });
  };

  return (
    <div className="container flex items-center justify-center animate-fade-in" style={{minHeight: '80vh'}}>
      <div className="glass-card" style={{width: '100%', maxWidth: '400px'}}>
        <h2 className="text-center mb-4">{role === 'hrd' ? 'HRD Officer Login' : 'Student Login'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" required placeholder={role === 'student' ? 'e.g. 1rv20cs001@college.edu' : 'admin@college.edu'} value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input type="password" className="form-control" required placeholder="Enter your password..." value={password} onChange={e=>setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary w-full justify-center">Login <i className="fa-solid fa-arrow-right"></i></button>
        </form>
      </div>
    </div>
  );
};

// --- Resources Panel ---
const ResourcesPanel = ({ resources, onAddResource, isHrdMode }) => {
  const [search, setSearch] = useState('');
  const [newRes, setNewRes] = useState({ title: '', url: '', type: 'Link' });

  const filtered = resources.filter(r => r.title.toLowerCase().includes(search.toLowerCase()) || r.url.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = (e) => {
    e.preventDefault();
    onAddResource({ id: Date.now(), ...newRes });
    setNewRes({ title: '', url: '', type: 'Link' });
  };

  return (
    <div className="animate-fade-in">
      <h2>Placement Resources</h2>
      <div className="form-group mb-6 mt-4">
        <input type="text" className="form-control" placeholder="Search resources, links, flyers..." value={search} onChange={e=>setSearch(e.target.value)} />
      </div>

      {isHrdMode && (
        <div className="glass-card mb-6 border-primary">
          <h3 className="mb-4">Add New Resource</h3>
          <form onSubmit={handleAdd} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">Resource Title</label>
              <input type="text" className="form-control" required value={newRes.title} onChange={e=>setNewRes({...newRes, title: e.target.value})} />
            </div>
            <div className="flex-1">
              <label className="form-label">URL / Link</label>
              <input type="url" className="form-control" required value={newRes.url} onChange={e=>setNewRes({...newRes, url: e.target.value})} />
            </div>
            <div className="w-48">
              <label className="form-label">Type</label>
              <select className="form-control bg-dark" value={newRes.type} onChange={e=>setNewRes({...newRes, type: e.target.value})}>
                <option>Link</option>
                <option>Google Form</option>
                <option>Flyer</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary h-12 px-6">Add</button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {filtered.length === 0 ? <p className="text-muted col-span-2">No resources found.</p> : filtered.map(r => (
          <div key={r.id} className="glass-card flex justify-between items-center">
            <div>
              <h4 className="text-primary">{r.title}</h4>
              <span className="badge badge-warning mt-2 inline-block">{r.type}</span>
            </div>
            <a href={r.url} target="_blank" className="btn btn-outline btn-sm">Open <i className="fa-solid fa-external-link-alt ml-1"></i></a>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Multi-Resume Analyzer Manager ---
const ResumeManager = ({ student, jobs, onUpdateStudent }) => {
  const [roleInput, setRoleInput] = useState('');
  const [resumes, setResumes] = useState(student.resumes || []);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [activeAnalysis, setActiveAnalysis] = useState(null);

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!roleInput.trim()) { alert("Please enter the target role/field first."); return; }
    
    const reader = new FileReader();
    reader.onload = (ev) => {
       const newResume = {
         id: Date.now(),
         name: file.name,
         targetRole: roleInput,
         pdfData: ev.target.result,
         analyzedSkills: [],
         missingSkills: [],
         jobScores: [],
         isAnalyzed: false
       };

       const updated = [...resumes, newResume];
       setResumes(updated);
       onUpdateStudent({ ...student, resumes: updated });
       setRoleInput('');
    };
    reader.readAsDataURL(file);
  };

  const runAnalysis = (resume) => {
    setAnalyzingId(resume.id);
    setTimeout(() => {
       const allSkills = ['React', 'Node.js', 'AWS', 'Docker', 'Python', 'SQL', 'MongoDB', 'C++', 'Java', 'Machine Learning', 'GraphQL', 'Kubernetes', 'TypeScript', 'Agile'];
       const shuffled = allSkills.sort(() => 0.5 - Math.random());
       const analyzedSkills = shuffled.slice(0, 4);
       const missingSkills = shuffled.slice(4, 7);
       
       const activeJobs = jobs.filter(j => getDaysRemaining(j.deadline).text !== 'Expired');
       const jobScores = activeJobs.map(j => ({
          jobId: j.id,
          score: Math.floor(Math.random() * 40) + 50
       }));

       const updatedResume = {
         ...resume,
         analyzedSkills,
         missingSkills,
         jobScores,
         isAnalyzed: true
       };

       const updatedResumes = resumes.map(r => r.id === resume.id ? updatedResume : r);
       setResumes(updatedResumes);
       onUpdateStudent({ ...student, resumes: updatedResumes });
       setAnalyzingId(null);
       setActiveAnalysis(updatedResume);
    }, 2000);
  };

  if (activeAnalysis) {
    return (
      <div className="animate-fade-in">
        {previewPdf && <PdfViewerModal pdfData={previewPdf} onClose={() => setPreviewPdf(null)} />}
        <button className="btn btn-outline mb-4" onClick={() => setActiveAnalysis(null)}>
          <i className="fa-solid fa-arrow-left mr-2"></i> Back to Resumes
        </button>
        
        <div className="flex justify-between items-center mb-6">
          <h2><i className="fa-solid fa-robot mr-2 text-primary"></i> AI Analysis Dashboard</h2>
          <button className="btn btn-outline btn-sm" onClick={() => setPreviewPdf(activeAnalysis.pdfData)}><i className="fa-solid fa-eye mr-2"></i> View Resume</button>
        </div>

        <div className="glass-card mb-6 border-primary">
           <h3 className="text-main">{activeAnalysis.name}</h3>
           <p className="text-sm text-muted">Target Role: <b className="text-white">{activeAnalysis.targetRole}</b></p>
        </div>

        <div className="grid grid-cols-2 gap-8">
           <div className="glass-card">
              <h3 className="mb-4 border-b border-gray-800 pb-2"><i className="fa-solid fa-magnifying-glass-chart text-primary mr-2"></i> Skill Gap Analysis</h3>
              <p className="text-sm text-muted mb-2"><i className="fa-solid fa-check text-success mr-1"></i> Detected Skills</p>
              <div className="mb-6">{activeAnalysis.analyzedSkills.map(s => <span key={s} className="badge badge-success mr-2 mb-2 inline-block">{s}</span>)}</div>
              
              <p className="text-sm text-muted mb-2"><i className="fa-solid fa-exclamation-triangle text-warning mr-1"></i> Suggested Skills to Learn</p>
              <div>{activeAnalysis.missingSkills.map(s => <span key={s} className="badge badge-warning mr-2 mb-2 inline-block">{s}</span>)}</div>
           </div>
           
           <div className="glass-card">
              <h3 className="mb-4 border-b border-gray-800 pb-2"><i className="fa-solid fa-bullseye text-danger mr-2"></i> Top Job Matches</h3>
              {activeAnalysis.jobScores.length === 0 ? <p className="text-muted">No active jobs to match.</p> : activeAnalysis.jobScores.sort((a,b)=>b.score - a.score).map(js => {
                 const j = jobs.find(x => x.id === js.jobId);
                 if(!j) return null;
                 return (
                   <div key={js.jobId} className="flex justify-between items-center mb-3 bg-black bg-opacity-40 p-3 rounded border border-gray-800" style={{borderColor: 'var(--border-color)'}}>
                     <div>
                        <span className="block font-bold">{j.company}</span>
                        <span className="text-sm text-muted">{j.title}</span>
                     </div>
                     <div className="text-right">
                        <span className="text-lg badge badge-primary">{js.score}% Match</span>
                     </div>
                   </div>
                 );
              })}
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {previewPdf && <PdfViewerModal pdfData={previewPdf} onClose={() => setPreviewPdf(null)} />}
      <div className="flex justify-between items-center mb-6">
        <h2>Resume Manager</h2>
      </div>

      <div className="glass-card mb-8 border-primary">
        <h3 className="mb-4">Upload New Resume</h3>
        <p className="text-sm text-muted mb-4">You can upload multiple resumes tailored for different roles. Run the AI Analyzer to check your skills against active job openings.</p>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="form-label">Target Role / Field of Interest</label>
            <input type="text" className="form-control" placeholder="e.g. Full Stack Developer, Data Scientist" value={roleInput} onChange={e=>setRoleInput(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="form-label">Upload PDF</label>
            <input type="file" accept=".pdf" className="form-control" onChange={handleUpload} style={{padding: '0.6rem'}} />
          </div>
        </div>
      </div>

      <h3 className="mb-4">Uploaded Resumes</h3>
      {resumes.length === 0 ? <p className="text-muted">No resumes uploaded yet.</p> : (
        <div className="grid grid-cols-1 gap-4">
          {resumes.slice().reverse().map(res => (
            <div key={res.id} className="glass-card flex justify-between items-center border-gray-800" style={{borderColor: res.isAnalyzed ? 'var(--success)' : 'var(--border-color)'}}>
               <div>
                 <h4 className="text-main mb-1">{res.name}</h4>
                 <p className="text-sm text-muted">Target: <b className="text-white">{res.targetRole}</b></p>
               </div>
               <div className="flex gap-2">
                 <button className="btn btn-outline btn-sm" onClick={() => setPreviewPdf(res.pdfData)}><i className="fa-solid fa-eye mr-1"></i> Preview</button>
                 {res.isAnalyzed ? (
                    <button className="btn btn-success btn-sm" onClick={() => setActiveAnalysis(res)}><i className="fa-solid fa-chart-pie mr-1"></i> View Analysis</button>
                 ) : (
                    <button className="btn btn-primary btn-sm" disabled={analyzingId === res.id} onClick={() => runAnalysis(res)}>
                      {analyzingId === res.id ? <><i className="fa-solid fa-spinner fa-spin mr-1"></i> Analyzing...</> : <><i className="fa-solid fa-wand-magic-sparkles mr-1"></i> Run AI Analysis</>}
                    </button>
                 )}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


// --- Student Views ---
const StudentJobs = ({ jobs, onApply, onMissingResource }) => (
  <div className="animate-fade-in">
    <div className="flex justify-between items-center mb-8">
      <h2>Recommended Jobs</h2>
      <span className="badge badge-primary"><i className="fa-solid fa-wand-magic-sparkles mr-1"></i> AI Matched</span>
    </div>
    {jobs.length === 0 ? (
      <div className="glass-card text-center text-muted py-8"><i className="fa-solid fa-folder-open text-3xl mb-4"></i><p>No jobs available yet. Check back later.</p></div>
    ) : (
      <div className="grid grid-cols-2 gap-4">
        {jobs.filter(j => getDaysRemaining(j.deadline).text !== 'Expired').map(job => (
          <div key={job.id} className="glass-card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3>{job.title}</h3>
                <p className="mb-0 text-primary font-bold">{job.company} {job.location && job.location !== 'Not Mentioned' && <span className="text-muted font-normal">| {job.location}</span>}</p>
              </div>
              <span className="badge badge-success">Match: {Math.floor(Math.random() * 30 + 70)}%</span>
            </div>
            <div className="mb-4">{job.skills.map(s => <span key={s} className="badge badge-warning mr-2 mb-2 inline-block">{s}</span>)}</div>
            <div className="text-sm text-muted mb-4" style={{display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>{job.description && job.description !== 'Not Mentioned' ? job.description : ''}</div>
            <div className="flex justify-between items-center text-sm text-muted mb-4">
              <span><i className="fa-solid fa-money-bill-wave mr-1"></i> {job.salary}</span>
              <span><i className="fa-regular fa-clock mr-1"></i> {getDaysRemaining(job.deadline).text}</span>
            </div>
            <button className="btn btn-primary w-full justify-center" onClick={() => {
              if (job.applyLink) {
                 window.open(job.applyLink, '_blank');
                 onApply(job.id);
              } else {
                 onMissingResource(job);
              }
            }}>Apply Now <i className="fa-solid fa-external-link-alt ml-2"></i></button>
          </div>
        ))}
      </div>
    )}
  </div>
);

// --- HRD Views ---
const HRDJobCreator = ({ onAddJob }) => {
  const [creationMode, setCreationMode] = useState(null); 
  const [formData, setFormData] = useState({ title: '', company: '', location: '', salary: '', duration: '', eligibility: '', contact: '', deadline: '', skills: '', description: '', applyLink: '' });
  const [aiInput, setAiInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractedResult, setExtractedResult] = useState(null);

  const handleAddJob = (data) => {
    const newJob = { id: Date.now(), ...data, skills: Array.isArray(data.skills) ? data.skills : data.skills.split(',').map(s => s.trim()), status: 'Active' };
    onAddJob(newJob);
    setCreationMode(null);
    setFormData({ title: '', company: '', location: '', salary: '', duration: '', eligibility: '', contact: '', deadline: '', skills: '', description: '', applyLink: '' });
    setExtractedResult(null); setAiInput('');
  };

  const handleExtract = () => {
    setExtracting(true); setExtractedResult(null);
    setTimeout(() => {
      setExtracting(false);
      
      const text = aiInput;
      const lowerText = text.toLowerCase();
      
      let result = {
        title: "Not Mentioned", company: "Not Mentioned", location: "Not Mentioned", 
        salary: "Not Mentioned", duration: "Not Mentioned", eligibility: "Not Mentioned", 
        contact: "Not Mentioned", description: "Not Mentioned", applyLink: "", skills: [],
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
      
      if (text) {
        const titleMatch = text.match(/(?:Position|Role|Job Title|Title)\s*:\s*([^\n]+)/i);
        if (titleMatch) result.title = titleMatch[1].trim();
        else if (lowerText.includes('data')) result.title = "Data Scientist";
        else if (lowerText.includes('software engineer')) result.title = "Software Engineer";
        else if (lowerText.includes('developer')) result.title = "Software Developer";

        const companyMatch = text.match(/(?:Company|Organization|Employer)\s*:\s*([^\n]+)/i);
        if (companyMatch) result.company = companyMatch[1].trim();
        else {
           const looseCompany = text.match(/(?:at|from)\s+([A-Z][a-zA-Z0-9\s\.\&]{3,20}?)(?:\n|!|,|\s+we)/);
           if (looseCompany) result.company = looseCompany[1].trim();
        }

        const locMatch = text.match(/(?:Location|Job Location|Based in)\s*:\s*([^\n]+)/i);
        if (locMatch) result.location = locMatch[1].trim();

        const salaryMatch = text.match(/(?:CTC|Salary|Pay|Stipend|Compensation)(?:\s+Offered)?\s*:\s*([^\n]+)/i);
        if (salaryMatch) result.salary = salaryMatch[1].trim();
        else {
           const looseSalary = text.match(/(\₹\s*\d+(?:\.\d+)?\s*(?:LPA|lakhs?|k|K)|\$\d+(?:k|K)|[0-9]+\s*LPA)/i);
           if (looseSalary) result.salary = looseSalary[1].trim();
        }

        const durationMatch = text.match(/(?:Duration|Internship Period|Tenure)\s*:\s*([^\n]+)/i);
        if (durationMatch) result.duration = durationMatch[1].trim();

        const deadlineMatch = text.match(/(?:Last Date|Deadline|Apply By)(?:\s+to Apply)?\s*:\s*([^\n]+)/i);
        if (deadlineMatch) result.deadline = deadlineMatch[1].trim();

        const eligMatch = text.match(/(?:Eligibility|Qualifications?|Education)(?:\s+Criteria)?\s*:\s*([^\n]+)/i);
        if (eligMatch) result.eligibility = eligMatch[1].trim();
        else {
           const looseElig = text.match(/(B\.?E\.?|B\.?Tech|BCA|MCA|M\.?Tech)[^\n]*/i);
           if (looseElig) result.eligibility = looseElig[0].trim();
        }

        const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const phoneMatch = text.match(/\+?\d{1,3}[-\s]?\d{4,10}/);
        const contacts = [];
        if (emailMatch) contacts.push(emailMatch[0]);
        if (phoneMatch && phoneMatch[0].length >= 10) contacts.push(phoneMatch[0]);
        if (contacts.length > 0) result.contact = contacts.join(', ');

        const skillsMatch = text.match(/(?:Skills|Required Skills|Requirements)\s*:\s*([\s\S]*?)(?=\n[A-Z][a-z]+:|\n\n|$)/i);
        const techKeywords = ['react', 'node', 'python', 'java', 'sql', 'mysql', 'mongodb', 'aws', 'docker', 'machine learning', 'c++', 'javascript', 'html', 'css', 'api', 'full stack'];
        if (skillsMatch) {
            const rawSkills = skillsMatch[1];
            const foundSkills = techKeywords.filter(k => rawSkills.toLowerCase().includes(k)).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            result.skills = foundSkills.length > 0 ? foundSkills : rawSkills.split(',').map(s=>s.trim()).slice(0, 5);
        } else {
            const foundSkills = techKeywords.filter(k => lowerText.includes(k)).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            if (foundSkills.length > 0) result.skills = foundSkills;
        }

        const linkMatches = text.match(/(https?:\/\/[^\s]+)/g);
        if (linkMatches) {
          const formLink = linkMatches.find(l => l.includes('docs.google.com') || l.includes('forms'));
          result.applyLink = formLink || linkMatches[0];
        }

        result.description = text.substring(0, 200).replace(/\n/g, ' ') + (text.length > 200 ? "..." : "");
      }
      
      if (!result.skills || result.skills.length === 0) result.skills = ["Not Mentioned"];
      
      if (creationMode === 'link' && result.company === "Not Mentioned") {
         if (lowerText.includes('amazon')) result.company = "Amazon";
         else if (lowerText.includes('google')) result.company = "Google";
         else if (lowerText.includes('microsoft')) result.company = "Microsoft";
      }
      if (creationMode === 'pdf' && !aiInput) {
         result.title = "Systems Engineer"; result.company = "Tech Innovations PDF"; result.salary = "12 LPA"; result.skills = ["C++", "Java", "Networks"];
      }
      
      setExtractedResult(result);
    }, 1500);
  };

  return (
    <div className="animate-fade-in glass-card mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2>Post a Job</h2>
        {creationMode && <button className="btn btn-outline btn-sm" onClick={() => {setCreationMode(null); setExtractedResult(null);}}><i className="fa-solid fa-times mr-2"></i> Cancel</button>}
      </div>
      
      {!creationMode && (
        <div>
          <p className="mb-4">Select a method to create a new job posting:</p>
          <div className="flex gap-4">
            <button className="btn btn-outline flex-1 flex-col items-center py-4" onClick={() => setCreationMode('manual')}><i className="fa-solid fa-pen-to-square text-2xl mb-2 text-primary"></i>Manual Entry</button>
            <button className="btn btn-outline flex-1 flex-col items-center py-4" onClick={() => setCreationMode('email')}><i className="fa-solid fa-envelope text-2xl mb-2 text-warning"></i>Email Parser</button>
            <button className="btn btn-outline flex-1 flex-col items-center py-4" onClick={() => setCreationMode('pdf')}><i className="fa-solid fa-file-pdf text-2xl mb-2 text-danger"></i>PDF Extractor</button>
            <button className="btn btn-outline flex-1 flex-col items-center py-4" onClick={() => setCreationMode('link')}><i className="fa-solid fa-link text-2xl mb-2 text-success"></i>Link Extractor</button>
          </div>
        </div>
      )}

      {creationMode === 'manual' && (
        <form onSubmit={(e) => { e.preventDefault(); handleAddJob(formData); }} className="mt-4 animate-fade-in" style={{borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem'}}>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-group"><label className="form-label">Job Title</label><input type="text" className="form-control" required value={formData.title} onChange={e=>setFormData({...formData, title: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Company Name</label><input type="text" className="form-control" required value={formData.company} onChange={e=>setFormData({...formData, company: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-control" value={formData.location} onChange={e=>setFormData({...formData, location: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Salary / CTC</label><input type="text" className="form-control" required value={formData.salary} onChange={e=>setFormData({...formData, salary: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Duration</label><input type="text" className="form-control" value={formData.duration} onChange={e=>setFormData({...formData, duration: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Eligibility Criteria</label><input type="text" className="form-control" value={formData.eligibility} onChange={e=>setFormData({...formData, eligibility: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Contact Details</label><input type="text" className="form-control" value={formData.contact} onChange={e=>setFormData({...formData, contact: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Deadline</label><input type="text" className="form-control" value={formData.deadline} onChange={e=>setFormData({...formData, deadline: e.target.value})} /></div>
            <div className="form-group col-span-2"><label className="form-label">Application Link (Google Form, External Site)</label><input type="url" className="form-control" value={formData.applyLink} onChange={e=>setFormData({...formData, applyLink: e.target.value})} /></div>
            <div className="form-group col-span-2"><label className="form-label">Skills (comma separated)</label><input type="text" className="form-control" required value={formData.skills} onChange={e=>setFormData({...formData, skills: e.target.value})} /></div>
            <div className="form-group col-span-2"><label className="form-label">Job Description</label><textarea className="form-control" rows="3" value={formData.description} onChange={e=>setFormData({...formData, description: e.target.value})}></textarea></div>
          </div>
          <div className="flex justify-end mt-4"><button type="submit" className="btn btn-primary">Post Job</button></div>
        </form>
      )}

      {['email', 'pdf', 'link'].includes(creationMode) && (
        <div className="mt-4 animate-fade-in" style={{borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem'}}>
          {!extractedResult ? (
            <div className="form-group">
              {creationMode === 'pdf' ? <input type="file" accept=".pdf" className="form-control p-4" onChange={e => setAiInput(e.target.value)} /> : 
               creationMode === 'link' ? <input type="url" className="form-control" placeholder="Paste URL here..." value={aiInput} onChange={e => setAiInput(e.target.value)} /> :
               <textarea className="form-control email-textarea" placeholder="Paste email text here..." value={aiInput} onChange={e => setAiInput(e.target.value)}></textarea>}
              <button className="btn btn-primary mt-4" onClick={handleExtract} disabled={extracting || (!aiInput && creationMode !== 'pdf')}>
                {extracting ? "Extracting..." : "Extract Details"}
              </button>
            </div>
          ) : (
            <div className="border-primary glass-card p-4">
              <h4 className="text-success mb-4"><i className="fa-solid fa-check-circle mr-2"></i> Extraction Successful</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><b>Title:</b> {extractedResult.title}</div>
                <div><b>Company:</b> {extractedResult.company}</div>
                <div><b>Location:</b> {extractedResult.location}</div>
                <div><b>Salary:</b> {extractedResult.salary}</div>
                <div><b>Duration:</b> {extractedResult.duration}</div>
                <div><b>Eligibility:</b> {extractedResult.eligibility}</div>
                <div><b>Contact:</b> {extractedResult.contact}</div>
                <div><b>Deadline:</b> {extractedResult.deadline}</div>
                <div className="col-span-2"><b>Apply Link:</b> <a href={extractedResult.applyLink} target="_blank" className="text-primary">{extractedResult.applyLink || 'Not Found'}</a></div>
                <div className="col-span-2"><b>Skills:</b> {extractedResult.skills.join(', ')}</div>
                <div className="col-span-2"><b>Description:</b> {extractedResult.description}</div>
              </div>
              <div className="flex justify-end mt-4 pt-4 border-t" style={{borderTop: '1px solid var(--border-color)'}}>
                <button className="btn btn-primary" onClick={() => handleAddJob(extractedResult)}>Approve & Post Job</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const HRDAllJobs = ({ jobs, applications, onUpdateJob, onDeleteJob }) => {
  const [expandedId, setExpandedId] = useState(null);
  
  return (
    <div className="glass-card animate-fade-in p-0 overflow-hidden">
      <h3 className="p-4 border-b border-gray-800">All Job Postings</h3>
      {jobs.length === 0 ? <p className="text-muted p-4">No jobs have been posted yet.</p> : (
        <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)'}}>
              <th style={{padding: '1rem'}}>Job Title & Company</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Applicants</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map(job => {
              const timeRemaining = getDaysRemaining(job.deadline);
              const isActive = job.status === 'Active' && timeRemaining.text !== 'Expired';
              const applicantCount = applications.filter(a => a.jobId === job.id).length;
              const isExpanded = expandedId === job.id;
              
              return (
                <React.Fragment key={job.id}>
                  <tr style={{borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', background: isExpanded ? 'rgba(59,130,246,0.1)' : 'transparent', transition: 'all 0.2s'}} onClick={() => setExpandedId(isExpanded ? null : job.id)}>
                    <td style={{padding: '1rem'}}><b>{job.title}</b><br/><span className="text-sm text-muted">{job.company}</span></td>
                    <td><span className={`badge ${isActive ? 'badge-success' : 'badge-danger'}`} style={!isActive ? {background:'rgba(239,68,68,0.1)'} : {}}>{isActive ? 'Active' : 'Closed'}</span></td>
                    <td><span style={{color: timeRemaining.color, fontWeight: 500}}>{timeRemaining.text}</span></td>
                    <td><span className="badge badge-primary">{applicantCount} Students</span></td>
                    <td>
                      <button className="btn btn-outline btn-sm mr-2" onClick={(e) => {
                        e.stopPropagation();
                        const newTitle = prompt("Edit Job Title:", job.title);
                        if (newTitle) onUpdateJob({...job, title: newTitle});
                      }}><i className="fa-solid fa-pen"></i></button>
                      <button className="btn btn-outline btn-sm mr-2" style={{color: 'var(--danger)'}} onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Delete this job?")) onDeleteJob(job.id);
                      }}><i className="fa-solid fa-trash"></i></button>
                      <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-muted`}></i>
                    </td>
                  </tr>
                  
                  {isExpanded && (
                    <tr style={{borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)'}}>
                      <td colSpan="5" style={{padding: '1.5rem'}}>
                        <div className="grid grid-cols-2 gap-8 text-sm">
                           <div>
                              <p className="mb-2"><b>Location:</b> {job.location}</p>
                              <p className="mb-2"><b>Salary:</b> {job.salary}</p>
                              <p className="mb-2"><b>Duration:</b> {job.duration}</p>
                              <p className="mb-2"><b>Eligibility:</b> {job.eligibility}</p>
                              <p className="mb-2"><b>Contact:</b> {job.contact}</p>
                              <p className="mb-2 mt-4"><b>Skills Required:</b></p>
                              <div className="mb-4">{job.skills.map(s => <span key={s} className="badge badge-warning mr-2 mb-2 inline-block">{s}</span>)}</div>
                           </div>
                           <div style={{borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem'}}>
                              <p className="mb-2 text-primary font-bold">Job Description</p>
                              <p className="text-muted mb-4">{job.description}</p>
                              {job.applyLink && (
                                <p className="mb-2"><b>Application Link:</b> <a href={job.applyLink} target="_blank" className="text-primary hover:underline">{job.applyLink}</a></p>
                              )}
                           </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

const HRDNotifications = ({ notifications, onMarkRead }) => (
  <div className="animate-fade-in">
    <h2>HRD Notifications</h2>
    {notifications.length === 0 ? <div className="glass-card mt-4"><p className="text-muted">No notifications right now.</p></div> : (
      <div className="mt-4">
        {notifications.slice().reverse().map(n => (
          <div key={n.id} className={`glass-card mb-4 flex justify-between items-center ${n.read ? 'opacity-50' : 'border-primary'}`}>
            <div>
              <p className="mb-1">{n.message}</p>
              <span className="text-xs text-muted">{new Date(n.date).toLocaleString()}</span>
            </div>
            {!n.read && <button className="btn btn-outline btn-sm" onClick={() => onMarkRead(n.id)}>Mark Read</button>}
          </div>
        ))}
      </div>
    )}
  </div>
);

const StudentNotifications = ({ notifications, readIds, onMarkRead }) => (
  <div className="animate-fade-in">
    <h2>Notifications</h2>
    {notifications.length === 0 ? <div className="glass-card mt-4"><p className="text-muted">No notifications yet.</p></div> : (
      <div className="mt-4">
        {notifications.map(n => {
          const isRead = readIds.includes(n.id);
          return (
            <div key={n.id} className={`glass-card mb-4 flex justify-between items-center ${isRead ? 'opacity-50' : 'border-primary'}`}>
              <div>
                <p className="mb-1">
                  {n.studentId === null && <span className="badge badge-primary" style={{marginRight: '0.5rem', fontSize: '0.7rem'}}>All Students</span>}
                  {n.message}
                </p>
                <span className="text-xs text-muted">{new Date(n.date).toLocaleString()}</span>
              </div>
              {!isRead && <button className="btn btn-outline btn-sm" onClick={() => onMarkRead(n.id)}>Mark Read</button>}
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const HRDStudentRequests = ({ students, onApprove, onReject }) => {
  const [previewPdf, setPreviewPdf] = useState(null);
  const pending = students.filter(s => s.status === 'Pending');
  
  if (pending.length === 0) return <div className="glass-card"><p className="text-muted"><i className="fa-solid fa-check-circle text-success mr-2"></i>No pending student approval requests.</p></div>;

  return (
    <div className="animate-fade-in">
      {previewPdf && <PdfViewerModal pdfData={previewPdf} onClose={() => setPreviewPdf(null)} />}
      <h2 className="mb-4">Student Approval Requests</h2>
      {pending.map(s => (
        <div key={s.id} className="glass-card mb-4 border-warning">
          <div className="flex justify-between items-start">
             <div className="flex-1 mr-4">
               <h3 className="text-primary">{s.name} <span className="text-sm text-muted">({s.usn})</span></h3>
               <p className="mt-2 text-sm"><b>Branch:</b> {s.branch} | <b>Sem:</b> {s.currentSem}</p>
               <div className="mt-2 p-2 rounded" style={{background: 'rgba(0,0,0,0.2)'}}>
                  <p className="text-xs text-muted mb-1">Semester Breakdown:</p>
                  <div className="flex gap-3 flex-wrap">
                     {s.marks?.map(m => <span key={m.sem} className="text-sm"><b>S{m.sem}:</b> {m.sgpa}</span>)}
                  </div>
               </div>
               <p className="text-sm mt-2"><b>Calculated CGPA:</b> {s.cgpa} | <b>Rank:</b> {s.classRank || 'N/A'}</p>
               <p className="mt-2"><b>Achievements:</b> <span className="text-muted">{s.achievements}</span></p>
               <p className="mt-1"><b>Skills:</b> {s.skills.map(sk => <span key={sk} className="badge badge-warning mr-1 text-xs">{sk}</span>)}</p>
             </div>
             <div className="flex flex-col gap-2">
               <button className="btn btn-success btn-sm" onClick={() => { onApprove(s.id); alert(`Approval email sent to ${s.email}`); }}><i className="fa-solid fa-check mr-1"></i> Approve</button>
               {s.marksheetPdf && <button className="btn btn-outline btn-sm border-primary text-primary" onClick={() => setPreviewPdf(s.marksheetPdf)}><i className="fa-solid fa-eye mr-1"></i> View Result Sheet</button>}
               <button className="btn btn-outline btn-sm" style={{borderColor:'var(--danger)', color:'var(--danger)'}} onClick={() => {
                 const reason = prompt("Enter rejection reason to email to the student:");
                 if(reason) { onReject(s.id, reason); alert(`Rejection email sent to ${s.email}`); }
               }}><i className="fa-solid fa-times mr-1"></i> Reject</button>
             </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const HRDAllStudents = ({ students, applications, jobs, onUpdate, onDelete, onAddClick }) => {
  const [expandedId, setExpandedId] = useState(null);
  const [searchUsn, setSearchUsn] = useState('');
  const [activeBranch, setActiveBranch] = useState('All');
  const [previewPdf, setPreviewPdf] = useState(null);
  
  const approved = students.filter(s => s.status === 'Approved');
  const branches = ['All', ...new Set(approved.map(s => s.branch).filter(Boolean))];
  
  const filtered = approved.filter(s => {
    const matchUsn = s.usn.toLowerCase().includes(searchUsn.toLowerCase());
    const matchBranch = activeBranch === 'All' || s.branch === activeBranch;
    return matchUsn && matchBranch;
  });
  
  return (
    <div className="animate-fade-in">
      {previewPdf && <PdfViewerModal pdfData={previewPdf} onClose={() => setPreviewPdf(null)} />}
      <div className="flex justify-between items-center mb-4">
        <h2>Approved Students Database</h2>
        <button className="btn btn-primary btn-sm" onClick={onAddClick}><i className="fa-solid fa-user-plus mr-2"></i> Add Student</button>
      </div>
      
      <div className="flex justify-between items-center mb-4 gap-4">
        <div className="flex flex-wrap gap-2">
          {branches.map(b => (
             <button key={b} className={`btn btn-sm ${activeBranch === b ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveBranch(b)}>{b}</button>
          ))}
        </div>
        <div className="form-group w-64 mb-0">
          <input type="text" className="form-control" placeholder="Search by [XXXXXXXXXX] OF USN" value={searchUsn} onChange={e=>setSearchUsn(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? <div className="glass-card"><p className="text-muted">No students found matching criteria.</p></div> : (
        <div className="glass-card p-0" style={{overflow: 'hidden'}}>
          <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)'}}>
                <th style={{padding: '1rem'}}>Student Name</th>
                <th>USN</th>
                <th>Branch</th>
                <th>CGPA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const studentApps = applications.filter(a => a.studentId === s.id);
                const isExpanded = expandedId && expandedId.toString().startsWith(s.id.toString());
                const activeTab = expandedId && expandedId.toString().endsWith('-pdf') ? 'pdf' : 'details';
                
                return (
                  <React.Fragment key={s.id}>
                    <tr style={{borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', cursor: 'pointer', background: isExpanded ? 'rgba(59,130,246,0.1)' : 'transparent', transition: 'all 0.2s'}} onClick={() => setExpandedId(isExpanded ? null : `${s.id}-details`)}>
                      <td style={{padding: '1rem'}}><b>{s.name}</b></td>
                      <td>{s.usn}</td>
                      <td>{s.branch} <span className="text-sm text-muted">(Sem {s.currentSem})</span></td>
                      <td><span className="badge badge-success">{s.cgpa}</span></td>
                      <td>
                        <button className="btn btn-outline btn-sm mr-2" onClick={(e) => {
                           e.stopPropagation();
                           const newCgpa = prompt(`Edit CGPA for ${s.name}:`, s.cgpa);
                           if(newCgpa) onUpdate({...s, cgpa: newCgpa});
                        }}><i className="fa-solid fa-pen"></i></button>
                        <button className="btn btn-outline btn-sm mr-2" style={{color:'var(--danger)', borderColor:'rgba(239,68,68,0.3)'}} onClick={(e) => {
                           e.stopPropagation();
                           if(confirm(`Delete student ${s.name}?`)) onDelete(s.id);
                        }}><i className="fa-solid fa-trash"></i></button>
                        <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-muted`}></i>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr style={{borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)'}}>
                        <td colSpan="5" style={{padding: '0'}}>
                          <div className="flex border-b border-gray-800 bg-black bg-opacity-40">
                             <button className={`px-6 py-3 font-bold text-sm flex-1 transition-colors ${activeTab === 'details' ? 'border-b-2 border-primary text-primary bg-black bg-opacity-30' : 'text-muted hover:text-white'}`} onClick={(e) => { e.stopPropagation(); setExpandedId(`${s.id}-details`); }}><i className="fa-solid fa-user-graduate mr-2"></i> Academic Breakdown & Applications</button>
                             <button className={`px-6 py-3 font-bold text-sm flex-1 transition-colors ${activeTab === 'pdf' ? 'border-b-2 border-primary text-primary bg-black bg-opacity-30' : 'text-muted hover:text-white'}`} onClick={(e) => { e.stopPropagation(); setExpandedId(`${s.id}-pdf`); }}><i className="fa-solid fa-file-pdf mr-2"></i> View Exam Result PDF</button>
                          </div>
                          
                          <div style={{padding: '1.5rem'}}>
                            {activeTab === 'details' ? (
                              <div className="grid grid-cols-2 gap-8 animate-fade-in">
                                 <div>
                                    <p className="text-sm text-muted mb-1">Academic Breakdown</p>
                                    <p className="mb-2 text-sm">Rank: <b>{s.classRank || 'N/A'}</b></p>
                                    <div className="flex gap-2 mb-4 flex-wrap">
                                      {s.marks?.map(m => <span key={m.sem} className="bg-black bg-opacity-40 px-2 py-1 rounded text-xs border border-gray-800" style={{borderColor:'var(--border-color)'}}>S{m.sem}: {m.sgpa}</span>)}
                                    </div>
                                    <p className="text-sm text-muted mb-1">Achievements & Skills</p>
                                    <p className="mb-2 text-sm">{s.achievements}</p>
                                    <div className="mt-2">{s.skills.map(sk => <span key={sk} className="badge badge-warning mr-1 text-xs">{sk}</span>)}</div>
                                 </div>
                                 <div style={{borderLeft: '1px solid var(--border-color)', paddingLeft: '2rem'}}>
                                    <p className="text-sm text-muted mb-3">Job Applications ({studentApps.length})</p>
                                    {studentApps.length === 0 ? <span className="text-sm text-muted">No applications yet.</span> : (
                                      <ul style={{listStyle:'none', padding:0, margin:0, fontSize:'0.9rem'}}>
                                        {studentApps.map(app => {
                                          const job = jobs.find(j => j.id === app.jobId);
                                          return <li key={app.id} className="mb-2 bg-black bg-opacity-40 p-3 rounded border border-gray-800" style={{borderColor:'var(--border-color)'}}><i className="fa-solid fa-briefcase text-primary mr-2"></i><b>{job?.company}</b> - {job?.title} <br/><span className="text-xs text-warning mt-1 inline-block"><i className="fa-solid fa-clock mr-1"></i>Status: {app.status}</span></li>
                                        })}
                                      </ul>
                                    )}
                                 </div>
                              </div>
                            ) : (
                              <div className="animate-fade-in">
                                {s.marksheetPdf ? (
                                  <iframe src={s.marksheetPdf} className="w-full rounded border-0 bg-white" style={{height: '500px'}}></iframe>
                                ) : (
                                  <div className="py-12 text-center text-muted">
                                    <i className="fa-solid fa-file-excel text-4xl mb-4 opacity-50 block"></i>
                                    <p>No Exam Result PDF Uploaded</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- Main App ---
const App = () => {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('np_user')) || null); 
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem('np_view');
    const savedUser = JSON.parse(localStorage.getItem('np_user'));
    if (!savedUser && saved === 'dashboard') return 'landing';
    return saved || 'landing';
  }); 
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('np_activeTab') || 'home');
  
  const [jobs, setJobs] = useState([]);
  const [students, setStudents] = useState([]);
  const [applications, setApplications] = useState([]);

  const [resources, setResources] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // --- Student-facing notifications (broadcast job updates + targeted status changes) ---
  const [studentNotifications, setStudentNotifications] = useState([]);
  const [studentReadIds, setStudentReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('np_student_read_notifs')) || []; }
    catch (e) { return []; }
  });
  const [toast, setToast] = useState(null); // { id, message }
  const knownStudentNotifIds = useRef(new Set());
  const isFirstStudentNotifLoad = useRef(true);

  // Persistence Effects (only UI nav state stays in localStorage; real data lives in MySQL)
  useEffect(() => { localStorage.setItem('np_user', JSON.stringify(user)); }, [user]);
  useEffect(() => { localStorage.setItem('np_view', view); }, [view]);
  useEffect(() => { localStorage.setItem('np_activeTab', activeTab); }, [activeTab]);
  useEffect(() => { localStorage.setItem('np_student_read_notifs', JSON.stringify(studentReadIds)); }, [studentReadIds]);

  // Auto-dismiss the toast popup after a few seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  // Load everything from the MySQL-backed API on first mount
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [jobsData, studentsData, applicationsData, resourcesData, notificationsData] = await Promise.all([
          api.get('/jobs'),
          api.get('/students'),
          api.get('/applications'),
          api.get('/resources'),
          api.get('/notifications')
        ]);
        setJobs(jobsData);
        setStudents(studentsData);
        setApplications(applicationsData);
        setResources(resourcesData);
        setNotifications(notificationsData);
      } catch (err) {
        console.error('Failed to load data from backend:', err);
        alert('Could not connect to the backend server. Make sure start_backend.bat is running, then refresh this page.');
      } finally {
        setDataLoading(false);
      }
    };
    loadAll();
  }, []);

  const handleLogin = async (userData) => {
    if (userData.role === 'student') {
      let existing = students.find(s => s.email === userData.email);
      if (!existing) {
        const newStudentData = { email: userData.email, name: userData.name, status: 'Incomplete' };
        try {
          const result = await api.post('/students', newStudentData);
          existing = { ...newStudentData, id: result.id };
          setStudents([...students, existing]);
        } catch (err) {
          alert('Could not save your account to the database. Check that the backend server is running.');
          return;
        }
      }
      setUser({ ...userData, studentId: existing.id });
    } else {
      setUser(userData);
    }
    setView('dashboard');
    setActiveTab('home');
  };

  const handleMissingResource = async (job) => {
    alert(`No direct application link or resource found for ${job.company}. We have notified HRD. Redirecting you to the Resources panel to check for other materials.`);
    const newNotif = {
      message: `Student ${currentStudent.name} (${currentStudent.usn}) requested application resources for "${job.title}" at ${job.company}.`,
      date: new Date().toISOString()
    };
    try {
      const result = await api.post('/notifications', newNotif);
      setNotifications(prev => [{ ...newNotif, id: result.id, read: false }, ...prev]);
    } catch (err) {
      console.error('Failed to save notification:', err);
    }
    setActiveTab('resources');
  };

  // --- Centralized mutation helpers: update local state AND persist to MySQL ---
  const updateStudent = async (updatedStudent) => {
    setStudents(students.map(x => x.id === updatedStudent.id ? updatedStudent : x));
    try { await api.put(`/students/${updatedStudent.id}`, updatedStudent); }
    catch (err) { console.error('Failed to save student update:', err); }
  };

  const deleteStudent = async (id) => {
    setStudents(students.filter(s => s.id !== id));
    try { await api.del(`/students/${id}`); }
    catch (err) { console.error('Failed to delete student:', err); }
  };

  const addStudent = async (newStudent) => {
    try {
      const result = await api.post('/students', newStudent);
      setStudents([...students, { ...newStudent, id: result.id }]);
    } catch (err) {
      console.error('Failed to save new student:', err);
      alert('Could not save student to the database.');
    }
  };

  const broadcastStudentNotif = async (message) => {
    try { await api.post('/notifications', { message, date: new Date().toISOString(), audience: 'student', studentId: null }); }
    catch (err) { console.error('Failed to broadcast notification:', err); }
  };

  const notifyStudent = async (studentId, message) => {
    try { await api.post('/notifications', { message, date: new Date().toISOString(), audience: 'student', studentId }); }
    catch (err) { console.error('Failed to notify student:', err); }
  };

  const createJob = async (job) => {
    try {
      const result = await api.post('/jobs', job);
      setJobs([{ ...job, id: result.id }, ...jobs]);
      broadcastStudentNotif(`New job posted: ${job.title} at ${job.company}`);
      return { ...job, id: result.id };
    } catch (err) {
      console.error('Failed to save job:', err);
      alert('Could not save job to the database.');
    }
  };

  const updateJob = async (updatedJob) => {
    setJobs(jobs.map(x => x.id === updatedJob.id ? updatedJob : x));
    try {
      await api.put(`/jobs/${updatedJob.id}`, updatedJob);
      broadcastStudentNotif(`Job updated: ${updatedJob.title} at ${updatedJob.company}`);
    }
    catch (err) { console.error('Failed to save job update:', err); }
  };

  const deleteJob = async (id) => {
    const job = jobs.find(j => j.id === id);
    setJobs(jobs.filter(j => j.id !== id));
    try {
      await api.del(`/jobs/${id}`);
      if (job) broadcastStudentNotif(`Job removed: ${job.title} at ${job.company}`);
    }
    catch (err) { console.error('Failed to delete job:', err); }
  };

  const createApplication = async (application) => {
    try {
      const result = await api.post('/applications', application);
      setApplications([...applications, { ...application, id: result.id }]);
    } catch (err) {
      console.error('Failed to save application:', err);
      alert('Could not save your application to the database.');
    }
  };

  const addResource = async (res) => {
    try {
      const result = await api.post('/resources', res);
      setResources([{ ...res, id: result.id }, ...resources]);
    } catch (err) {
      console.error('Failed to save resource:', err);
    }
  };

  const markNotificationRead = async (id) => {
    setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    try { await api.put(`/notifications/${id}`, { read: true }); }
    catch (err) { console.error('Failed to update notification:', err); }
  };

  const currentStudent = user?.role === 'student' ? students.find(s => s.id === user.studentId) : null;

  // Safety net: if a student session refers to a record that no longer exists in the
  // database (e.g. stale browser session after a fresh DB reset), log them out cleanly
  // instead of crashing the whole app.
  useEffect(() => {
    if (user?.role === 'student' && !dataLoading && !currentStudent) {
      setUser(null);
      setView('landing');
    }
  }, [user, dataLoading, currentStudent]);

  // Poll for student-facing notifications (job broadcasts + this student's targeted updates)
  useEffect(() => {
    if (!(user?.role === 'student' && currentStudent)) return;

    const poll = async () => {
      try {
        const data = await api.get(`/notifications?audience=student&studentId=${currentStudent.id}`);
        if (!isFirstStudentNotifLoad.current) {
          const freshOnes = data.filter(n => !knownStudentNotifIds.current.has(n.id));
          if (freshOnes.length > 0) {
            playNotificationSound();
            setToast({ id: freshOnes[0].id, message: freshOnes[0].message });
          }
        }
        data.forEach(n => knownStudentNotifIds.current.add(n.id));
        isFirstStudentNotifLoad.current = false;
        setStudentNotifications(data);
      } catch (err) {
        console.error('Failed to poll student notifications:', err);
      }
    };

    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [user, currentStudent?.id]);

  const pendingCount = students.filter(s => s.status === 'Pending').length;
  const unreadCount = notifications.filter(n => !n.read).length;
  const studentUnreadCount = studentNotifications.filter(n => !studentReadIds.includes(n.id)).length;
  const markStudentNotifRead = (id) => setStudentReadIds(prev => prev.includes(id) ? prev : [...prev, id]);

  if (dataLoading) {
    return (
      <div className="app-container" style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh'}}>
        <div style={{textAlign: 'center'}}>
          <i className="fa-solid fa-circle-notch fa-spin text-primary" style={{fontSize: '2rem'}}></i>
          <p className="text-muted mt-4">Connecting to database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {toast && (
        <div
          className="glass-card border-primary animate-fade-in"
          style={{
            position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
            maxWidth: '360px', padding: '1rem 1.25rem', cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
          }}
          onClick={() => { markStudentNotifRead(toast.id); setToast(null); setActiveTab('notifications'); }}
        >
          <div className="flex justify-between items-start">
            <div style={{marginRight: '0.75rem'}}>
              <p className="mb-1"><i className="fa-solid fa-bell text-primary mr-2"></i><b>New Notification</b></p>
              <p className="text-sm text-muted">{toast.message}</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setToast(null); }}>✕</button>
          </div>
        </div>
      )}
      <nav className="navbar">
        <a href="#" className="nav-brand" onClick={() => !user && setView('landing')}><i className="fa-solid fa-layer-group text-primary"></i> NexPlacement</a>
        <div className="nav-links">
          {user ? (
            <>
              <span className="text-muted">Welcome, <span className="text-main font-bold">{user.name}</span></span>
              <button className="btn btn-outline btn-sm" onClick={() => { setUser(null); setView('landing'); }}>Logout</button>
            </>
          ) : (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => setView('login_student')}>Student Login</button>
              <button className="btn btn-primary btn-sm" onClick={() => setView('login_hrd')}>HRD Login</button>
            </>
          )}
        </div>
      </nav>

      {!user && view === 'landing' && <LandingPage onNavigate={setView} />}
      {!user && view.startsWith('login_') && <AuthPage role={view.split('_')[1]} onLogin={handleLogin} />}

      {/* --- Student Locked View --- */}
      {user && user.role === 'student' && currentStudent && currentStudent.status !== 'Approved' && (
        <div className="dashboard">
          <div className="main-content" style={{marginLeft: 0, width: '100%'}}>
            {currentStudent.status === 'Incomplete' && <StudentProfileBuilder student={currentStudent} onSave={(s) => updateStudent(s)} />}
            {currentStudent.status === 'Pending' && (
              <div className="glass-card text-center" style={{maxWidth: '600px', margin: '4rem auto', padding: '4rem 2rem'}}>
                <i className="fa-solid fa-hourglass-half text-warning mb-4" style={{fontSize: '4rem'}}></i>
                <h2 className="mb-2">Profile Under Review</h2>
                <p className="text-muted">The HRD team is currently reviewing your details. Once approved, you will receive an email notification and gain full access to the placement platform.</p>
              </div>
            )}
            {currentStudent.status === 'Rejected' && (
              <div className="container mt-8">
                <div className="glass-card mb-8 border-danger">
                  <h2 className="text-danger mb-2"><i className="fa-solid fa-circle-xmark mr-2"></i> Profile Rejected</h2>
                  <p>Your profile approval was rejected by the HRD officer. Please fix the following issue and resubmit:</p>
                  <div className="bg-black bg-opacity-20 p-4 rounded mt-4 text-warning"><b>HRD Feedback:</b> {currentStudent.rejectReason}</div>
                </div>
                <StudentProfileBuilder student={currentStudent} onSave={(s) => updateStudent(s)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Normal Dashboard View --- */}
      {user && view === 'dashboard' && (user.role === 'hrd' || (currentStudent && currentStudent.status === 'Approved')) && (
        <div className="dashboard">
          <div className="sidebar">
            {user.role === 'student' ? (
              <>
                <div className={`sidebar-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}><i className="fa-solid fa-house"></i> Home</div>
                <div className={`sidebar-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}><i className="fa-solid fa-user"></i> My Profile</div>
                <div className={`sidebar-item ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}><i className="fa-solid fa-briefcase"></i> Job Board</div>
                <div className={`sidebar-item ${activeTab === 'resume' ? 'active' : ''}`} onClick={() => setActiveTab('resume')}><i className="fa-solid fa-file-pdf"></i> Resume Analyzer</div>
                <div className={`sidebar-item ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}><i className="fa-solid fa-folder-open"></i> Resources & Links</div>
                <div className={`sidebar-item ${activeTab === 'applications' ? 'active' : ''}`} onClick={() => setActiveTab('applications')}><i className="fa-solid fa-list-check"></i> Applications</div>
                <div className={`sidebar-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')} style={{display:'flex', justifyContent:'space-between'}}>
                  <span><i className="fa-solid fa-bell"></i> Notifications</span>
                  {studentUnreadCount > 0 && <span className="badge badge-danger">{studentUnreadCount}</span>}
                </div>
              </>
            ) : (
              <>
                <div className={`sidebar-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}><i className="fa-solid fa-chart-pie"></i> Dashboard</div>
                <div className={`sidebar-item ${activeTab === 'create_job' ? 'active' : ''}`} onClick={() => setActiveTab('create_job')}><i className="fa-solid fa-plus-circle"></i> Post a Job</div>
                <div className={`sidebar-item ${activeTab === 'all_jobs' ? 'active' : ''}`} onClick={() => setActiveTab('all_jobs')}><i className="fa-solid fa-briefcase"></i> All Jobs</div>
                <div className={`sidebar-item ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')} style={{display:'flex', justifyContent:'space-between'}}>
                  <span><i className="fa-solid fa-user-clock"></i> Approvals</span>
                  {pendingCount > 0 && <span className="badge badge-warning">{pendingCount}</span>}
                </div>
                <div className={`sidebar-item ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}><i className="fa-solid fa-users"></i> All Students</div>
                <div className={`sidebar-item ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}><i className="fa-solid fa-folder-open"></i> Resources</div>
                <div className={`sidebar-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')} style={{display:'flex', justifyContent:'space-between'}}>
                  <span><i className="fa-solid fa-bell"></i> Notifications</span>
                  {unreadCount > 0 && <span className="badge badge-danger">{unreadCount}</span>}
                </div>
              </>
            )}
          </div>
          
          <div className="main-content">
            {/* Student Tabs */}
            {user.role === 'student' && activeTab === 'profile' && <StudentProfileView student={currentStudent} onUpdate={(s) => updateStudent(s)} />}
            {user.role === 'student' && activeTab === 'home' && (
              <div className="animate-fade-in">
                <h2>Welcome back, {currentStudent.name}!</h2>
                <p className="text-muted">USN: {currentStudent.usn} | Branch: {currentStudent.branch}</p>
                <div className="mt-8"><StudentJobs jobs={jobs} onApply={(jid) => createApplication({ jobId: jid, studentId: currentStudent.id, status: 'Applied', date: new Date().toISOString().split('T')[0], matchScore: 88 })} onMissingResource={handleMissingResource} /></div>
              </div>
            )}
            {user.role === 'student' && activeTab === 'jobs' && <StudentJobs jobs={jobs} onApply={(jid) => createApplication({ jobId: jid, studentId: currentStudent.id, status: 'Applied', date: new Date().toISOString().split('T')[0], matchScore: 88 })} onMissingResource={handleMissingResource} />}
            
            {user.role === 'student' && activeTab === 'resume' && <ResumeManager student={currentStudent} jobs={jobs} onUpdateStudent={(s) => updateStudent(s)} />}
            
            {user.role === 'student' && activeTab === 'resources' && <ResourcesPanel resources={resources} isHrdMode={false} />}
            {user.role === 'student' && activeTab === 'notifications' && <StudentNotifications notifications={studentNotifications} readIds={studentReadIds} onMarkRead={markStudentNotifRead} />}
            {user.role === 'student' && activeTab === 'applications' && (
              <div className="glass-card animate-fade-in">
                <h2>My Applications</h2>
                {applications.filter(a => a.studentId === currentStudent.id).length === 0 ? <p className="text-muted mt-4">You have not applied for any jobs yet.</p> : (
                  <table style={{width: '100%', textAlign: 'left', marginTop: '1rem'}}>
                    <thead><tr style={{borderBottom: '1px solid var(--border-color)'}}><th style={{padding: '1rem 0'}}>Company & Role</th><th>Match Score</th><th>Status</th></tr></thead>
                    <tbody>
                      {applications.filter(a => a.studentId === currentStudent.id).map(app => {
                        const job = jobs.find(j => j.id === app.jobId);
                        const isExpired = job && getDaysRemaining(job.deadline).text === 'Expired';
                        const displayStatus = isExpired ? 'Closed (Deadline Passed)' : app.status;
                        
                        return (
                          <tr key={app.id} style={{borderBottom: '1px solid var(--border-color)', opacity: isExpired ? 0.6 : 1}}>
                            <td style={{padding: '1rem 0'}}><b>{job?.company}</b><br/><span className="text-sm text-muted">{job?.title}</span></td>
                            <td><span className="badge badge-success">{app.matchScore}%</span></td>
                            <td><span className={`badge ${isExpired ? 'badge-danger' : 'badge-warning'}`}>{displayStatus}</span></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* HRD Tabs */}
            {user.role === 'hrd' && activeTab === 'home' && (
              <div className="animate-fade-in">
                <h2>Overview Stats</h2>
                <div className="grid grid-cols-3 mb-8 mt-4">
                  <div className="glass-card stat-card"><div className="stat-icon"><i className="fa-solid fa-users"></i></div><h3>Total Students</h3><p className="text-3xl font-bold text-main">{students.filter(s=>s.status==='Approved').length}</p></div>
                  <div className="glass-card stat-card"><div className="stat-icon"><i className="fa-solid fa-briefcase"></i></div><h3>Active Jobs</h3><p className="text-3xl font-bold text-main">{jobs.length}</p></div>
                  <div className="glass-card stat-card"><div className="stat-icon"><i className="fa-solid fa-file-signature"></i></div><h3>Applications</h3><p className="text-3xl font-bold text-main">{applications.length}</p></div>
                </div>
              </div>
            )}
            {user.role === 'hrd' && activeTab === 'create_job' && <HRDJobCreator onAddJob={async (job) => {
               const savedJob = await createJob(job);
               if(savedJob && job.applyLink) {
                  addResource({ title: `Apply Link: ${savedJob.title} at ${savedJob.company}`, url: savedJob.applyLink, type: 'Link', jobId: savedJob.id });
               }
               alert('Job Posted Successfully!'); setActiveTab('all_jobs');
            }} />}
            {user.role === 'hrd' && activeTab === 'all_jobs' && <HRDAllJobs jobs={jobs} applications={applications} onUpdateJob={(j) => updateJob(j)} onDeleteJob={(jid) => deleteJob(jid)} />}
            {user.role === 'hrd' && activeTab === 'requests' && <HRDStudentRequests students={students} onApprove={(id) => { updateStudent({ ...students.find(s => s.id === id), status: 'Approved' }); notifyStudent(id, 'Your profile has been approved! You now have full access to the placement platform.'); }} onReject={(id, reason) => { updateStudent({ ...students.find(s => s.id === id), status: 'Rejected', rejectReason: reason }); notifyStudent(id, `Your profile was rejected. Reason: ${reason}`); }} />}
            {user.role === 'hrd' && activeTab === 'students' && <HRDAllStudents students={students} applications={applications} jobs={jobs} onUpdate={(s) => updateStudent(s)} onDelete={(id) => deleteStudent(id)} onAddClick={() => setActiveTab('add_student')} />}
            {user.role === 'hrd' && activeTab === 'resources' && <ResourcesPanel resources={resources} isHrdMode={true} onAddResource={(res) => addResource(res)} />}
            {user.role === 'hrd' && activeTab === 'notifications' && <HRDNotifications notifications={notifications} onMarkRead={(id) => markNotificationRead(id)} />}
            
            {user.role === 'hrd' && activeTab === 'add_student' && (
              <div className="animate-fade-in">
                <button className="btn btn-outline mb-4" onClick={() => setActiveTab('students')}><i className="fa-solid fa-arrow-left mr-2"></i> Back to Students Database</button>
                <StudentProfileBuilder 
                  student={{ status: 'Approved' }} 
                  isHrdMode={true}
                  onSave={async (newStudent) => {
                     await addStudent({ ...newStudent, status: 'Approved' });
                     alert('Student manually added and automatically approved!');
                     setActiveTab('students');
                  }} 
                />
              </div>
            )}
          </div>
        </div>
      )}

      {user && user.role === 'student' && currentStudent?.status === 'Approved' && <AIChatbot />}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
