import { Link } from 'react-router-dom';
import './OutputAI.css';

function OutputAI() {
  return (
    <div className="output">
      {/* 네비게이션 */}
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
          />
        </div>

        {/* 출력 형식 선택 */}
        <div className="format-card">
          <h2>출력 형식 선택</h2>
          <p>생성할 파일 형식을 선택하세요 (복수 선택 가능)</p>
          <div className="format-options">
            <label className="format-option">
              <input type="checkbox" defaultChecked />
              <span className="format-badge ppt">📊 PPT</span>
            </label>
            <label className="format-option">
              <input type="checkbox" defaultChecked />
              <span className="format-badge word">📝 Word</span>
            </label>
            <label className="format-option">
              <input type="checkbox" />
              <span className="format-badge pdf">📄 PDF</span>
            </label>
          </div>
        </div>

        {/* AI 선택 */}
        <div className="ai-select-card">
          <h2>AI 엔진 선택</h2>
          <p>문서 생성에 사용할 AI를 선택하세요</p>
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

        {/* 생성 버튼 */}
        <button className="generate-btn">✨ 문서 자동 생성</button>

      </main>
    </div>
  );
}

export default OutputAI;