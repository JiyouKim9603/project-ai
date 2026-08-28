import { BrowserRouter, Routes, Route } from 'react-router-dom';
import OutputAI from './pages/OutputAI';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<OutputAI />} />
        <Route path="/output" element={<OutputAI />} />
      </Routes>
    </BrowserRouter>
  );
}
export default App;