import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '../../public/logo.png';

function Header() {
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const toggleMenu = () => {
    setMenuAbierto(!menuAbierto);
  };

  const getLinkClass = (path) => {
    return location.pathname === path || (path === '/admin' && location.pathname.startsWith('/admin')) // Marcar 'Administración' como activo si estamos en subrutas
    
      ? 'bg-indigo-700 text-white block px-3 py-2 rounded-md text-sm font-medium'
      : 'text-indigo-100 hover:bg-indigo-500 hover:bg-opacity-75 block px-3 py-2 rounded-md text-sm font-medium';
  };

  return (
    <nav className="bg-indigo-600 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
          <img src={logo} alt="Logo" className="h-10 w-auto" />
          </div>

          {/* Menú escritorio */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link to="/" className={getLinkClass('/')}>
                Inscripción
              </Link>
              <Link to="/recuperar" className={getLinkClass('/recuperar')}>
                Recuperar Equipo
              </Link>
               {/* Nuevo Enlace */}
               <Link to="/admin" className={getLinkClass('/admin')}>
                
              </Link> 
            </div>
          </div>

          {/* Botón menú móvil */}
          <div className="md:hidden">
            <button
              onClick={toggleMenu}
              className="text-white focus:outline-none focus:ring-2 focus:ring-white"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuAbierto ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menú móvil desplegable */}
      {menuAbierto && (
        <div className="md:hidden px-2 pb-3 space-y-1">
          <Link to="/" className={getLinkClass('/')} onClick={() => setMenuAbierto(false)}>
            Inscripción
          </Link>
          <Link to="/recuperar" className={getLinkClass('/recuperar')} onClick={() => setMenuAbierto(false)}>
            Recuperar Equipo
          </Link>
        </div>
      )}
    </nav>
  );
}

export default Header;
