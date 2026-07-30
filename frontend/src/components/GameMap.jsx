import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

const DEFAULT_CENTER = [55.751244, 37.618423];

export default function GameMap({
  areaGeojson,
  editable = false,
  onAreaChange,
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(DEFAULT_CENTER, 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    if (editable) {
      map.pm.addControls({
        position: 'topleft',
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: true,
        drawPolygon: true,
        drawCircle: false,
        drawText: false,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
        rotateMode: false,
      });

      const emitArea = () => {
        const layers = [];
        map.eachLayer((layer) => {
          if (layer.pm && layer instanceof L.Polygon) {
            layers.push(layer.toGeoJSON());
          }
        });
        if (!layers.length) {
          onAreaChange?.(null);
          return;
        }
        if (layers.length === 1) {
          onAreaChange?.(layers[0].geometry || layers[0]);
        } else {
          onAreaChange?.({
            type: 'MultiPolygon',
            coordinates: layers.map((f) => f.geometry.coordinates),
          });
        }
      };

      map.on('pm:create', (e) => {
        if (layerRef.current) {
          map.removeLayer(layerRef.current);
        }
        layerRef.current = e.layer;
        emitArea();
      });
      map.on('pm:edit', emitArea);
      map.on('pm:remove', () => {
        layerRef.current = null;
        onAreaChange?.(null);
      });
    }

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, [editable, onAreaChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!areaGeojson) return;

    const geo = areaGeojson.type === 'Feature'
      ? areaGeojson
      : { type: 'Feature', properties: {}, geometry: areaGeojson };

    const layer = L.geoJSON(geo, {
      style: {
        color: '#3dff6a',
        weight: 3,
        fillColor: '#1a8f3c',
        fillOpacity: 0.25,
      },
    }).addTo(map);

    layerRef.current = layer;
    try {
      map.fitBounds(layer.getBounds(), { padding: [24, 24] });
    } catch {
      // ignore empty bounds
    }
  }, [areaGeojson]);

  return <div ref={containerRef} className={`game-map ${className}`} />;
}
