// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import TeamRegistrationForm from './components/TeamRegistrationForm';
import TeamRecoveryPage from './components/TeamRecoveryPage';
import TeamListPage from './components/TeamListPage'; // <-- Importar nuevo componente
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="bg-gray-100 min-h-screen">
        <Header />
        <main className="py-8">
          <Routes>
            <Route path="/" element={<TeamRegistrationForm />} />
            <Route path="/recuperar" element={<TeamRecoveryPage />} />
            <Route path="/admin/equipos" element={<TeamListPage />} /> {/* <-- Nueva Ruta */}
            {/* <Route path="*" element={<NotFound />} /> */}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;