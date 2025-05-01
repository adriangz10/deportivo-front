import React, { useState, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; // Importar plugin

const API_BASE_URL = 'https://deportivo-production-6553.up.railway.app';

// Helper para icono de carga pequeño
const SmallSpinner = () => (
    <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


function TeamListPage() {
    const [teams, setTeams] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deletingInfo, setDeletingInfo] = useState({ type: null, id: null }); // Para saber qué se está borrando

    // Función para cargar equipos (reutilizable)
    const fetchTeams = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Asegúrate que este endpoint devuelva los jugadores anidados
            const response = await fetch(`${API_BASE_URL}/equipos`);
            if (!response.ok) {
                throw new Error(`Error al cargar equipos: ${response.status}`);
            }
            const data = await response.json();
             // Ordenar alfabéticamente por nombre de equipo
            data.sort((a, b) => a.nombre_equipo.localeCompare(b.nombre_equipo));
            setTeams(data);
        } catch (err) {
            console.error("Error fetching teams:", err);
            setError(err.message || 'No se pudieron cargar los equipos.');
        } finally {
            setIsLoading(false);
        }
    }, []); // useCallback para que no cambie en cada render

    // Cargar equipos al montar el componente
    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]); // Dependencia de fetchTeams

    // --- Funciones de Eliminación ---
    const handleDeletePlayer = async (playerId, playerName, teamName) => {
        if (!window.confirm(`¿Estás seguro de eliminar al jugador "${playerName}" del equipo "${teamName}"?`)) {
            return;
        }
        setDeletingInfo({ type: 'player', id: playerId });
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/jugadores/${playerId}`, { method: 'DELETE' });
            if (!response.ok && response.status !== 204) {
                const data = await response.json().catch(() => ({})); // Intenta parsear error, si no, objeto vacío
                throw new Error(data.message || `Error al eliminar jugador (${response.status})`);
            }
            // Éxito: Recargar la lista para ver el cambio
            await fetchTeams();
        } catch (err) {
            console.error("Error deleting player:", err);
            setError(err.message);
        } finally {
            setDeletingInfo({ type: null, id: null });
        }
    };

    const handleDeleteTeam = async (teamId, teamName) => {
        if (!window.confirm(`¿Estás seguro de eliminar TODO el equipo "${teamName}"? (Esto podría eliminar también a sus jugadores dependiendo del backend)`)) {
            return;
        }
        setDeletingInfo({ type: 'team', id: teamId });
        setError(null);
        try {
            const response = await fetch(`${API_BASE_URL}/equipos/${teamId}`, { method: 'DELETE' });
            if (!response.ok && response.status !== 204) {
                 const data = await response.json().catch(() => ({}));
                 // Manejar error específico si el backend lo impide (ej: por jugadores existentes)
                 if (response.status === 409 || response.status === 400) { // O el código que use tu backend
                      throw new Error(data.message || `No se pudo eliminar el equipo "${teamName}" (puede tener jugadores asociados).`);
                 }
                 throw new Error(data.message || `Error al eliminar equipo (${response.status})`);
            }
            // Éxito: Recargar la lista
             await fetchTeams();
        } catch (err) {
            console.error("Error deleting team:", err);
            setError(err.message);
        } finally {
            setDeletingInfo({ type: null, id: null });
        }
    };

    // --- Función de Exportar PDF ---
    const handleExportPdf = () => {
        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height;
        let startY = 15; // Margen superior inicial

        doc.setFontSize(18);
        doc.text('Lista de Equipos y Jugadores', 14, startY);
        startY += 10;

        teams.forEach((team, index) => {
            // Comprobar si hay espacio para el título del equipo y la cabecera de la tabla
            if (startY > pageHeight - 30) {
                doc.addPage();
                startY = 15; // Resetear Y en nueva página
            }

            doc.setFontSize(14);
            doc.setTextColor(40, 40, 40); // Gris oscuro
            doc.text(`Equipo: ${team.nombre_equipo}`, 14, startY);
            startY += 8;

            const tableColumn = ["Nombre", "Apellido", "DNI"];
            const tableRows = [];

            (team.jugadores || []).forEach(player => {
                const playerData = [
                    player.nombre,
                    player.apellido,
                    player.dni,
                ];
                tableRows.push(playerData);
            });

            if (tableRows.length > 0) {
                doc.autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    startY: startY,
                    theme: 'grid', // 'striped', 'grid', 'plain'
                    headStyles: { fillColor: [75, 85, 99] }, // Color cabecera (gris)
                    margin: { top: 5 }, // Margen sobre la tabla
                    didDrawPage: (data) => {
                        // Resetear Y si autoTable añade página
                        startY = data.cursor.y + 10; // Actualizar Y después de la tabla
                    }
                });
                 // Actualizar startY después de que autoTable haya dibujado (puede haber añadido página)
                startY = doc.lastAutoTable.finalY + 10;
            } else {
                 doc.setFontSize(10);
                 doc.setTextColor(100, 100, 100); // Gris
                 doc.text('Este equipo no tiene jugadores registrados.', 14, startY);
                 startY += 10;
            }

             // Añadir un espacio antes del siguiente equipo
             startY += 5;
        });

        doc.save(`lista_equipos_${new Date().toISOString().slice(0,10)}.pdf`);
    };

    // --- Renderizado ---
    if (isLoading && teams.length === 0) { // Mostrar carga inicial
        return <div className="text-center py-10"><SmallSpinner /> Cargando equipos...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">
                    Lista de Equipos Registrados
                </h1>
                <button
                    onClick={handleExportPdf}
                    disabled={teams.length === 0 || isLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Exportar a PDF
                </button>
            </div>

             {/* Mensaje de error general */}
             {error && (
                 <div className="mb-4 p-4 border border-red-300 bg-red-100 text-red-700 rounded-md">
                     <p className="font-bold">Error:</p> {error}
                 </div>
             )}


            {teams.length === 0 && !isLoading ? (
                <p className="text-center text-gray-600 py-10">No hay equipos registrados.</p>
            ) : (
                <div className="space-y-6">
                    {teams.map(team => (
                        <div key={team.id_equipo} className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                            <div className="px-4 py-4 sm:px-6 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-indigo-700">{team.nombre_equipo}</h2>
                                <button
                                    onClick={() => handleDeleteTeam(team.id_equipo, team.nombre_equipo)}
                                    disabled={deletingInfo.type === 'team' && deletingInfo.id === team.id_equipo}
                                    className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded shadow-sm text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                >
                                     {deletingInfo.type === 'team' && deletingInfo.id === team.id_equipo ? <SmallSpinner /> : (
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                     )}
                                    Eliminar Equipo
                                </button>
                            </div>

                            <div className="px-4 py-4 sm:px-6">
                                {(team.jugadores && team.jugadores.length > 0) ? (
                                    <ul className="divide-y divide-gray-200">
                                        {team.jugadores.map(player => (
                                            <li key={player.id_jugador} className="py-3 flex justify-between items-center">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-900">{player.nombre} {player.apellido}</p>
                                                    <p className="text-sm text-gray-500">DNI: {player.dni}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeletePlayer(player.id_jugador, `${player.nombre} ${player.apellido}`, team.nombre_equipo)}
                                                    disabled={deletingInfo.type === 'player' && deletingInfo.id === player.id_jugador}
                                                    className="inline-flex items-center p-1 border border-transparent rounded-full shadow-sm text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                                                    aria-label={`Eliminar jugador ${player.nombre}`}
                                                >
                                                     {deletingInfo.type === 'player' && deletingInfo.id === player.id_jugador ? <SmallSpinner /> : (
                                                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                     )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-500 italic">No hay jugadores registrados en este equipo.</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default TeamListPage;