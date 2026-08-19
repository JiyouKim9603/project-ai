import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import MeetingAI from './pages/MeetingAI';
import OutputAI from './pages/OutputAI';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/output" replace />} />
        <Route path="/meeting" element={<MeetingAI />} />
        <Route path="/output" element={<OutputAI />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;