import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './MinutesAI.css';

function MeetingAI() {
  const [file, setFile]         = useState(null);
  const [title, setTitle]       = useState('');
  const [date, setDate]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [result, setResult]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [savedList, setSavedList] = useState([]);
  const [selectedSaved, setSelectedSaved] = useState(null);
  const [activeTab, setActiveTab] = useState('text'); // 'voice' | 'text'

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('minutes') || '[]');
    setSavedList(saved);
  }, []);

  const STEPS = [
    { pct: 10, label: '음성 파일 업로드 중...' },
    { pct: 30, label: 'Whisper STT 변환 중...' },
    { pct: 60, label: 'AI 회의록 분석 중...' },
    { pct: 85, label: '요약 생성 중...' },
    { pct: 95, label: '거의 다 됐어요...' },
  ];

  const startProgress = () => {
    let step = 0;
    setCurrentStep(0);
    setProgress(STEPS[0].pct);
    const timer = setInterval(() => {
      if (step >= STEPS.length - 1) { clearInterval(timer); return; }
      step++;
      setProgress(STEPS[step].pct);
      setCurrentStep(step);
    }, 3000);
    return timer;
  };

  const handlePageDragOver = (e) => e.preventDefault();
  const handlePageDrop = (e) => e.preventDefault();
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleAnalyze = async () => {
    if (!file) return alert('음성 파일을 선택해주세요!');
    setLoading(true);
    setProgress(0);
    setCurrentStep(-1);
    setResult(null);
    setTranscriptOpen(false);
    const timer = startProgress();
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || '회의');
      formData.append('date', date || new Date().toLocaleDateString('ko-KR'));
      formData.append('members', '');
      formData.append('model', selectedModel);
      const res = await fetch('http://output-api.modui.cloud/analyze-minutes', {
        method: 'POST', body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult({ ...data, model: selectedModel });
      setProgress(100);
      setCurrentStep(STEPS.length);
    } catch (err) {
      alert('오류가 발생했습니다: ' + err.message);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setTimeout(() => { setProgress(0); setCurrentStep(-1); }, 2000);
    }
  };

  const handleSave = () => {
    const saved = JSON.parse(localStorage.getItem('minutes') || '[]');
    const newEntry = { id: Date.now(), savedAt: new Date().toLocaleDateString('ko-KR'), ...result };
    const updated = [newEntry, ...saved];
    localStorage.setItem('minutes', JSON.stringify(updated));
    setSavedList(updated);
    alert('저장됐어요!');
  };

  const handleDownloadWord = async () => {
    if (!result) return;
    try {
      const res = await fetch('http://output-api.modui.cloud/generate-minutes-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        result.title,
          date:         result.date,
          members:      result.members,
          transcript:   result.transcript,
          agenda:       result.agenda,
          summary:      result.summary,
          action_items: result.action_items,
          next_agenda:  result.next_agenda,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${result.title}_회의록.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Word 다운로드 실패: ' + err.message);
    }
  };

  const handleDelete = (id) => {
    const updated = savedList.filter(m => m.id !== id);
    localStorage.setItem('minutes', JSON.stringify(updated));
    setSavedList(updated);
    if (selectedSaved?.id === id) setSelectedSaved(null);
  };

  // STT 텍스트를 대화형으로 파싱 (화자 이름: 내용 형식)
  const parseTranscript = (text) => {
    if (!text) return [];
    const lines = text.split('\n').filter(l => l.trim());
    return lines.map((line, i) => {
      const match = line.match(/^([^:：]{1,6})[：:](.+)$/);
      if (match) {
        return { speaker: match[1].trim(), text: match[2].trim(), index: i };
      }
      return { speaker: null, text: line.trim(), index: i };
    });
  };

  const SPEAKER_COLORS = ['#3b5bdb', '#1f7a5c', '#bd8730', '#7c3aed', '#e11d48', '#0891b2'];

  const getSpeakerColor = (speaker, speakers) => {
    const idx = speakers.indexOf(speaker);
    return SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
  };

  const renderTranscriptLines = (transcript) => {
  if (!transcript) return null;
  return transcript
    .split(/(?<=[다요죠\.!?])\s+/)
    .filter(s => s.trim())
    .reduce((acc, s, i) => {
      const gi = Math.floor(i / 4);
      if (!acc[gi]) acc[gi] = [];
      acc[gi].push(s.trim());
      return acc;
    }, [])
    .map((group, i) => (
      <p key={i} className="min-transcript-para">{group.join(' ')}</p>
    ));
};

  return (
    <div className="min-app" onDragOver={handlePageDragOver} onDrop={handlePageDrop}>

      {/* ── Nav ── */}
      <nav className="min-nav">
        <div className="min-nav-in">
          <div className="min-logo" onClick={() => window.location.href='/'} style={{cursor:'pointer'}}>
            <div className="min-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="url(#cg)" stroke="rgba(255,255,255,.1)" strokeWidth=".5"/>
                <path d="M12 2l9 5-9 5-9-5 9-5z" fill="#5bbfff" opacity=".95"/>
                <path d="M3 7l9 5v10L3 17V7z" fill="#1a6fd4"/>
                <path d="M21 7l-9 5v10l9-5V7z" fill="#2d8be8"/>
                <defs>
                  <linearGradient id="cg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#5bbfff"/>
                    <stop offset="1" stopColor="#1a5fc8"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="min-logo-text">
              <span className="min-logo-name">Modui</span>
              <span className="min-logo-sub">AI Groupware</span>
            </div>
          </div>
          <div className="min-nav-links">
            <Link to="/minutes">회의록 AI</Link>
            <Link to="/output">산출물 AI</Link>
          </div>
        </div>
      </nav>

      {/* ── 페이지 헤더 ── */}
      <div className="min-page-header">
        <div className="min-page-header-tag">
          <span className="min-live-dot"></span>
          회의록 AI
        </div>
        <h1 className="min-page-title">음성이 곧<br/><span>회의록이 됩니다</span></h1>
        <p className="min-page-sub">회의 음성을 업로드하면 Whisper STT로 자동 받아쓰고,<br/>AI가 핵심을 요약해 회의록을 완성합니다.</p>
      </div>

      {/* ── 메인 콘텐츠 ── */}
      <div className="min-main">

        {/* 왼쪽 패널 — 입력 */}
        <div className="min-left">

          {/* 회의 정보 */}
          <div className="min-card">
            <div className="min-card-label">회의 정보</div>
            <div className="min-info-grid">
              <div className="min-field">
                <label>회의 제목</label>
                <input
                  className="min-input"
                  placeholder="예: 3분기 기획 회의"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="min-field">
                <label>회의 일시</label>
                <input
                  className="min-input"
                  type="date"
                  value={date}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 음성 업로드 */}
          <div className="min-card">
            <div className="min-card-label">음성 파일</div>
            <div
              className={`min-upload ${file ? 'has-file' : ''} ${dragOver ? 'drag-over' : ''}`}
              onClick={() => document.getElementById('audio-input').click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="min-file-info">
                  <span className="min-file-icon">🎵</span>
                  <div>
                    <div className="min-file-name">{file.name}</div>
                    <div className="min-file-size">{(file.size / 1024 / 1024).toFixed(1)}MB</div>
                  </div>
                </div>
              ) : (
                <div className="min-upload-empty">
                  <div className="min-upload-ico">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b5bdb" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="23"/>
                      <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                  </div>
                  <p>클릭하거나 파일을 드래그하세요</p>
                  <span>mp3, wav, m4a, ogg 지원</span>
                </div>
              )}
            </div>
            <input id="audio-input" type="file" accept="audio/*" style={{display:'none'}} onChange={(e) => setFile(e.target.files[0])}/>
          </div>

          {/* AI 모델 */}
          <div className="min-card">
            <div className="min-card-label">AI 모델</div>
            <div className="min-model-options">
              {[['gpt','GPT-4o-mini','#e9f5f0','#1f7a5c'], ['gemini','Gemini 1.5','#e3f2fd','#1565c0']].map(([key, label, bg, color]) => (
                <label key={key} className={`min-model-opt ${selectedModel === key ? 'active' : ''}`} style={selectedModel === key ? {background: bg, borderColor: color, color} : {}}>
                  <input type="radio" name="model" checked={selectedModel === key} onChange={() => setSelectedModel(key)} style={{display:'none'}}/>
                  <span className="min-model-dot" style={{background: selectedModel === key ? color : '#dde4f0'}}></span>
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* 생성 버튼 */}
          <button className="min-generate-btn" onClick={handleAnalyze} disabled={loading}>
            {loading ? (
              <span className="min-btn-loading">
                <span className="min-spinner"></span>
                분석 중...
              </span>
            ) : (
              <>🎙️ 회의록 자동 생성</>
            )}
          </button>

          {/* 진행상황 */}
          {loading && (
            <div className="min-progress-card">
              <div className="min-progress-top">
                <span>분석 중</span>
                <span className="min-progress-pct">{progress}%</span>
              </div>
              <div className="min-progress-track">
                <div className="min-progress-fill" style={{width: `${progress}%`}}/>
              </div>
              <div className="min-steps">
                {STEPS.map((step, i) => {
                  const isDone = i < currentStep;
                  const isActive = i === currentStep;
                  return (
                    <div key={i} className={`min-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                      <span>{isDone ? '✅' : isActive ? '⏳' : '○'}</span>
                      {step.label}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 저장된 회의록 */}
          {savedList.length > 0 && (
            <div className="min-card">
              <div className="min-card-label">저장된 회의록</div>
              <div className="min-saved-list">
                {savedList.map(m => (
                  <div
                    key={m.id}
                    className={`min-saved-item ${selectedSaved?.id === m.id ? 'active' : ''}`}
                    onClick={() => { setSelectedSaved(selectedSaved?.id === m.id ? null : m); setResult(selectedSaved?.id === m.id ? null : m); }}
                  >
                    <div>
                      <div className="min-saved-title">📋 {m.title}</div>
                      <div className="min-saved-date">📅 {m.date}</div>
                    </div>
                    <button className="min-delete-btn" onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽 패널 — 결과 */}
        <div className="min-right">
          {!result ? (
            <div className="min-empty">
              <div className="min-empty-ico">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dde4f0" strokeWidth="1.2" strokeLinecap="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </div>
              <p className="min-empty-title">AI가 정리한 회의록</p>
              <p className="min-empty-sub">음성 파일을 업로드하고<br/>회의록 자동 생성을 눌러보세요</p>
            </div>
          ) : (
            <div className="min-result">

              {/* 결과 헤더 */}
              <div className="min-result-header">
                <div>
                  <div className="min-result-tag">AI가 정리한 회의록</div>
                  <h2 className="min-result-title">{result.title}</h2>
                  <p className="min-result-date">📅 {result.date}</p>
                </div>
                <div className="min-result-actions">
                  <button className="min-save-btn" onClick={handleSave}>💾</button>
                  <button className="min-word-btn" onClick={handleDownloadWord}>📄 Word</button>
                </div>
              </div>

              {/* 탭 */}
              <div className="min-tabs">
                <button className={`min-tab ${activeTab === 'text' ? 'active' : ''}`} onClick={() => setActiveTab('text')}>
                  📋 정리
                  </button>
                  <button className={`min-tab ${activeTab === 'voice' ? 'active' : ''}`} onClick={() => setActiveTab('voice')}>
                    🎙️ 원문
                  </button>
              </div>
              {activeTab === 'voice' && (
                <div className="min-transcript-panel">
                  {result.transcript
                    ? renderTranscriptLines(result.transcript)
                    : <p className="min-empty-sub">STT 텍스트가 없습니다.</p>
                  }
                </div>
              )}

              {activeTab === 'text' && (
                <div className="min-text-panel">

                  {/* 회의 요약 */}
                  <div className="min-section">
                    <div className="min-section-label">| 회의 요약</div>
                    <p className="min-summary">{result.summary}</p>
                  </div>

                  {/* 안건 */}
                  {result.agenda?.length > 0 && (
                    <div className="min-section">
                      <div className="min-section-label">| 결정 사항</div>
                      {result.agenda.map((item, i) => (
                        <div key={i} className="min-agenda-item">
                          <span className="min-check">✓</span>
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 액션아이템 */}
                  {result.action_items?.length > 0 && (
                    <div className="min-section">
                      <div className="min-section-label">| 할 일</div>
                      {result.action_items.map((item, i) => (
                        <div key={i} className="min-action-item">
                          <span className="min-check">✓</span>
                          <span className="min-action-text">{item.content}</span>
                          <span className="min-deadline">{item.deadline}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 다음 안건 */}
                  {result.next_agenda && (
                    <div className="min-section">
                      <div className="min-section-label">| 다음 회의 안건</div>
                      <p className="min-next-agenda">{result.next_agenda}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MeetingAI;
