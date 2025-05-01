// src/components/TeamRegistrationForm.jsx
import React, { useState, useEffect } from 'react'; // Añade useEffect

const API_BASE_URL = 'https://deportivo-production-6553.up.railway.app';
const MAX_PLAYERS = 8;

function TeamRegistrationForm() {
  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState([
    { nombre: '', apellido: '', dni: '' },
  ]);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teamCode, setTeamCode] = useState('');
  const [dniErrors, setDniErrors] = useState({}); // Estado para errores de DNI duplicado en el form

  // --- Validación de DNI duplicado DENTRO del formulario ---
  useEffect(() => {
    const currentDnis = players
      .map(p => p.dni.trim())
      .filter(dni => dni !== ''); // Obtener DNIs no vacíos
    const errors = {};
    let hasDuplicates = false;

    currentDnis.forEach((dni, index) => {
      if (currentDnis.indexOf(dni) !== index) { // Si el DNI aparece antes en la lista
        hasDuplicates = true;
        // Marcar todos los índices que tienen este DNI duplicado
        players.forEach((p, i) => {
          if (p.dni.trim() === dni) {
            errors[i] = 'DNI duplicado en este formulario.';
          }
        });
      }
    });

    // Si no hay duplicados, limpiar errores específicos de DNI
    // (Podríamos mantener otros errores, pero por simplicidad limpiamos todos)
    if(!hasDuplicates) {
        setDniErrors({});
    } else {
        setDniErrors(errors);
    }

  }, [players]); // Se ejecuta cada vez que cambia la lista de jugadores


  const handleTeamNameChange = (event) => {
    setTeamName(event.target.value);
     // Podrías añadir aquí una validación con debounce contra el backend si quieres
  };

  const handlePlayerChange = (index, event) => {
    const { name, value } = event.target;
    const updatedPlayers = [...players];
    updatedPlayers[index] = {
      ...updatedPlayers[index],
      [name]: value,
    };
    setPlayers(updatedPlayers);

    // Limpiar error específico de DNI para este campo mientras se escribe
    if (name === 'dni' && dniErrors[index]) {
        const newDniErrors = { ...dniErrors };
        delete newDniErrors[index]; // Intenta limpiar, useEffect lo re-evaluará
        setDniErrors(newDniErrors);
    }
  };

  const addPlayer = () => {
    if (players.length < MAX_PLAYERS) {
      setPlayers([...players, { nombre: '', apellido: '', dni: '' }]);
    }
  };

  const removePlayer = (index) => {
    if (players.length <= 1) return;
    const updatedPlayers = players.filter((_, i) => i !== index);
    setPlayers(updatedPlayers);
     // Recalcular errores de DNI después de eliminar
     // (useEffect se encargará automáticamente al cambiar `players`)
  };

  const validateForm = () => {
    if (!teamName.trim()) {
      return 'El nombre del equipo es obligatorio.';
    }
    for (const player of players) {
      if (!player.nombre.trim() || !player.apellido.trim() || !player.dni.trim()) {
        return 'Todos los campos de cada jugador (nombre, apellido, DNI) son obligatorios.';
      }
    }
     // Verificar si hay errores de DNI detectados por useEffect
     if (Object.keys(dniErrors).length > 0) {
         return 'Hay DNIs duplicados en el formulario. Por favor, corrígelos.';
     }

    return null; // Sin errores
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    // Limpiar mensajes previos excepto el código si ya existe
    setError(null);
    setSuccessMessage('');
    // setTeamCode(''); // No limpiar el código aquí

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      // --- 1. Crear el Equipo ---
      const teamResponse = await fetch(`${API_BASE_URL}/equipos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_equipo: teamName }),
      });

      if (!teamResponse.ok) {
        const errorData = await teamResponse.json();
        // Captura específica del error de nombre de equipo duplicado del backend
        if (teamResponse.status === 409 && errorData.message?.includes('nombre de equipo')) {
             throw new Error(`Error: ${errorData.message}`);
        }
        throw new Error(`Error al crear equipo (${teamResponse.status}): ${errorData.message || 'Error desconocido'}`);
      }

      const createdTeam = await teamResponse.json();
      const teamId = createdTeam.id_equipo;
      const recoveryCode = createdTeam.codigo_recuperacion; // Guardar temporalmente

      // --- 2. Crear los Jugadores ---
      const playerPromises = players.map((player) =>
        fetch(`${API_BASE_URL}/jugadores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_equipo: teamId,
            nombre: player.nombre,
            apellido: player.apellido,
            dni: player.dni,
          }),
        })
      );

      const playerResponses = await Promise.allSettled(playerPromises); // Usar allSettled para procesar todos

      const playerErrors = [];
      const successfulPlayers = [];

      for (let i = 0; i < playerResponses.length; i++) {
        const result = playerResponses[i];
        if (result.status === 'fulfilled') {
            const response = result.value;
            if (!response.ok) {
                const errorData = await response.json();
                 // Captura específica del error de DNI duplicado del backend
                 if (response.status === 409 && errorData.message?.includes('DNI')) {
                     playerErrors.push(`Jugador ${i + 1} (${players[i].nombre}): ${errorData.message}`);
                 } else {
                     playerErrors.push(`Jugador ${i + 1} (${players[i].nombre}): ${errorData.message || `Error ${response.status}`}`);
                 }
            } else {
                successfulPlayers.push(await response.json());
            }
        } else { // status === 'rejected' (error de red, etc.)
            playerErrors.push(`Jugador ${i + 1} (${players[i].nombre}): Error de conexión - ${result.reason}`);
        }
      }


      if (playerErrors.length > 0) {
        // Informar errores Y POSIBLEMENTE eliminar equipo creado si fallaron jugadores
        // Por simplicidad ahora, solo informamos. Una lógica de rollback sería más compleja.
        throw new Error(`Equipo creado (parcialmente), pero falló la inscripción de jugadores:\n- ${playerErrors.join('\n- ')}`);
      }

      // --- Éxito Total ---
      setSuccessMessage(`¡Equipo "${createdTeam.nombre_equipo}" y ${players.length} jugador(es) registrados exitosamente!`);
      setTeamCode(recoveryCode); // Mostrar código de recuperación

      // <<< --- LIMPIAR FORMULARIO --- >>>
      setTeamName('');
      setPlayers([{ nombre: '', apellido: '', dni: '' }]);
      setDniErrors({}); // Limpiar errores de DNI del formulario
      // No limpiar error o success message inmediatamente para que el usuario los vea

    } catch (err) {
      console.error("Error en el registro:", err);
      setError(err.message || 'Ocurrió un error inesperado durante el registro.');
      // No limpiar formulario si hay error general
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 bg-white rounded-lg shadow-lg border border-gray-200">
      {/* ... (resto del h1 del formulario sin cambios) ... */}
       <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
        Inscripción de Equipos
      </h1>

      <form onSubmit={handleSubmit} noValidate>
        {/* ... (input nombre equipo sin cambios) ... */}
         <div className="mb-6">
          <label htmlFor="teamName" className="block text-lg font-medium text-gray-700 mb-2">
            Nombre del Equipo
          </label>
          <input
            type="text"
            id="teamName"
            name="teamName"
            value={teamName}
            onChange={handleTeamNameChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg"
            placeholder="Ej: Los Cóndores FC"
            disabled={isLoading}
          />
        </div>

        <h2 className="text-2xl font-semibold text-gray-700 mb-4 border-b pb-2">
          Jugadores ({players.length} / {MAX_PLAYERS})
        </h2>

        {players.map((player, index) => (
          <div key={index} className={`mb-5 p-4 border rounded-md relative bg-gray-50 ${dniErrors[index] ? 'border-red-400' : 'border-gray-200'}`}> {/* Resaltar si hay error DNI */}
             <p className="md:col-span-2 text-md font-semibold text-indigo-600 mb-2">Jugador {index + 1}</p>
             <div className="grid grid-cols-1 md:grid-cols-12 gap-4"> {/* Mover grid aquí */}
                
                {/* Nombre */}
                <div className="md:col-span-4">
                  <label htmlFor={`nombre-${index}`} className="block text-sm font-medium text-gray-600">
                    Nombre(s)
                  </label>
                  <input
                type="text"
                id={`nombre-${index}`}
                name="nombre"
                value={player.nombre}
                onChange={(e) => handlePlayerChange(index, e)}
                required
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Juan Ignacio"
                disabled={isLoading}
              />
                </div>
                {/* Apellido */}
                <div className="md:col-span-4">
                  <label htmlFor={`apellido-${index}`} className="block text-sm font-medium text-gray-600">
                    Apellido(s)
                  </label>
                  <input
                type="text"
                id={`apellido-${index}`}
                name="apellido"
                value={player.apellido}
                onChange={(e) => handlePlayerChange(index, e)}
                required
                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Pérez García"
                disabled={isLoading}
              />
                </div>
                {/* DNI */}
                <div className="md:col-span-4">
                  <label htmlFor={`dni-${index}`} className="block text-sm font-medium text-gray-600">
                    DNI (sin puntos)
                  </label>
                  <input
                    type="text"
                    id={`dni-${index}`}
                    name="dni"
                    value={player.dni}
                    onChange={(e) => handlePlayerChange(index, e)}
                    required
                    className={`mt-1 w-full px-3 py-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm ${dniErrors[index] ? 'border-red-500' : 'border-gray-300'}`} // Estilo de borde en error DNI
                    placeholder="30123456"
                    disabled={isLoading}
                    aria-invalid={!!dniErrors[index]} // Accesibilidad: indicar campo inválido
                    aria-describedby={dniErrors[index] ? `dni-error-${index}` : undefined}
                  />
                   {/* Mensaje de error específico para DNI duplicado en el form */}
                   {dniErrors[index] && (
                       <p id={`dni-error-${index}`} className="mt-1 text-xs text-red-600">{dniErrors[index]}</p>
                   )}
                </div>
                 {/* Botón Eliminar Jugador */}
                 {players.length > 1 && (
                     <div className="md:col-span-1 flex items-end justify-end md:justify-start">
                     <button
                       type="button"
                       onClick={() => removePlayer(index)}
                       disabled={isLoading}
                       className="mt-1 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                     >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                       Eliminar
                     </button>
                   </div>
                  )}
                </div> {/* Fin del grid */}
          </div>
        ))}

        {/* Botón Añadir Jugador */}
        {players.length < MAX_PLAYERS && (
          <div className="flex justify-start mb-6">
            <button
              type="button"
              onClick={addPlayer}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-dashed border-indigo-400 text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
             </svg>
              Agregar Otro Jugador
            </button>
          </div>
        )}
         {players.length >= MAX_PLAYERS && (
            <p className="text-sm text-yellow-600 mb-6">Has alcanzado el límite de {MAX_PLAYERS} jugadores.</p>
        )}


        {/* Mensajes de Error y Éxito */}
        {error && (
          <div className="mb-4 p-4 border border-red-300 bg-red-100 text-red-700 rounded-md whitespace-pre-wrap">
            <p className="font-bold">Error:</p>
            {error}
          </div>
        )}
        {successMessage && (
          <div className="mb-4 p-4 border border-green-300 bg-green-100 text-green-700 rounded-md">
             <p className="font-bold">¡Éxito!</p>
             {successMessage}
             {teamCode && (
                <p className="mt-2">Código de recuperación del equipo: <strong className="font-mono bg-gray-200 px-1 rounded">{teamCode}</strong></p>
             )}
          </div>
        )}


        {/* Botón de Envío */}
        <div className="flex justify-end mt-8">
          <button
            type="submit"
            disabled={isLoading || Object.keys(dniErrors).length > 0} // Deshabilitar también si hay errores de DNI en el form
            className="inline-flex items-center justify-center w-full md:w-auto px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* ... (lógica icono loading/texto sin cambios) ... */}
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Registrando...
              </>
            ) : (
              'Registrar Equipo y Jugadores'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default TeamRegistrationForm;