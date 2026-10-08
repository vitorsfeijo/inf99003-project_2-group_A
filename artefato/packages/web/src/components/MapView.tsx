import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Scenario, Plan, Patient } from '@routing/core';
import { fetchRoadRoute, RoadRoute } from '../services/api';

interface MapViewProps {
  scenario: Scenario | null;
  plan: Plan | null;
  selectedDate: string;
  walkingNetworkConfigured: boolean;
}

const FitTerritory: React.FC<{ scenario: Scenario | null }> = ({ scenario }) => {
  const map = useMap();
  useEffect(() => {
    const vertices = scenario?.polygons.flatMap(polygon => polygon.vertices) ?? [];
    if (vertices.length) map.fitBounds(L.latLngBounds(vertices.map(vertex => [vertex.lat, vertex.lng])), { padding: [28, 28], maxZoom: 15 });
  }, [map, scenario]);
  return null;
};

const TEAM_COLORS = [
  '#2563eb', // Azul
  '#059669', // Verde
  '#d97706', // Âmbar
  '#dc2626', // Vermelho
  '#7c3aed', // Roxo
  '#db2777'  // Rosa
];

export const MapView: React.FC<MapViewProps> = ({ scenario, plan, selectedDate, walkingNetworkConfigured }) => {
  const centerLat = scenario?.healthCenter.location.lat ?? -30.0346;
  const centerLng = scenario?.healthCenter.location.lng ?? -51.2177;
  const [roadRoutes, setRoadRoutes] = useState<Record<string, RoadRoute>>({});
  const [roadError, setRoadError] = useState<string | null>(null);
  const [roadLoaded, setRoadLoaded] = useState(false);

  // Filtrar rotas do dia selecionado
  const dailyRoutes = plan ? plan.routes.filter(r => r.date === selectedDate) : [];
  const patientMap = new Map<string, Patient>((scenario?.patients ?? []).map(p => [p.id, p]));

  useEffect(() => {
    setRoadRoutes({});
    setRoadError(null);
    setRoadLoaded(false);
    if (!plan) return;
    const controller = new AbortController();
    const routes = plan.routes.filter(route => route.date === selectedDate && route.visits.length > 0);
    Promise.allSettled(routes.map(async route => {
      const road = await fetchRoadRoute(plan.id, selectedDate, route.teamId, controller.signal);
      return [route.teamId, road] as const;
    })).then(results => {
      if (!controller.signal.aborted) {
        setRoadRoutes(Object.fromEntries(results.filter(result => result.status === 'fulfilled')
          .map(result => (result as PromiseFulfilledResult<readonly [string, RoadRoute]>).value)));
        const failures = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[];
        if (failures.length) setRoadError(failures.map(result => result.reason instanceof Error ? result.reason.message : String(result.reason)).join(' · '));
        setRoadLoaded(true);
      }
    });
    return () => controller.abort();
  }, [plan, selectedDate]);

  // Ícone personalizado para o Posto de Saúde
  const healthCenterIcon = L.divIcon({
    className: 'custom-hc-icon',
    html: `<div style="background-color: #dc2626; color: white; border: 2px solid white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">🏥</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', isolation: 'isolate' }}>
      <MapContainer
        key={`${scenario?.id ?? 'porto_alegre'}_${centerLat}_${centerLng}`}
        center={[centerLat, centerLng]}
        zoom={14}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitTerritory scenario={scenario} />

        {/* Renderizar Polígonos do Território */}
        {(scenario?.polygons ?? []).map(poly => (
          <Polygon
            key={poly.id}
            positions={[poly.vertices, ...(poly.holes ?? [])].map(ring => ring.map(v => [v.lat, v.lng] as [number, number]))}
            pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '4' }}
          >
            <Popup><strong>{poly.name}</strong> (Território da APS)</Popup>
          </Polygon>
        ))}

        {/* Marker do Posto de Saúde */}
        {scenario && <Marker position={[scenario.healthCenter.location.lat, scenario.healthCenter.location.lng]} icon={healthCenterIcon}>
          <Popup>
            <strong>🏥 {scenario.healthCenter.name}</strong><br />
            Origem e Retorno de todas as equipes.
          </Popup>
        </Marker>}

        {/* Renderizar Pacientes */}
        {(scenario?.patients ?? []).map((patient, pIdx) => {
          const patientIcon = L.divIcon({
            className: 'custom-patient-icon',
            html: `<div style="background-color: #475569; color: white; border: 2px solid white; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${pIdx + 1}</div>`,
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
        {dailyRoutes.map(route => {
          if (!scenario) return null;
          const color = TEAM_COLORS[Math.max(0, scenario.teams.findIndex(t => t.id === route.teamId)) % TEAM_COLORS.length];
          const team = scenario.teams.find(t => t.id === route.teamId);
          const teamName = team ? team.name : route.teamId;

          if (route.visits.length === 0) return null;

          return (
            <React.Fragment key={`${route.teamId}_${route.date}`}>
              {roadRoutes[route.teamId] && <Polyline
                positions={roadRoutes[route.teamId].positions}
                pathOptions={{ color, weight: 4, opacity: 0.85 }}
              />}

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
      {plan && <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 500, background: 'white', padding: '0.6rem 0.8rem', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,.18)', maxWidth: 260, fontSize: 12 }}>
        {roadError ? `Trajeto viário indisponível: ${roadError}` : Object.keys(roadRoutes).length ? 'Trajeto e custo pela rede de caminhada OSRM' : roadLoaded ? 'Nenhuma visita com trajeto neste dia' : walkingNetworkConfigured ? 'Carregando trajeto pelas ruas…' : 'OSRM de caminhada indisponível'}
        {Object.entries(roadRoutes).map(([teamId, road]) => <div key={teamId}>{teamId}: {road.distanceKm.toFixed(1)} km · {road.durationMinutes.toFixed(0)} min na rede viária</div>)}
      </div>}
    </div>
  );
};
