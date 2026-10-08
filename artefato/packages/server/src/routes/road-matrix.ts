import { CostMatrix, Scenario } from '@routing/core';

type TableResponse = { code: string; distances?: (number | null)[][]; durations?: (number | null)[][] };

export async function buildWalkingCostMatrix(scenario: Scenario): Promise<CostMatrix> {
  const baseUrl = process.env.OSRM_BASE_URL;
  if (!baseUrl) throw new Error('OSRM_BASE_URL não configurada: é necessário um OSRM local preparado com profiles/foot.lua.');
  const nodes = [scenario.healthCenter, ...scenario.patients.map(patient => ({ id: patient.id, location: patient.location }))];
  const count = nodes.length;
  const distanceMatrix = Array.from({ length: count }, () => Array<number>(count).fill(0));
  const timeMatrix = Array.from({ length: count }, () => Array<number>(count).fill(0));
  const chunkSize = 35;
  for (let start = 0; start < count; start += chunkSize) {
    const sourceIndices = Array.from({ length: Math.min(chunkSize, count - start) }, (_, index) => start + index);
    for (let destination = 0; destination < count; destination += chunkSize) {
      const destinationIndices = Array.from({ length: Math.min(chunkSize, count - destination) }, (_, index) => destination + index);
      const indices = [...sourceIndices, ...destinationIndices];
      const coordinates = indices.map(index => `${nodes[index].location.lng},${nodes[index].location.lat}`).join(';');
      const sources = sourceIndices.map((_, index) => index).join(';');
      const destinations = destinationIndices.map((_, index) => sourceIndices.length + index).join(';');
      const url = `${baseUrl.replace(/\/$/, '')}/table/v1/foot/${coordinates}?annotations=distance,duration&sources=${sources}&destinations=${destinations}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`OSRM caminhada respondeu HTTP ${response.status}.`);
      const table = await response.json() as TableResponse;
      if (table.code !== 'Ok' || !table.distances || !table.durations) {
        throw new Error(`OSRM caminhada não forneceu matriz de distâncias: ${table.code}.`);
      }
      for (let row = 0; row < sourceIndices.length; row++) {
        for (let column = 0; column < destinationIndices.length; column++) {
          const distance = table.distances[row]?.[column];
          const duration = table.durations[row]?.[column];
          if (distance === null || duration === null || distance === undefined || duration === undefined ||
              !Number.isFinite(distance) || !Number.isFinite(duration)) {
            throw new Error(`Sem caminho a pé entre ${nodes[sourceIndices[row]].id} e ${nodes[destinationIndices[column]].id}.`);
          }
          distanceMatrix[sourceIndices[row]][destinationIndices[column]] = distance / 1000;
          timeMatrix[sourceIndices[row]][destinationIndices[column]] = duration / 60;
        }
      }
    }
  }
  return { nodeIds: nodes.map(node => node.id), distanceMatrix, timeMatrix };
}
