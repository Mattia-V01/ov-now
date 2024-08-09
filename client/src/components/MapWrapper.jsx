import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import TileWMS from 'ol/source/TileWMS';
import { useNavigate } from 'react-router-dom';
import { Circle as CircleStyle, Fill, Stroke, Style, Text } from 'ol/style.js';
import { defaults as defaultControls } from 'ol/control.js';
import GeoJSON from 'ol/format/GeoJSON';
import CheckBoxLayers from './Layers';
import * as olProj from 'ol/proj';

const MapWrapper = forwardRef((props, ref) => {
    const [map, setMap] = useState();
    const [featuresLayer, setFeaturesLayer] = useState();
    const [layerVisibility, setLayerVisibility] = useState({
        rail: false,
        bus: false,
        tram: false,
        ferry: false,
    });
    const desktopMinZoom = 8.3;
    const mobileMinZoom = 7.5;
    const mapElement = useRef();
    const mapRef = useRef();
    mapRef.current = map;
    const navigate = useNavigate();

    const pointStyle = (feature) => {
        return new Style({
            image: new CircleStyle({
                radius: 5,
                fill: new Fill({ color: 'blue' }),
                stroke: new Stroke({
                    color: 'white',
                    width: 2,
                }),
            }),
            text: new Text({
                text: feature.get('name'), // Mostra il nome dell'attributo
                font: '12px Calibri,sans-serif',
                fill: new Fill({ color: 'black' }),
                stroke: new Stroke({
                    color: 'white',
                    width: 3,
                }),
                offsetY: -15, // Sposta l'etichetta sopra il punto
            }),
        });
    };

    const featureStyle = (feature) => {
        const type = feature.get('type');
        let mainStrokeStyle;
        let secondaryStrokeStyle;
        let haloStrokeStyle = new Stroke({
            color: 'rgba(255, 255, 255, 0.5)', // Transparent halo color
            width: 10, // Width of the halo
        });

        switch (type) {
            case 'rail':
                mainStrokeStyle = new Stroke({
                    color: 'black',
                    width: 2,
                });
                break;
            case 'bus':
                mainStrokeStyle = new Stroke({
                    color: 'black',
                    width: 2,
                    lineDash: [5, 15], // Dashed line
                });
                break;
            case 'tram':
                mainStrokeStyle = new Stroke({
                    color: 'black',
                    width: 4,
                    lineCap: 'butt', // Square ends
                });

                secondaryStrokeStyle = new Stroke({
                    color: 'white',
                    width: 2,
                    lineCap: 'butt', // Square ends
                });

            case 'ferry':
                mainStrokeStyle = new Stroke({
                    color: 'black',
                    width: 4,
                    lineDash: [2, 10], // Square ends
                });

                return [
                    new Style({
                        stroke: haloStrokeStyle,
                        zIndex: 2, // Ensure halo is underneath feature but above overlay
                    }),
                    new Style({
                        stroke: mainStrokeStyle,
                        zIndex: 3, // Feature layer
                    }),
                    new Style({
                        stroke: secondaryStrokeStyle,
                        zIndex: 4, // Overlay secondary style on top
                    })
                ];
            case 'point':
                return pointStyle(feature);
            default:
                mainStrokeStyle = new Stroke({
                    color: 'black',
                    width: 3,
                });
        }

        return [
            new Style({
                stroke: haloStrokeStyle,
                zIndex: 2,
            }),
            new Style({
                stroke: mainStrokeStyle,
                zIndex: 3,
            })
        ];
    };

    useEffect(() => {
        const initialFeaturesLayer = new VectorLayer({
            source: new VectorSource(),
            style: featureStyle,
        });

        const wmsLayer = new TileLayer({
            source: new TileWMS({
                url: 'http://localhost:8080/geoserver/oev/wms',
                params: {
                    'LAYERS': 'oev:ch.swisstopo.pixelkarte-farbe',
                    'TILED': true,
                },
                serverType: 'geoserver',
                transition: 0,
            }),
        });

        const initialMap = new Map({
            target: mapElement.current,
            layers: [wmsLayer, initialFeaturesLayer],
            view: new View({
                projection: 'EPSG:3857',
                center: [919705.97978, 5923388.48616],
                zoom: 1,
                maxZoom: 20,
                minZoom: getMinZoom(),
            }),
            controls: defaultControls({
                attributionOptions: { collapsible: false },
            }).extend([]),
        });

        initialMap.on('click', (event) => {
            initialMap.forEachFeatureAtPixel(event.pixel, (feature) => {
                const type = feature.get('type');
                
                if (type !== 'point') {
                    const trainId = feature.get('train_id');
                    const line_name = feature.get('line_name');
                    navigate(`/InfoPage/${trainId}/${line_name}/${type}`);
                }
            });
        });

        setMap(initialMap);
        setFeaturesLayer(initialFeaturesLayer);

        return () => {
            if (initialMap) {
                initialMap.setTarget(null);
            }
        };
    }, []);

    const getMinZoom = () => {
        return window.matchMedia('(max-width: 1080px)').matches ? mobileMinZoom : desktopMinZoom;
    };

    useEffect(() => {
        fetchWFSFeatures(); // Fetch WFS features when the component is mounted
    }, [featuresLayer]);

    const fetchWFSFeatures = () => {
        if (featuresLayer) {
            const wfsUrl = 'http://localhost:8080/geoserver/oev/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=oev%3AHaltestellen&maxFeatures=50&outputFormat=application%2Fjson';
            fetch(wfsUrl)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    const features = new GeoJSON().readFeatures(data, {
                        featureProjection: 'EPSG:3857'
                    });
                    const source = featuresLayer.getSource();
                    features.forEach(feature => {
                        feature.setStyle(pointStyle(feature));
                    });
                    source.addFeatures(features);
                })
                .catch(error => console.error('Error fetching WFS data:', error));
        }
    };

    useEffect(() => {
        fetchFeatures();
    }, [layerVisibility]);

    const fetchFeatures = () => {
        if (featuresLayer) {
            const currentMap = mapRef.current;
            const view = currentMap.getView();
            const extent = view.calculateExtent(currentMap.getSize());
            const newBbox = extent.map(coord => Math.round(coord)).join(',');
            const newZoom = Math.round(view.getZoom());
    
            Object.keys(layerVisibility).forEach((layerType) => {
                if (layerVisibility[layerType]) {
                    console.log(`Fetching data for layer: ${layerType}`);
                    fetch(`http://${window.location.hostname}:8000/get_all_journey/?bbox=${newBbox}&key=yourkey&zoom=${newZoom}&type=${layerType}`) //Ihren key ersetzen
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.text();
                        })
                        .then(text => {
                            try {
                                const fetchedFeatures = JSON.parse(text);
                                const wktOptions = {
                                    dataProjection: 'EPSG:3857',
                                    featureProjection: 'EPSG:3857'
                                };
                                const parsedFeatures = new GeoJSON().readFeatures(fetchedFeatures, wktOptions);
                                const source = featuresLayer.getSource();
                                console.log(`Adding features for layer: ${layerType}`, parsedFeatures);
                                source.addFeatures(parsedFeatures.filter(feature => feature.get('type') === layerType));
                            } catch (error) {
                                console.error('Error parsing JSON:', error);
                                console.error('Response text:', text);
                            }
                        })
                        .catch(error => console.error('Error fetching data:', error));
                } else {
                    const source = featuresLayer.getSource();
                    const featuresToRemove = source.getFeatures().filter(feature => feature.get('type') === layerType);
                    console.log(`Removing features for layer: ${layerType}`, featuresToRemove);
                    featuresToRemove.forEach(feature => source.removeFeature(feature));
                }
            });
        }
    };

    useImperativeHandle(ref, () => ({
        getMap: () => mapRef.current
    }));

    const handleLayerVisibilityChange = (layerType, isVisible) => {
        setLayerVisibility(prevState => ({
            ...prevState,
            [layerType]: isVisible
        }));
    };

    return (
        <div style={{ position: 'relative', flex: "100 0 0" }}>
            <CheckBoxLayers onLayerVisibilityChange={handleLayerVisibilityChange} />
            <div className="container">
                <div className="white-overlay" style={{ zIndex: 1, backgroundColor: 'rgba(255, 255, 255, 0.2)', pointerEvents: 'none' }}></div>
                <div ref={mapElement} className="map-container"></div>
            </div>
        </div>
    );
});

export default MapWrapper;
