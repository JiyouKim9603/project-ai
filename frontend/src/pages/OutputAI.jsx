import { useState } from 'react';
import { Link } from 'react-router-dom';
import './OutputAI.css';

function OutputAI() {
  const [keyword, setKeyword]   = useState('');
  const [team, setTeam]         = useState('딸깍');
  const [formats, setFormats]   = useState({ ppt: true, word: false, pdf: false });
  const [loading, setLoading]   = useState(false);
  const [slideCount]            = useState(10);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');

  const toggleFormat = (key) => setFormats(prev => ({ ...prev, [key]: !prev[key] }));

  const STEPS = [
    { pct: 10, msg: '키워드 분석 중...' },
    { pct: 30, msg: 'AI가 콘텐츠 생성 중...' },
    { pct: 60, msg: '슬라이드 구성 중...' },
    { pct: 80, msg: '파일 조립 중...' },
    { pct: 95, msg: '거의 다 됐어요...' },
  ];

  const startProgress = () => {
    let step = 0;
    const timer = setInterval(() => {
      if (step >= STEPS.length) { clearInterval(timer); return; }
      setProgress(STEPS[step].pct);
      setProgressMsg(STEPS[step].msg);
      step++;
    }, 1800);
    return timer;
  };

  const downloadPPT = async (kw) => {
    const res = await fetch('http://output-api.modui.cloud/generate-ppt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, team: team, slide_count: slideCount }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${kw}_발표자료.pptx`;
    a.click();
  };

  const downloadWord = async (kw) => {
    const res = await fetch('http://output-api.modui.cloud/generate-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, team: team }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${kw}_문서.docx`;
    a.click();
  };

  const downloadPDF = async (kw) => {
    const res = await fetch('http://output-api.modui.cloud/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, team: team }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${kw}_문서.pdf`;
    a.click();
  };

  const handleGenerate = async () => {
    if (!keyword.trim()) return alert('키워드를 입력해주세요!');
    setLoading(true);
    setProgress(0);
    setProgressMsg('');
    const timer = startProgress();
    try {
      if (formats.ppt)  await downloadPPT(keyword);
      if (formats.word) await downloadWord(keyword);
      if (formats.pdf)  await downloadPDF(keyword);
      setProgress(100);
      setProgressMsg('완료!');
    } catch (err) {
      alert('오류가 발생했습니다: ' + err.message);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setTimeout(() => { setProgress(0); setProgressMsg(''); }, 2000);
    }
  };

  return (
    <div className="output">
      <nav className="nav">
        <Link to="/" className="nav-logo">프로젝트<span>.ai</span></Link>
        <div className="nav-links">
          <Link to="/minutes">회의록 AI</Link>
          <Link to="/output">산출물 AI</Link>
        </div>
      </nav>

      <main className="output-main">
        <div className="output-header">
          <h1>📄 산출물 AI</h1>
          <p>키워드를 입력하면 AI가 PPT, Word, PDF를 자동으로 생성합니다</p>
        </div>

        {/* 키워드 입력 */}
        <div className="input-card">
          <h2>키워드 입력</h2>
          <p>생성할 문서의 주제나 키워드를 입력하세요</p>
          <input
            className="keyword-input"
            placeholder="예: 하이브리드 클라우드 인프라 설계"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {/* 팀명 입력 */}
        <div className="input-card">
          <h2>팀명 입력</h2>
          <p>문서 하단에 표시될 팀 이름을 입력하세요</p>
          <input
            className="keyword-input"
            placeholder="예: 딸깍"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
        </div>

        {/* 출력 형식 선택 */}
        <div className="format-card">
          <h2>출력 형식 선택</h2>
          <p>생성할 파일 형식을 선택하세요 (복수 선택 가능)</p>
          <div className="format-options">
            {[['ppt', '📊 PPT'], ['word', '📝 Word'], ['pdf', '📄 PDF']].map(([key, label]) => (
              <label className="format-option" key={key}>
                <input type="checkbox" checked={formats[key]} onChange={() => toggleFormat(key)} />
                <span className={`format-badge ${key}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* AI 엔진 */}
        <div className="ai-select-card">
          <h2>AI 엔진</h2>
          <p>현재 GPT-4o를 사용하여 문서를 생성합니다</p>
          <div className="ai-options">
            <span className="ai-badge gpt">GPT-4o</span>
          </div>
        </div>

        {/* 생성 버튼 */}
        <button className="generate-btn" onClick={handleGenerate} disabled={loading}>
          {loading ? '⏳ 생성 중...' : '✨ 문서 자동 생성'}
        </button>

        {/* 진행상황 */}
        {loading && (
          <div className="progress-wrap">
            <div className="progress-msg">{progressMsg}</div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%`, transition: 'width 0.8s ease' }}
              />
            </div>
            <div className="progress-pct">{progress}%</div>
          </div>
        )}
      </main>
    </div>
  );
}

export default OutputAI;
