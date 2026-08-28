import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import './OutputAI.css';

function OutputAI() {
  const [keyword, setKeyword]   = useState('');
  const [team, setTeam]         = useState('딸깍');
  const [formats, setFormats]   = useState({ ppt: true, word: false, pdf: false });
  const [selectedModel, setSelectedModel] = useState('gpt');
  const [loading, setLoading]   = useState(false);
  const [slideCount]            = useState(10);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const debounceRef = useRef(null);

  const toggleFormat = (key) => setFormats(prev => ({ ...prev, [key]: !prev[key] }));

  const STEPS = [
    { pct: 10,  label: '키워드 분석 중...' },
    { pct: 30,  label: 'AI가 콘텐츠 생성 중...' },
    { pct: 60,  label: '슬라이드 구성 중...' },
    { pct: 80,  label: '파일 조립 중...' },
    { pct: 95,  label: '거의 다 됐어요...' },
  ];

  const fetchSuggestions = useCallback(async (text) => {
    if (!text.trim() || text.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setLoadingSuggest(true);
    try {
      const res = await fetch('http://output-api.modui.cloud/suggest-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: text }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch (err) {
      setSuggestions([]);
    } finally {
      setLoadingSuggest(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(keyword);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [keyword, fetchSuggestions]);

  const handleSelectSuggestion = (s) => {
    setKeyword(s);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const startProgress = () => {
    let step = 0;
    setCurrentStep(0);
    const timer = setInterval(() => {
      if (step >= STEPS.length - 1) { clearInterval(timer); return; }
      step++;
      setProgress(STEPS[step].pct);
      setCurrentStep(step);
    }, 1800);
    setProgress(STEPS[0].pct);
    return timer;
  };

  const downloadPPT = async (kw) => {
    const res = await fetch('http://output-api.modui.cloud/generate-ppt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, team, slide_count: slideCount, model: selectedModel }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${kw}_발표자료.pptx`;
    a.click();
  };

  const downloadWord = async (kw) => {
    const res = await fetch('http://output-api.modui.cloud/generate-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, team, model: selectedModel }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${kw}_문서.docx`;
    a.click();
  };

  const downloadPDF = async (kw) => {
    const res = await fetch('http://output-api.modui.cloud/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, team, model: selectedModel }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${kw}_문서.pdf`;
    a.click();
  };

  const handleGenerate = async () => {
    if (!keyword.trim()) return alert('키워드를 입력해주세요!');
    setShowSuggestions(false);
    setLoading(true);
    setProgress(0);
    setCurrentStep(-1);
    const timer = startProgress();
    try {
      if (formats.ppt)  await downloadPPT(keyword);
      if (formats.word) await downloadWord(keyword);
      if (formats.pdf)  await downloadPDF(keyword);
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

  const FORMAT_INFO = {
    ppt:  { icon: '📊', label: 'PPT',  desc: '프레젠테이션 슬라이드' },
    word: { icon: '📝', label: 'Word', desc: '보고서 문서' },
    pdf:  { icon: '📋', label: 'PDF',  desc: '인쇄용 문서' },
  };

  return (
    <div className="out-app" onClick={() => setShowSuggestions(false)}>

      {/* ── Nav ── */}
      <nav className="out-nav">
        <div className="out-nav-in">
          <div className="out-logo" onClick={() => window.location.href='/'} style={{cursor:'pointer'}}>
            <div className="out-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" fill="url(#og)" stroke="rgba(255,255,255,.1)" strokeWidth=".5"/>
                <path d="M12 2l9 5-9 5-9-5 9-5z" fill="#5bbfff" opacity=".95"/>
                <path d="M3 7l9 5v10L3 17V7z" fill="#1a6fd4"/>
                <path d="M21 7l-9 5v10l9-5V7z" fill="#2d8be8"/>
                <defs>
                  <linearGradient id="og" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#5bbfff"/>
                    <stop offset="1" stopColor="#1a5fc8"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="out-logo-text">
              <span className="out-logo-name">Modui</span>
              <span className="out-logo-sub">AI Groupware</span>
            </div>
          </div>
          <div className="out-nav-links">
            <Link to="/minutes">회의록 AI</Link>
            <Link to="/output">문서봇 AI</Link>
          </div>
        </div>
      </nav>

      {/* ── 페이지 헤더 ── */}
      <div className="out-page-header">
        <div className="out-page-tag">
          <span className="out-live-dot"></span>
          문서봇 AI
        </div>
        <h1 className="out-page-title">키워드 하나로<br/><span>PPT·Word·PDF 완성</span></h1>
        <p className="out-page-sub">주제를 입력하면 AI가 내용을 구성하고<br/>바로 다운로드할 수 있는 문서를 만들어줍니다.</p>
      </div>

      {/* ── 메인 ── */}
      <div className="out-main">

        {/* 주제 입력 + 자동완성 */}
        <div className="out-card" onClick={(e) => e.stopPropagation()}>
          <div className="out-card-label">주제 입력</div>
          <div className="out-autocomplete-wrap">
            <div className="out-input-row">
              <input
                className="out-input out-input-lg"
                placeholder="예: 하이브리드 클라우드 인프라 설계"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setShowSuggestions(false); handleGenerate(); }
                  if (e.key === 'Escape') setShowSuggestions(false);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                autoComplete="off"
              />
              {loadingSuggest && <span className="out-suggest-spinner">⏳</span>}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="out-suggestions">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="out-suggestion-item"
                    onMouseDown={() => handleSelectSuggestion(s)}
                  >
                    <span className="out-suggest-icon">🔍</span>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="out-input-hint">입력하면 AI가 자동으로 주제를 제안해드려요</div>
        </div>

        {/* 형식 + 팀명 + 모델 가로 배치 */}
        <div className="out-row">

          {/* 출력 형식 */}
          <div className="out-card out-card-flex">
            <div className="out-card-label">출력 형식</div>
            <div className="out-format-options">
              {Object.entries(FORMAT_INFO).map(([key, { icon, label, desc }]) => (
                <label key={key} className={`out-format-opt ${formats[key] ? 'active' : ''}`}>
                  <input type="checkbox" checked={formats[key]} onChange={() => toggleFormat(key)} style={{display:'none'}}/>
                  <div className="out-format-icon">{icon}</div>
                  <div className="out-format-name">{label}</div>
                  <div className="out-format-desc">{desc}</div>
                  {formats[key] && <div className="out-format-check">✓</div>}
                </label>
              ))}
            </div>
          </div>

          {/* 오른쪽 설정들 */}
          <div className="out-col">

            {/* 팀명 */}
            <div className="out-card">
              <div className="out-card-label">팀명</div>
              <input
                className="out-input"
                placeholder="예: 딸깍"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </div>

            {/* AI 모델 */}
            <div className="out-card">
              <div className="out-card-label">AI 모델</div>
              <div className="out-model-options">
                {[['gpt','GPT-4o-mini','#e9f5f0','#1f7a5c'], ['gemini','Gemini 1.5','#e3f2fd','#1565c0']].map(([key, label, bg, color]) => (
                  <label
                    key={key}
                    className={`out-model-opt ${selectedModel === key ? 'active' : ''}`}
                    style={selectedModel === key ? {background: bg, borderColor: color, color} : {}}
                  >
                    <input type="radio" name="ai-model" checked={selectedModel === key} onChange={() => setSelectedModel(key)} style={{display:'none'}}/>
                    <span className="out-model-dot" style={{background: selectedModel === key ? color : '#dde4f0'}}></span>
                    {label}
                  </label>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* 생성 버튼 */}
        <button className="out-generate-btn" onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <span className="out-btn-loading">
              <span className="out-spinner"></span>
              생성 중...
            </span>
          ) : (
            <>✨ 문서 자동 생성</>
          )}
        </button>

        {/* 진행상황 */}
        {loading && (
          <div className="out-progress-card">
            <div className="out-progress-info">
              <div>
                <div className="out-progress-label">생성 중</div>
                <div className="out-progress-sub">
                  {formats.ppt && 'PPT '}
                  {formats.word && 'Word '}
                  {formats.pdf && 'PDF'}
                  를 만들고 있어요
                </div>
              </div>
            </div>
            <div className="out-progress-track">
              <div className="out-progress-fill" />
            </div>
            <div className="out-steps">
              {STEPS.map((step, i) => {
                const isDone   = i < currentStep;
                const isActive = i === currentStep;
                return (
                  <div key={i} className={`out-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                    <span className="out-step-icon">
                      {isDone ? '✅' : isActive ? '⏳' : '○'}
                    </span>
                    {step.label}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default OutputAI;
