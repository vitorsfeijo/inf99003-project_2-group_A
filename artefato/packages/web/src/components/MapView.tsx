import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Scenario, Plan, DailyTeamRoute, Patient } from '@routing/core';

interface MapViewProps {
  scenario: Scenario;
  plan: Plan | null;
  selectedDate: string;
}

const TEAM_COLORS = [
  '#2563eb', // Azul
  '#059669', // Verde
  '#d97706', // Âmbar
  '#dc2626', // Vermelho
  '#7c3aed', // Roxo
  '#db2777'  // Rosa
];

export const MapView: React.FC<MapViewProps> = ({ scenario, plan, selectedDate }) => {
  const centerLat = scenario.healthCenter?.location.lat || -30.0346;
  const centerLng = scenario.healthCenter?.location.lng || -51.2177;

  // Filtrar rotas do dia selecionado
  const dailyRoutes = plan ? plan.routes.filter(r => r.date === selectedDate) : [];
  const patientMap = new Map<string, Patient>(scenario.patients.map(p => [p.id, p]));

  // Ícone personalizado para o Posto de Saúde
  const healthCenterIcon = L.divIcon({
    className: 'custom-hc-icon',
    html: `<div style="background-color: #dc2626; color: white; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">🏥</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Renderizar Polígonos do Território */}
        {scenario.polygons.map(poly => (
          <Polygon
            key={poly.id}
            positions={poly.vertices.map(v => [v.lat, v.lng])}
            pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '4' }}
          >
            <Popup><strong>{poly.name}</strong> (Território da APS)</Popup>
          </Polygon>
        ))}

        {/* Marker do Posto de Saúde */}
        <Marker position={[scenario.healthCenter.location.lat, scenario.healthCenter.location.lng]} icon={healthCenterIcon}>
          <Popup>
            <strong>🏥 {scenario.healthCenter.name}</strong><br />
            Origem e Retorno de todas as equipes.
          </Popup>
        </Marker>

        {/* Renderizar Pacientes */}
        {scenario.patients.map((patient, pIdx) => {
          const patientIcon = L.divIcon({
            className: 'custom-patient-icon',
            html: `<div style="background-color: #475569; color: white; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${patient.code || pIdx + 1}</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          return (
            <Marker key={patient.id} position={[patient.location.lat, patient.location.lng]} icon={patientIcon}>
              <Popup>
                <strong>🏠 {patient.code}</strong><br />
                Duração estimada: {patient.defaultVisitDurationMinutes} min<br />
                Condições: {patient.conditions.map(c => c.conditionId).join(', ')}
              </Popup>
            </Marker>
          );
        })}

        {/* Renderizar Rotas Diárias das Equipes */}
        {dailyRoutes.map((route, rIdx) => {
          const color = TEAM_COLORS[rIdx % TEAM_COLORS.length];
          const team = scenario.teams.find(t => t.id === route.teamId);
          const teamName = team ? team.name : route.teamId;

          if (route.visits.length === 0) return null;

          // Sequência de Pontos: Posto -> Visita 1 -> Visita 2 -> ... -> Posto
          const polylinePoints: [number, number][] = [
            [scenario.healthCenter.location.lat, scenario.healthCenter.location.lng]
          ];

          route.visits.forEach(v => {
            const p = patientMap.get(v.patientId);
            if (p) {
              polylinePoints.push([p.location.lat, p.location.lng]);
            }
          });

          polylinePoints.push([scenario.healthCenter.location.lat, scenario.healthCenter.location.lng]);

          return (
            <React.Fragment key={`${route.teamId}_${route.date}`}>
              <Polyline
                positions={polylinePoints}
                pathOptions={{ color, weight: 4, opacity: 0.85 }}
              />

              {/* Números de Ordem de Atendimento na Rota */}
              {route.visits.map((visit, vIdx) => {
                const patient = patientMap.get(visit.patientId);
                if (!patient) return null;

                const orderIcon = L.divIcon({
                  className: 'custom-order-icon',
                  html: `<div style="background-color: ${color}; color: white; border: 2px solid white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">${vIdx + 1}</div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                });

                return (
                  <Marker
                    key={`visit_order_${route.teamId}_${vIdx}`}
                    position={[patient.location.lat, patient.location.lng]}
                    icon={orderIcon}
                  >
                    <Popup>
                      <strong>Ordem {vIdx + 1}: {patient.code}</strong><br />
                      Equipe: {teamName}<br />
                      Horário: {visit.estimatedStartTime} - {visit.estimatedEndTime}<br />
                      Deslocamento anterior: {visit.travelDistanceKmFromPrevious} km ({visit.travelTimeMinutesFromPrevious} min)
                    </Popup>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};
