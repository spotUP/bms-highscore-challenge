import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Pong404WebGL from './pages/Pong404WebGL';
import WebGLTest from './pages/WebGLTest';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/webgl-test" element={<WebGLTest />} />
        <Route path="/webgl" element={<Pong404WebGL />} />
        <Route path="/pong" element={<Pong404WebGL />} />
        <Route path="*" element={<Pong404WebGL />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
