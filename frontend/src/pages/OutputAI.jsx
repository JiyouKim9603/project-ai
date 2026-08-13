import { useState } from 'react';
import { Link } from 'react-router-dom';
import './OutputAI.css';

function OutputAI() {
  const [keyword, setKeyword]     = useState('');
  const [team, setTeam]           = useState('딸깍');
  const [formats, setFormats]     = useState({ ppt: true, word: false, pdf: false });
  const [ais, setAis]             = useState({ gpt: true, claude: false, gemini: false, qwen: false });
  const [loading, setLoading]     = useState(false);
  const [slideCount, setSlideCount] = useState(5);

  const toggleFormat = (key) => setFormats(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleAi     = (key) => setAis(prev => ({ ...prev, [key]: !prev[key] }));

  const downloadPPT = async (kw) => {
    const res = await fetch('http://76.13.182.154:8000/generate-ppt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: kw, team: team, slide_count: slideCount }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${kw}_발표자료.pptx`;
    a.click();
  };

  const handleGenerate = async () => {
    if (!keyword.trim()) return alert('키워드를 입력해주세요!');
    setLoading(true);
    try {
      if (formats.ppt) await downloadPPT(keyword);
    } catch (err) {
      alert('오류가 발생했습니다: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="output">
      <nav className="nav">
        <Link to="/" className="nav-logo">프로젝트<span>.ai</span></Link>
        <div className="nav-links">
          <Link to="/meeting">회의록 AI</Link>
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
          <p>PPT 하단에 표시될 팀 이름을 입력하세요</p>
          <input
            className="keyword-input"
            placeholder="예: 딸깍"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          />
        </div>

        {/* 슬라이드 수 선택 */}
        <div className="input-card">
          <h2>슬라이드 수</h2>
          <p>생성할 슬라이드 수를 선택하세요</p>
          <div className="slide-count-options">
            {[3, 5, 7, 10].map((n) => (
              <button
                key={n}
                className={`count-btn ${slideCount === n ? 'active' : ''}`}
                onClick={() => setSlideCount(n)}
              >
                {n}장
              </button>
            ))}
          </div>
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

        {/* AI 선택 */}
        <div className="ai-select-card">
          <h2>AI 엔진 선택</h2>
          <p>문서 생성에 사용할 AI를 선택하세요</p>
          <div className="ai-options">
            {[['gpt', 'GPT-4o'], ['claude', 'Claude'], ['gemini', 'Gemini'], ['qwen', 'Qwen']].map(([key, label]) => (
              <label className="ai-option" key={key}>
                <input type="checkbox" checked={ais[key]} onChange={() => toggleAi(key)} />
                <span className={`ai-badge ${key}`}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 생성 버튼 */}
        <button className="generate-btn" onClick={handleGenerate} disabled={loading}>
          {loading ? '⏳ 생성 중...' : '✨ 문서 자동 생성'}
        </button>
      </main>
    </div>
  );
}

export default OutputAI;
