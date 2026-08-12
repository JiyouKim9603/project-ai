import { Link } from 'react-router-dom';
import './MeetingAI.css';

function MeetingAI() {
  return (
    <div className="meeting">
      {/* 네비게이션 */}
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
          <p>음성 파일을 업로드하면 AI가 자동으로 분석하고 요약합니다</p>
        </div>

        {/* 업로드 영역 */}
        <div className="upload-card">
          <div className="upload-area">
            <div className="upload-icon">🎵</div>
            <p className="upload-text">음성 파일을 여기에 드래그하거나</p>
            <button className="upload-btn">파일 선택</button>
            <p className="upload-hint">지원 형식: MP3, MP4, WAV, M4A</p>
          </div>
        </div>

        {/* AI 선택 */}
        <div className="ai-select-card">
          <h2>AI 엔진 선택</h2>
          <p>분석에 사용할 AI를 선택하세요 (복수 선택 가능)</p>
          <div className="ai-options">
            <label className="ai-option">
              <input type="checkbox" defaultChecked />
              <span className="ai-badge gpt">GPT-4o</span>
            </label>
            <label className="ai-option">
              <input type="checkbox" defaultChecked />
              <span className="ai-badge claude">Claude</span>
            </label>
            <label className="ai-option">
              <input type="checkbox" />
              <span className="ai-badge gemini">Gemini</span>
            </label>
            <label className="ai-option">
              <input type="checkbox" />
              <span className="ai-badge qwen">Qwen</span>
            </label>
          </div>
        </div>

        {/* 분석 버튼 */}
        <button className="analyze-btn">✨ AI 분석 시작</button>

      </main>
    </div>
  );
}

export default MeetingAI;