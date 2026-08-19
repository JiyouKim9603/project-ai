import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import MinutesAI from './pages/MinutesAI';
import OutputAI from './pages/OutputAI';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/output" replace />} />
        <Route path="/minutes" element={<MinutesAI />} />
        <Route path="/output" element={<OutputAI />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;