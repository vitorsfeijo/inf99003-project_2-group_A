import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Scenario, Plan, Patient, Coordinates, isPointInAnyPolygon } from '@routing/core';
import { fetchRoadRoute, RoadRoute } from '../services/api';

export type MapMode = 'view' | 'draw-risk' | 'add-patient';

interface MapViewProps {
  scenario: Scenario | null;
  plan: Plan | null;
  selectedDate: string;
  walkingNetworkConfigured: boolean;
  mapMode: MapMode;
  draftRiskPoints: Coordinates[];
  selectedPatientId: string | null;
  onMapClick: (point: Coordinates) => void;
  onSelectPatient: (patientId: string) => void;
}

const FitTerritory: React.FC<{ scenario: Scenario | null }> = ({ scenario }) => {
  const map = useMap();
  useEffect(() => {
    const vertices = scenario?.polygons.flatMap(polygon => polygon.vertices) ?? [];
    if (vertices.length) map.fitBounds(L.latLngBounds(vertices.map(vertex => [vertex.lat, vertex.lng])), { padding: [28, 28], maxZoom: 15, animate: false });
  }, [map, scenario?.id]);
  return null;
};

const MapClickHandler: React.FC<{ onMapClick: (point: Coordinates) => void; active: boolean }> = ({ onMapClick, active }) => {
  useMapEvents({ click: event => { if (active) onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng }); } });
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

/** Cor e símbolo do marcador conforme as restrições do paciente. */
function patientMarkerStyle(patient: Patient, scenario: Scenario, selected: boolean) {
  const inside = patient.territoryOverride === 'include' || isPointInAnyPolygon(patient.location, scenario.polygons);
  const background = patient.transfer ? '#94a3b8' : !inside ? '#b91c1c' : patient.hardDeadline ? '#ea580c'
    : patient.requiredProfessions?.length ? '#1d4ed8' : '#475569';
  const ring = selected ? '3px solid #facc15' : patient.assignedTeamId ? '2px solid #22c55e' : '2px solid white';
  const size = selected ? 28 : 22;
  return { background, ring, size, opacity: patient.transfer ? 0.55 : 1, symbol: patient.hardDeadline && !patient.transfer ? '⚓' : '' };
}

export const MapView: React.FC<MapViewProps> = ({ scenario, plan, selectedDate, walkingNetworkConfigured, mapMode,
  draftRiskPoints, selectedPatientId, onMapClick, onSelectPatient }) => {
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
  const teamName = (teamId: string) => scenario?.teams.find(team => team.id === teamId)?.name ?? teamId;
  // Ao desenhar ou cadastrar, polígonos e marcadores deixam o clique passar para o mapa.
  const picking = mapMode !== 'view';

  return (
    <div className={mapMode === 'view' ? undefined : 'map-picking'} style={{ width: '100%', height: '100%', position: 'relative', isolation: 'isolate' }}>
      {mapMode !== 'view' && <style>{'.map-picking .leaflet-container{cursor:crosshair!important}'}</style>}
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
        <MapClickHandler onMapClick={onMapClick} active={mapMode !== 'view'} />

        {/* Renderizar Polígonos do Território */}
        {(scenario?.polygons ?? []).map(poly => (
          <Polygon
            key={`${poly.id}_${picking}`}
            interactive={!picking}
            positions={[poly.vertices, ...(poly.holes ?? [])].map(ring => ring.map(v => [v.lat, v.lng] as [number, number]))}
            pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.15, weight: 2, dashArray: '4' }}
          >
            <Popup><strong>{poly.name}</strong> (Território da APS)</Popup>
          </Polygon>
        ))}

        {/* Áreas de risco marcadas pela equipe: as rotas evitam atravessá-las */}
        {(scenario?.riskAreas ?? []).map(area => (
          <Polygon key={`${area.id}_${picking}`} interactive={!picking} positions={area.vertices.map(vertex => [vertex.lat, vertex.lng] as [number, number])}
            pathOptions={{ color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.28, weight: 2 }}>
            <Popup><strong>⚠️ {area.name}</strong><br />Área de risco: as rotas evitam atravessá-la.{area.reason ? <><br />{area.reason}</> : null}</Popup>
          </Polygon>
        ))}
        {draftRiskPoints.length > 0 && <>
          <Polyline positions={[...draftRiskPoints, ...(draftRiskPoints.length > 2 ? [draftRiskPoints[0]] : [])].map(point => [point.lat, point.lng] as [number, number])}
            pathOptions={{ color: '#b91c1c', dashArray: '6', weight: 2 }} />
          {draftRiskPoints.map((point, index) => <CircleMarker key={index} center={[point.lat, point.lng]} radius={5}
            pathOptions={{ color: '#b91c1c', fillColor: '#fff', fillOpacity: 1 }} />)}
        </>}

        {/* Marker do Posto de Saúde */}
        {scenario && <Marker position={[scenario.healthCenter.location.lat, scenario.healthCenter.location.lng]} icon={healthCenterIcon}>
          <Popup>
            <strong>🏥 {scenario.healthCenter.name}</strong><br />
            Origem e Retorno de todas as equipes.
          </Popup>
        </Marker>}

        {/* Renderizar Pacientes (cor indica restrições; clique abre o cadastro) */}
        {scenario && scenario.patients.map((patient, pIdx) => {
          const style = patientMarkerStyle(patient, scenario, patient.id === selectedPatientId);
          const patientIcon = L.divIcon({
            className: 'custom-patient-icon',
            html: `<div title="${patient.code}" style="background-color: ${style.background}; opacity: ${style.opacity}; color: white; border: ${style.ring}; border-radius: 50%; width: ${style.size}px; height: ${style.size}px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">${style.symbol || pIdx + 1}</div>`,
            iconSize: [style.size, style.size],
            iconAnchor: [style.size / 2, style.size / 2]
          });

          return (
            <Marker key={`${patient.id}_${picking}`} interactive={!picking} position={[patient.location.lat, patient.location.lng]} icon={patientIcon}
              eventHandlers={{ click: () => onSelectPatient(patient.id) }}>
              <Popup>
                <strong>🏠 {patient.code}</strong><br />
                Duração estimada: {patient.defaultVisitDurationMinutes} min<br />
                Prioridade: {patient.conditions[0]?.priorityWeight ?? '–'}
                {patient.hardDeadline && <><br />Prazo rígido: {patient.hardDeadline}</>}
                {patient.transfer && <><br />Transferido para {patient.transfer.toHealthCenterName}</>}
              </Popup>
            </Marker>
          );
        })}

        {/* Renderizar Rotas Diárias das Equipes */}
        {dailyRoutes.map(route => {
          if (!scenario) return null;
          const color = TEAM_COLORS[Math.max(0, scenario.teams.findIndex(t => t.id === route.teamId)) % TEAM_COLORS.length];

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
                  html: `<div style="background-color: ${color}; color: white; border: 2px solid ${visit.mandatory ? '#f97316' : 'white'}; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.4);">${vIdx + 1}</div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
                });

                return (
                  <Marker
                    key={`visit_order_${route.teamId}_${vIdx}_${picking}`}
                    interactive={!picking}
                    position={[patient.location.lat, patient.location.lng]}
                    icon={orderIcon}
                    eventHandlers={{ click: () => onSelectPatient(patient.id) }}
                  >
                    <Popup>
                      <strong>Ordem {vIdx + 1}: {patient.code}{visit.mandatory ? ' ⚓' : ''}</strong><br />
                      Equipe: {teamName(route.teamId)}<br />
                      Horário: {visit.estimatedStartTime} - {visit.estimatedEndTime}{visit.bufferMinutes ? ` (+${visit.bufferMinutes} min de folga)` : ''}<br />
                      Deslocamento anterior: {visit.travelDistanceKmFromPrevious} km ({visit.travelTimeMinutesFromPrevious} min)
                    </Popup>
                  </Marker>
                );
              })}
            </React.Fragment>
          );
        })}
      </MapContainer>
      {mapMode !== 'view' && <div role="status" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 16, zIndex: 500, background: '#0f172a', color: 'white', padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 14px rgba(0,0,0,.25)' }}>
        {mapMode === 'draw-risk' ? `Clique nos cantos da área de risco (${draftRiskPoints.length} ponto${draftRiskPoints.length === 1 ? '' : 's'}) e conclua no painel` : 'Clique no mapa onde o paciente mora'}
      </div>}
      {plan && <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 500, background: 'white', padding: '0.6rem 0.8rem', borderRadius: 8, boxShadow: '0 2px 12px rgba(0,0,0,.18)', maxWidth: 260, fontSize: 12 }}>
        {roadError ? `Trajeto viário indisponível: ${roadError}` : Object.keys(roadRoutes).length ? `Trajeto e custo pela rede de caminhada${scenario?.riskAreas?.length ? ' · desviando das áreas de risco' : ''}` : roadLoaded ? 'Nenhuma visita com trajeto neste dia' : walkingNetworkConfigured ? 'Carregando trajeto pelas ruas…' : 'Roteador de caminhada indisponível'}
        {Object.entries(roadRoutes).map(([teamId, road]) => <div key={teamId}>{teamName(teamId)}: {road.distanceKm.toFixed(1)} km · {road.durationMinutes.toFixed(0)} min na rede viária
          {road.riskAreasCrossed?.length ? <div role="alert" style={{ color: '#b91c1c', fontWeight: 600 }}>⚠️ Ainda passa por {road.riskAreasCrossed.join(', ')}: não há desvio viável a pé.</div> : null}</div>)}
      </div>}
    </div>
  );
};
