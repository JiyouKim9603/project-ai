import './Home.css';

function Home() {
  return (
    <div className="home">

      {/* 네비게이션 */}
      <nav className="nav">
        <div className="nav-logo">프로젝트<span>.ai</span></div>
        <div className="nav-links">
          <a href="/meeting">회의록 AI</a>
          <a href="/output">산출물 AI</a>
          <button className="nav-btn">시작하기</button>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <section className="hero">
        <div className="hero-badge">멀티 AI 엔진 기반 협업 플랫폼</div>
        <h1>회의가 끝나면<br /><span>문서가 완성됩니다</span></h1>
        <p>회의록을 업로드하면 GPT, Claude, Gemini, Qwen이<br />동시에 분석하고 PPT, Word, PDF를 자동으로 생성합니다.</p>
        <div className="hero-btns">
          <button className="btn-primary">무료로 시작하기</button>
          <button className="btn-secondary">데모 보기</button>
        </div>
      </section>

      {/* 기능 소개 */}
      <section className="features">
        <h2>하나의 플랫폼, 모든 협업</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon">🎙️</div>
            <h3>회의록 AI</h3>
            <p>음성 파일을 업로드하면 자동으로 텍스트로 변환하고 핵심 내용을 요약합니다.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📄</div>
            <h3>산출물 자동 생성</h3>
            <p>키워드 하나로 PPT, Word, PDF 파일을 자동으로 생성합니다.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>멀티 AI 비교</h3>
            <p>GPT, Claude, Gemini, Qwen이 동시에 분석해 최적의 결과를 제공합니다.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">☁️</div>
            <h3>하이브리드 클라우드</h3>
            <p>민감한 데이터는 온프레미스에, 일반 트래픽은 클라우드에서 처리합니다.</p>
          </div>
        </div>
      </section>

      {/* 사용 흐름 */}
      <section className="flow">
        <h2>이렇게 사용하세요</h2>
        <div className="flow-steps">
          <div className="flow-step">
            <div className="step-num">1</div>
            <h3>업로드</h3>
            <p>음성 파일 또는 키워드를 입력하세요</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">2</div>
            <h3>AI 분석</h3>
            <p>4개의 AI가 동시에 분석합니다</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">3</div>
            <h3>파일 생성</h3>
            <p>PPT, Word, PDF가 자동으로 생성됩니다</p>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <div className="step-num">4</div>
            <h3>공유</h3>
            <p>Slack으로 자동 전송됩니다</p>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="footer">
        <p>© 2026 프로젝트.ai — CloudDX 7기</p>
      </footer>

    </div>
  );
}

export default Home;