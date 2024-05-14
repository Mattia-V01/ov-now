import React, { useState, useEffect, useRef } from 'react';
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import OSM from 'ol/source/OSM';
import TileWMS from 'ol/source/TileWMS';
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import XYZ from 'ol/source/XYZ'
import { transform } from 'ol/proj'
import { toStringXY } from 'ol/coordinate';
import { Fill, Stroke, Circle, Style } from 'ol/style.js';
import { DragRotateAndZoom, defaults as defaultInteractions } from 'ol/interaction.js';
import { FullScreen, ScaleLine, defaults as defaultControls } from 'ol/control.js';
import LayersIcon from '@mui/icons-material/Layers';
import Landeskarte_farbe from '../Image/Landeskarte_farbe.png';
import Landeskarte_grau from '../Image/Landeskarte_grau.png';
import Bild_Luftbild from '../Image/Bild_Luftbild.png';
import Bild_osm from '../Image/Bild_osm.png'
import CheckBoxLayers from './Layers'; 
import BackgroundButton from './backgroundButton';

function MapWrapper(props) {
  const [map, setMap] = useState();
  const [featuresLayer, setFeaturesLayer] = useState();
  const [selectedCoord, setSelectedCoord] = useState();
  const [backgroundMap, setBackgroundMap] = useState('Landeskarte-farbe'); // Impostazione predefinita della mappa
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentView, setCurrentView] = useState(null);
  const desktopMinZoom = 8.3;
  const mobileMinZoom = 7.5;

  const mapElement = useRef();

  const mapRef = useRef();
  mapRef.current = map;

  useEffect(() => {
    const initialFeaturesLayer = new VectorLayer({
      source: new VectorSource(),
    });

    const initialMap = new Map({
      target: mapElement.current,
      layers: [getBackgroundLayer(), initialFeaturesLayer],
      view: new View({
        projection: 'EPSG:3857',
        center: [919705.97978, 5923388.48616],
        zoom: 1,
        maxZoom: 16,
        minZoom: getMinZoom(),
        extent: getBackgroundExtent(),
      }),
      controls: defaultControls({
        attributionOptions: { collapsible: false },
      }).extend([]),
      //interactions: defaultInteractions().extend([new DragRotateAndZoom()])
    });

    initialMap.on('click', handleMapClick);

    setMap(initialMap);
    setFeaturesLayer(initialFeaturesLayer);

    // Salva la vista corrente
    setCurrentView(initialMap.getView().getCenter(), initialMap.getView().getZoom());

    return () => initialMap.setTarget("");
  }, []);

  const getMinZoom = () => {
    // Imposta il livello di zoom minimo in base al dispositivo
    if (window.matchMedia('(max-width: 768px)').matches) {
      return mobileMinZoom;
    } else {
      return desktopMinZoom;
    }
  };

  useEffect(() => {
    if (featuresLayer && props.features.length) {
      featuresLayer.setSource(
        new VectorSource({
          features: props.features
        })
      );
      map.getView().fit(featuresLayer.getSource().getExtent(), {
        padding: [100, 100, 100, 100]
      });
    }
  }, [props.features, featuresLayer, map]);

  const handleMapClick = (event) => {
    const clickedCoord = mapRef.current.getCoordinateFromPixel(event.pixel);
    setSelectedCoord(clickedCoord);
  };

  const getBackgroundLayer = () => {
    if (backgroundMap === 'osm') {
      return new TileLayer({
        source: new OSM()
      });
    } else if (backgroundMap === 'Landeskarte-farbe') {
      return new TileLayer({
        source: new TileWMS({
          url: 'https://wms.geo.admin.ch/',
          crossOrigin: 'anonymous',
          attributions: '© <a href="http://www.geo.admin.ch/internet/geoportal/' +
            'en/home.html">SWISSIMAGE / geo.admin.ch</a>',
          projection: 'EPSG:3857',
          params: {
            'LAYERS': 'ch.swisstopo.pixelkarte-farbe',
            'FORMAT': 'image/jpeg'
          },
          // serverType: 'mapserver'
        })
      });
    } else if (backgroundMap === 'Landeskarte-grau') {
      return new TileLayer({
        source: new TileWMS({
          url: 'https://wms.geo.admin.ch/',
          crossOrigin: 'anonymous',
          attributions: '© <a href="http://www.geo.admin.ch/internet/geoportal/' +
            'en/home.html">SWISSIMAGE / geo.admin.ch</a>',
          projection: 'EPSG:3857',
          params: {
            'LAYERS': 'ch.swisstopo.pixelkarte-grau',
            'FORMAT': 'image/jpeg'
          },
          // serverType: 'mapserver'
        })
      });
    } else if (backgroundMap === 'Luftbild') {
      return new TileLayer({
        source: new TileWMS({
          url: 'https://wms.geo.admin.ch/',
          crossOrigin: 'anonymous',
          attributions: '© <a href="http://www.geo.admin.ch/internet/geoportal/' +
            'en/home.html">SWISSIMAGE / geo.admin.ch</a>',
          projection: 'EPSG:3857',
          params: {
            'LAYERS': 'ch.swisstopo.images-swissimage',
            'FORMAT': 'image/jpeg'
          },
          // serverType: 'mapserver'
        })
      });
    }
  };

  const getBackgroundExtent = () => {
    // Define the extent based on the background map
    if (backgroundMap === 'osm') {
      return [506943.5, 5652213.5, 1301728.5, 6191092]; // boundigbox for EPSG:3857 (Web Mercator)
    } else if (backgroundMap === 'Landeskarte-farbe') {
      return [506943.5, 5652213.5, 1301728.5, 6191092];
    } else if (backgroundMap === 'Landeskarte-grau') {
      return [506943.5, 5652213.5, 1301728.5, 6191092];
    } else if (backgroundMap === 'Luftbild') {
      return [506943.5, 5652213.5, 1301728.5, 6191092]; 
    }
  };

  return (
    <div style={{flex: "100 0 0"}}>
      <CheckBoxLayers />
      <div className="container">
        <div ref={mapElement} className="map-container"></div>
        <div className="white-overlay"></div>
        <div className="clicked-coord-label">
          <p>{selectedCoord ? toStringXY(selectedCoord, 5) : ''}</p>
        </div>
      </div>
      <BackgroundButton
        backgroundMap={backgroundMap}
        handleBackgroundChange={(value) => setBackgroundMap(value)}
      />
    </div>
  );
}

export default MapWrapper;