// 라우터 관련 컴포넌트 불러오기
// BrowserRouter: 전체 앱을 감싸는 라우터
// Routes: 여러 Route를 감싸는 컨테이너
// Route: URL 경로와 컴포넌트를 연결
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// 페이지 컴포넌트 불러오기
import Home from './pages/Home';
import MeetingAI from './pages/MeetingAI';
import OutputAI from './pages/OutputAI';

// 스타일 불러오기
import './App.css';

function App() {
  return (
    // BrowserRouter로 전체 앱 감싸기
    <BrowserRouter>
      <Routes>
        {/* / 경로 → 홈 페이지 */}
        <Route path="/" element={<Home />} />

        {/* /meeting 경로 → 회의록 AI 페이지 */}
        <Route path="/meeting" element={<MeetingAI />} />

        {/* /output 경로 → 산출물 AI 페이지 */}
        <Route path="/output" element={<OutputAI />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;