import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MinutesAI from './pages/MinutesAI';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MinutesAI />} />
        <Route path="/minutes" element={<MinutesAI />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;