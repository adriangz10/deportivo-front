import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'https://deportivo-production-6553.up.railway.app';
const MAX_PLAYERS = 8;

function TeamRecoveryPage() {
  const [recoveryCode, setRecoveryCode] = useState('');
  const [originalTeamData, setOriginalTeamData] = useState(null); // Guardar datos originales
  const [editableTeamData, setEditableTeamData] = useState(null); // Datos para edición
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editDniErrors, setEditDniErrors] = useState({}); // Errores DNI en modo edición

    // --- Validación DNI duplicado en modo edición ---
    useEffect(() => {
        if (!editableTeamData) return; // Solo si hay datos cargados

        const currentDnis = editableTeamData.jugadores
          .map(p => p.dni?.trim()) // Usar optional chaining por si acaso
          .filter(dni => !!dni);
        const errors = {};
        let hasDuplicates = false;

        currentDnis.forEach((dni, index) => {
          if (currentDnis.indexOf(dni) !== index) {
            hasDuplicates = true;
            editableTeamData.jugadores.forEach((p, i) => {
              if (p.dni?.trim() === dni) {
                errors[i] = 'DNI duplicado en este formulario.';
              }
            });
          }
        });

        if(!hasDuplicates) {
            setEditDniErrors({});
        } else {
            setEditDniErrors(errors);
        }

      }, [editableTeamData]);


  const handleFetchTeam = async () => {
    if (!recoveryCode.trim()) {
      setError('Por favor, ingresa un código de recuperación.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setSuccessMessage('');
    setOriginalTeamData(null);
    setEditableTeamData(null);
    setEditDniErrors({});

    try {
      const response = await fetch(`${API_BASE_URL}/equipos/recuperar/${recoveryCode.trim()}`);
      if (response.status === 404) {
        throw new Error(`No se encontró ningún equipo con el código "${recoveryCode.trim()}".`);
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Error al buscar equipo (${response.status}): ${errorData.message || 'Error desconocido'}`);
      }
      const data = await response.json();
      // Guardar copia original y copia editable
      setOriginalTeamData(JSON.parse(JSON.stringify(data))); // Copia profunda
      setEditableTeamData(data);

    } catch (err) {
      console.error("Error fetching team:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Handlers para editar datos ---
  const handleTeamNameChange = (event) => {
    setEditableTeamData({
      ...editableTeamData,
      nombre_equipo: event.target.value,
    });
  };

  const handlePlayerChange = (index, event) => {
    const { name, value } = event.target;
    const updatedPlayers = [...editableTeamData.jugadores];
    updatedPlayers[index] = {
      ...updatedPlayers[index],
      [name]: value,
    };
    setEditableTeamData({
      ...editableTeamData,
      jugadores: updatedPlayers,
    });
     // Limpiar error específico de DNI para este campo mientras se escribe
     if (name === 'dni' && editDniErrors[index]) {
        const newDniErrors = { ...editDniErrors };
        delete newDniErrors[index];
        setEditDniErrors(newDniErrors);
    }
  };

  const addPlayer = () => {
     if (editableTeamData && editableTeamData.jugadores.length < MAX_PLAYERS) {
         const newPlayer = { nombre: '', apellido: '', dni: '', id_jugador: undefined }; // Sin ID, marca como nuevo
         setEditableTeamData({
             ...editableTeamData,
             jugadores: [...editableTeamData.jugadores, newPlayer]
         });
     }
  };

  const removePlayer = (index) => {
      if (!editableTeamData || editableTeamData.jugadores.length <= 0) return; // No debería pasar si hay botón

      const playerToRemove = editableTeamData.jugadores[index];
      const updatedPlayers = editableTeamData.jugadores.filter((_, i) => i !== index);

      // Si el jugador tenía un ID (existía originalmente), necesitamos marcarlo para borrar en el backend
      // Vamos a añadir una propiedad temporal _deleted para manejarlo en handleSaveChanges
      const playersWithDeletionMark = editableTeamData.jugadores.map((p, i) => {
            if (i === index && p.id_jugador) {
                return { ...p, _deleted: true }; // Marcar para borrar
            }
            return p;
      });


      // Actualizamos el estado visual filtrando, pero guardamos la marca en una copia
      const stateToUpdate = {
            ...editableTeamData,
            jugadores: playersWithDeletionMark.filter(p => !p._deleted) // Estado visual sin el borrado
      };
      // Guardamos la info completa (incluyendo marcados) para el submit
      setEditableTeamData(stateToUpdate);
      // Necesitamos guardar la lista *completa* con las marcas en algún lado o reconstruirla al guardar.
      // Por simplicidad, reconstruiremos al guardar comparando con originalTeamData.

      // Recalcular errores DNI
      // useEffect se encargará
  };

  // --- Lógica para guardar cambios ---
  const handleSaveChanges = async () => {
      setError(null);
      setSuccessMessage('');

       // Validaciones básicas antes de guardar
        if (!editableTeamData.nombre_equipo.trim()) {
             setError('El nombre del equipo no puede estar vacío.');
             return;
        }
        for (const player of editableTeamData.jugadores) {
             if (!player.nombre.trim() || !player.apellido.trim() || !player.dni.trim()) {
                 setError('Todos los campos de cada jugador (nombre, apellido, DNI) son obligatorios.');
                 return;
             }
        }
         if (Object.keys(editDniErrors).length > 0) {
             setError('Hay DNIs duplicados en el formulario. Por favor, corrígelos.');
             return;
         }

      setIsSaving(true);

      const { id_equipo } = originalTeamData; // ID del equipo no cambia
      const promises = [];
      const errors = [];

      // 1. Actualizar Nombre del Equipo (si cambió)
      if (editableTeamData.nombre_equipo !== originalTeamData.nombre_equipo) {
          promises.push(
              fetch(`${API_BASE_URL}/equipos/${id_equipo}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ nombre_equipo: editableTeamData.nombre_equipo }),
              }).then(async res => {
                  if (!res.ok) {
                     const data = await res.json();
                     errors.push(`Error equipo: ${data.message || res.status}`);
                     return false; // Indicar fallo
                  }
                  return true; // Indicar éxito
              }).catch(err => { errors.push(`Error equipo: ${err.message}`); return false; })
          );
      }

      // 2. Procesar Jugadores: Identificar nuevos, modificados y eliminados
      const originalPlayerIds = new Set(originalTeamData.jugadores.map(p => p.id_jugador));
      const currentPlayerIds = new Set(editableTeamData.jugadores.map(p => p.id_jugador).filter(id => id !== undefined));

      // Jugadores a añadir (sin id_jugador en editableTeamData)
      const playersToAdd = editableTeamData.jugadores.filter(p => p.id_jugador === undefined);
      playersToAdd.forEach(player => {
          promises.push(
              fetch(`${API_BASE_URL}/jugadores`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      id_equipo: id_equipo,
                      nombre: player.nombre,
                      apellido: player.apellido,
                      dni: player.dni
                  }),
              }).then(async res => {
                if (!res.ok) {
                    const data = await res.json();
                    errors.push(`Error añadiendo ${player.nombre}: ${data.message || res.status}`);
                    return false;
                }
                // OPTIONAL: Update the player in editableTeamData with the new ID from res.json()
                return true;
            }).catch(err => { errors.push(`Error añadiendo ${player.nombre}: ${err.message}`); return false; })
          );
      });

      // Jugadores a eliminar (en original pero no en editable)
      originalTeamData.jugadores.forEach(origPlayer => {
          if (!currentPlayerIds.has(origPlayer.id_jugador)) {
              promises.push(
                  fetch(`${API_BASE_URL}/jugadores/${origPlayer.id_jugador}`, { method: 'DELETE' })
                  .then(res => {
                      if (!res.ok && res.status !== 204) { // 204 es éxito sin contenido
                         errors.push(`Error eliminando ${origPlayer.nombre}: ${res.status}`);
                         return false;
                      }
                      return true;
                  }).catch(err => { errors.push(`Error eliminando ${origPlayer.nombre}: ${err.message}`); return false; })
              );
          }
      });

       // Jugadores a actualizar (con ID en editableTeamData y potencialmente cambiados)
       editableTeamData.jugadores.forEach(editPlayer => {
            if (editPlayer.id_jugador !== undefined) { // Solo los que ya existían
                const originalPlayer = originalTeamData.jugadores.find(p => p.id_jugador === editPlayer.id_jugador);
                // Comprobar si algo cambió (simple comparación de strings, podría ser más robusta)
                if (JSON.stringify(originalPlayer) !== JSON.stringify(editPlayer)) {
                     promises.push(
                         fetch(`${API_BASE_URL}/jugadores/${editPlayer.id_jugador}`, {
                             method: 'PATCH',
                             headers: { 'Content-Type': 'application/json' },
                             body: JSON.stringify({
                                 nombre: editPlayer.nombre,
                                 apellido: editPlayer.apellido,
                                 dni: editPlayer.dni
                                 // No enviar id_equipo en PATCH de jugador usualmente
                             }),
                         }).then(async res => {
                            if (!res.ok) {
                                const data = await res.json();
                                errors.push(`Error actualizando ${editPlayer.nombre}: ${data.message || res.status}`);
                                return false;
                            }
                            return true;
                         }).catch(err => { errors.push(`Error actualizando ${editPlayer.nombre}: ${err.message}`); return false; })
                     );
                }
            }
       });


      // Ejecutar todas las promesas
      const results = await Promise.allSettled(promises);

      // Verificar resultados generales
      const allSucceeded = results.every(r => r.status === 'fulfilled' && r.value === true);


      if (allSucceeded && errors.length === 0) {
          setSuccessMessage('¡Cambios guardados exitosamente!');
          // Actualizar datos originales para reflejar el nuevo estado guardado
          // Es mejor refetchear para asegurar consistencia o actualizar manualmente con cuidado
           const updatedResponse = await fetch(`${API_BASE_URL}/equipos/recuperar/${recoveryCode.trim()}`);
           const updatedData = await updatedResponse.json();
           setOriginalTeamData(JSON.parse(JSON.stringify(updatedData)));
           setEditableTeamData(updatedData);

      } else {
          setError(`Se produjeron errores al guardar:\n- ${errors.join('\n- ')}`);
      }

      setIsSaving(false);
  };


  return (
    <div className="max-w-4xl mx-auto p-6 md:p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
            Recuperar y Editar Equipo
        </h1>

        {/* Sección de Búsqueda */}
        <div className="mb-8 p-6 bg-white rounded-lg shadow border border-gray-200">
            <label htmlFor="recoveryCode" className="block text-lg font-medium text-gray-700 mb-2">
                Ingresa el Código de Recuperación
            </label>
            <div className="flex flex-col sm:flex-row gap-4">
                 <input
                    type="text"
                    id="recoveryCode"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="flex-grow px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                    placeholder="Ej: 2356"
                    disabled={isLoading || isSaving}
                />
                 <button
                    onClick={handleFetchTeam}
                    disabled={isLoading || isSaving || !recoveryCode.trim()}
                    className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                         <> {/* SVG Loading */} Buscando...</>
                    ) : (
                         'Buscar Equipo'
                     )}
                 </button>
            </div>
             {/* Mensaje de error de búsqueda */}
             {!isLoading && error && !editableTeamData && ( // Mostrar solo si no está cargando y no hay datos cargados
                <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
        </div>


        {/* Sección de Edición (Mostrar solo si se cargó un equipo) */}
        {editableTeamData && (
             <div className="p-6 md:p-8 bg-white rounded-lg shadow-lg border border-gray-200">
                 <h2 className="text-2xl font-bold text-gray-800 mb-6">Editando Equipo</h2>
                 <form onSubmit={(e) => { e.preventDefault(); handleSaveChanges(); }} noValidate>
                    {/* Nombre del Equipo */}
                    <div className="mb-6">
                         <label htmlFor="editTeamName" className="block text-lg font-medium text-gray-700 mb-2">
                            Nombre del Equipo
                         </label>
                         <input
                            type="text"
                            id="editTeamName"
                            value={editableTeamData.nombre_equipo}
                            onChange={handleTeamNameChange}
                            required
                            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                            disabled={isSaving}
                         />
                    </div>

                     {/* Jugadores */}
                    <h3 className="text-xl font-semibold text-gray-700 mb-4 border-b pb-2">
                        Jugadores ({editableTeamData.jugadores.length} / {MAX_PLAYERS})
                    </h3>

                    {editableTeamData.jugadores.map((player, index) => (
                         <div key={player.id_jugador ?? `new-${index}`} className={`mb-5 p-4 border rounded-md relative bg-gray-50 ${editDniErrors[index] ? 'border-red-400' : 'border-gray-200'}`}>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <p className="md:col-span-4 text-md font-semibold text-indigo-600 mb-2">Jugador {index + 1} {player.id_jugador ? `(ID: ${player.id_jugador})` : '(Nuevo)'}</p>
                                {/* Inputs similares al formulario de registro, usando handlePlayerChange */}
                                <div className="md:col-span-2"> <label /*...*/ >Nombre</label> <input type="text" name="nombre" value={player.nombre} onChange={(e) => handlePlayerChange(index, e)} disabled={isSaving} className="mt-1 w-full ..." /> </div>
                                <div className="md:col-span-2"> <label /*...*/ >Apellido</label> <input type="text" name="apellido" value={player.apellido} onChange={(e) => handlePlayerChange(index, e)} disabled={isSaving} className="mt-1 w-full ..." /> </div>
                                <div className="md:col-span-3">
                                    <label /*...*/ >DNI</label>
                                    <input type="text" name="dni" value={player.dni} onChange={(e) => handlePlayerChange(index, e)} disabled={isSaving} className={`mt-1 w-full ... ${editDniErrors[index] ? 'border-red-500' : 'border-gray-300'}`} aria-invalid={!!editDniErrors[index]} aria-describedby={editDniErrors[index] ? `edit-dni-error-${index}` : undefined} />
                                    {editDniErrors[index] && (<p id={`edit-dni-error-${index}`} className="mt-1 text-xs text-red-600">{editDniErrors[index]}</p>)}
                                </div>
                                {/* Botón Eliminar Jugador */}
                                {editableTeamData.jugadores.length > 0 && ( // Siempre mostrar si hay jugadores? O > 1? Depende si puedes tener equipo vacío
                                     <div className="md:col-span-1 flex items-end justify-end md:justify-start">
                                        <button type="button" onClick={() => removePlayer(index)} disabled={isSaving} className="mt-1 inline-flex items-center px-3 py-2 ... bg-red-600 ... disabled:opacity-50">
                                            {/* Icono */} Eliminar
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                     {/* Botón Añadir Jugador */}
                     {editableTeamData.jugadores.length < MAX_PLAYERS && (
                          <div className="flex justify-start mb-6">
                             <button type="button" onClick={addPlayer} disabled={isSaving} className="inline-flex items-center px-4 py-2 ... bg-indigo-100 ... disabled:opacity-50">
                                 {/* Icono */} Agregar Jugador
                             </button>
                          </div>
                      )}
                      {editableTeamData.jugadores.length >= MAX_PLAYERS && (
                            <p className="text-sm text-yellow-600 mb-6">Has alcanzado el límite de {MAX_PLAYERS} jugadores.</p>
                      )}

                     {/* Mensajes de Error/Éxito al guardar */}
                     {error && editableTeamData && ( // Mostrar error de guardado solo si estamos en modo edición
                        <div className="mb-4 p-4 border border-red-300 bg-red-100 text-red-700 rounded-md whitespace-pre-wrap">
                             <p className="font-bold">Error al guardar:</p> {error}
                        </div>
                     )}
                     {successMessage && (
                        <div className="mb-4 p-4 border border-green-300 bg-green-100 text-green-700 rounded-md">
                             <p className="font-bold">¡Éxito!</p> {successMessage}
                        </div>
                     )}

                    {/* Botón Guardar Cambios */}
                    <div className="flex justify-end mt-8">
                         <button type="submit" disabled={isSaving || Object.keys(editDniErrors).length > 0} className="inline-flex items-center justify-center w-full md:w-auto px-8 py-3 ... bg-green-600 hover:bg-green-700 focus:ring-green-500 disabled:opacity-50">
                             {isSaving ? ( <> {/* SVG Loading */} Guardando...</> ) : ( 'Guardar Cambios' )}
                         </button>
                    </div>
                 </form>
            </div>
        )}
    </div>
  );
}

export default TeamRecoveryPage;