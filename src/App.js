import './App.css';

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">프로젝트<span>.ai</span></div>
        <div className="badge">MVP DEMO</div>
      </header>

      <main className="main">
        <div className="hero">
          <h1>키워드 하나로<br /><em>PPT가 완성됩니다</em></h1>
          <p>키워드를 입력하면 AI가 프로젝트 아이디어를 생성하고<br />발표용 PPT 파일을 자동으로 만들어드립니다.</p>
        </div>

        <div className="card">
          <div className="card-title">키워드 입력</div>
          <input className="keyword-input" placeholder="키워드 입력 후 Enter (예: 하이브리드 클라우드)" />
          <button className="generate-btn">✨ PPT 자동 생성하기</button>
        </div>
      </main>
    </div>
  );
}

export default App;