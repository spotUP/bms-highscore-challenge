import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Pong404Clean from './pages/Pong404Clean';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Pong404Clean />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
