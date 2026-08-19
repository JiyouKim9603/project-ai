import { useState } from 'react';
import { Link } from 'react-router-dom';
import './MinutesAI.css';

function MeetingAI() {
  const [file, setFile]         = useState(null);
  const [title, setTitle]       = useState('');
  const [date, setDate]         = useState('');
  const [members, setMembers]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [result, setResult]     = useState(null);

  const STEPS = [
    { pct: 10, msg: '음성 파일 업로드 중...' },
    { pct: 30, msg: 'Whisper STT 변환 중...' },
    { pct: 60, msg: 'AI 회의록 분석 중...' },
    { pct: 85, msg: '요약 생성 중...' },
    { pct: 95, msg: '거의 다 됐어요...' },
  ];

  const startProgress = () => {
    let step = 0;
    const timer = setInterval(() => {
      if (step >= STEPS.length) { clearInterval(timer); return; }
      setProgress(STEPS[step].pct);
      setProgressMsg(STEPS[step].msg);
      step++;
    }, 3000);
    return timer;
  };

  const handleAnalyze = async () => {
    if (!file) return alert('음성 파일을 선택해주세요!');
    setLoading(true);
    setProgress(0);
    setProgressMsg('');
    setResult(null);
    const timer = startProgress();

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title || '회의');
      formData.append('date', date || new Date().toLocaleDateString('ko-KR'));
      formData.append('members', members || '');

      const res = await fetch('http://output-api.modui.cloud/analyze-minutes', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
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
    <div className="meeting">
      <nav className="nav">
        <Link to="/" className="nav-logo">프로젝트<span>.ai</span></Link>
        <div className="nav-links">
          <Link to="/meeting">회의록 AI</Link>
          <Link to="/output">산출물 AI</Link>
        </div>
      </nav>

      <main className="meeting-main">
        <div className="meeting-header">
          <h1>🎙️ 회의록 AI</h1>
          <p>회의 음성을 업로드하면 AI가 자동으로 회의록을 작성합니다</p>
        </div>

        {/* 회의 정보 입력 */}
        <div className="input-card">
          <h2>회의 정보</h2>
          <div className="meeting-info-grid">
            <div className="info-field">
              <label>회의 제목</label>
              <input
                className="keyword-input"
                placeholder="예: 3분기 기획 회의"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="info-field">
              <label>회의 일시</label>
              <input
                className="keyword-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="info-field full-width">
              <label>참석자</label>
              <input
                className="keyword-input"
                placeholder="예: 지유, 종윤, 태양, 수현"
                value={members}
                onChange={(e) => setMembers(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 음성 파일 업로드 */}
        <div className="input-card">
          <h2>음성 파일 업로드</h2>
          <p>mp3, wav, m4a, ogg 형식을 지원합니다</p>
          <div
            className={`upload-area ${file ? 'has-file' : ''}`}
            onClick={() => document.getElementById('audio-input').click()}
          >
            {file ? (
              <div className="file-info">
                <span className="file-icon">🎵</span>
                <span className="file-name">{file.name}</span>
                <span className="file-size">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
              </div>
            ) : (
              <div className="upload-placeholder">
                <span className="upload-icon">📂</span>
                <p>클릭하여 음성 파일 선택</p>
                <p className="upload-sub">또는 파일을 여기로 드래그하세요</p>
              </div>
            )}
          </div>
          <input
            id="audio-input"
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={(e) => setFile(e.target.files[0])}
          />
        </div>

        {/* 분석 버튼 */}
        <button className="generate-btn" onClick={handleAnalyze} disabled={loading}>
          {loading ? '⏳ 분석 중...' : '🎙️ 회의록 자동 생성'}
        </button>

        {/* 진행상황 */}
        {loading && (
          <div className="progress-wrap">
            <div className="progress-msg">{progressMsg}</div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress}%`, transition: 'width 1.5s ease' }}
              />
            </div>
            <div className="progress-pct">{progress}%</div>
          </div>
        )}

        {/* 결과 표시 */}
        {result && (
          <div className="result-section">

            {/* 회의 정보 헤더 */}
            <div className="result-header-card">
              <h2>📋 {result.title}</h2>
              <div className="result-meta">
                <span>📅 {result.date}</span>
                <span>👥 {result.members}</span>
              </div>
            </div>

            {/* 전체 흐름도 */}
            <div className="result-card">
              <div className="result-card-header">
                <span className="ai-badge-small gpt">GPT</span>
                <span className="model-name">GPT-4o-mini</span>
              </div>
              <h3>📊 전체 흐름도</h3>
              {result.agenda?.map((item, i) => (
                <div className="agenda-item" key={i}>
                  <div className="agenda-number">{i + 1}</div>
                  <div className="agenda-content">
                    <strong>{item.title}</strong>
                    <p>{item.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* 3줄 요약 */}
            <div className="result-card">
              <h3>📝 3줄 요약</h3>
              <p className="summary-text">{result.summary}</p>
            </div>

            {/* 액션아이템 */}
            <div className="result-card">
              <h3>✅ 액션아이템</h3>
              {result.action_items?.map((item, i) => (
                <div className="action-item" key={i}>
                  <span className="action-member">{item.member}</span>
                  <span className="action-content">{item.content}</span>
                  <span className="action-deadline">{item.deadline}</span>
                </div>
              ))}
            </div>

            {/* 다음 회의 안건 */}
            {result.next_agenda && (
              <div className="result-card">
                <h3>📅 다음 회의 안건</h3>
                <p>{result.next_agenda}</p>
              </div>
            )}

            {/* STT 전문 */}
            <div className="result-card transcript-card">
              <h3>🎙️ 전체 텍스트 (STT)</h3>
              <p className="transcript-text">{result.transcript}</p>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

export default MeetingAI;
