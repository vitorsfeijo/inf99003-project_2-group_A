"""Converte polígonos KML/KMZ locais para GeoJSON, sem resolver NetworkLinks."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

source = sys.argv[1]
if source.lower().endswith('.kmz'):
    with zipfile.ZipFile(source) as archive:
        names = [name for name in archive.namelist() if name.lower().endswith('.kml')]
        if not names:
            raise SystemExit('KMZ sem arquivo KML.')
        root = ET.fromstring(archive.read(names[0]))
else:
    root = ET.parse(source).getroot()

ns = {'k': 'http://www.opengis.net/kml/2.2'}

def coordinates(element):
    text = element.findtext('.//k:coordinates', default='', namespaces=ns)
    return [[float(parts[0]), float(parts[1])] for token in text.split()
            if len(parts := token.split(',')) >= 2]

features = []
parents = {child: parent for parent in root.iter() for child in parent}
for placemark in root.findall('.//k:Placemark', ns):
    parent = parents.get(placemark)
    while parent is not None and parent.tag.rsplit('}', 1)[-1] != 'Folder':
        parent = parents.get(parent)
    folder = parent.findtext('k:name', default='', namespaces=ns) if parent is not None else ''
    name = placemark.findtext('k:name', default='Território APS', namespaces=ns)
    for polygon in placemark.findall('.//k:Polygon', ns):
        outer = polygon.find('k:outerBoundaryIs', ns)
        if outer is None:
            continue
        rings = [coordinates(outer)]
        rings.extend(coordinates(hole) for hole in polygon.findall('k:innerBoundaryIs', ns))
        if len(rings[0]) >= 4:
            features.append({'type': 'Feature', 'properties': {'name': name, 'folder': folder},
                             'geometry': {'type': 'Polygon', 'coordinates': rings}})
    if folder == 'Unidades de Saúde':
        point = placemark.find('.//k:Point', ns)
        if point is not None:
            location = coordinates(point)
            if location:
                features.append({'type': 'Feature', 'properties': {'name': name, 'folder': folder},
                                 'geometry': {'type': 'Point', 'coordinates': location[0]}})

if not features:
    if root.find('.//k:NetworkLink', ns) is not None:
        raise SystemExit('Este KMZ contém apenas um NetworkLink. Exporte o mapa inteiro com as geometrias incorporadas.')
    raise SystemExit('KML/KMZ sem polígonos de território.')
print(json.dumps({'type': 'FeatureCollection', 'features': features}))
