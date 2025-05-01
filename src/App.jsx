// src/App.js
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header'; // Importa el Header
import TeamRegistrationForm from './components/TeamRegistrationForm'; // Tu formulario existente
import TeamRecoveryPage from './components/TeamRecoveryPage'; // El nuevo componente (lo crearemos)
import './index.css'; // Estilos de Tailwind

function App() {
  return (
    <BrowserRouter>
      <div className="bg-gray-100 min-h-screen">
        <Header /> {/* El Header se muestra en todas las páginas */}
        <main className="py-8"> {/* Añade padding al contenido principal */}
          <Routes>
            <Route path="/" element={<TeamRegistrationForm />} />
            <Route path="/recuperar" element={<TeamRecoveryPage />} />
            {/* Puedes añadir una ruta NotFound (404) aquí si quieres */}
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;