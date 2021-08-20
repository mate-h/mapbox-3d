import "./style.css";
import mapboxgl, { GeoJSONSourceRaw, Map, SymbolLayer } from "mapbox-gl";

mapboxgl.accessToken =
  "pk.eyJ1IjoibWF0ZWgiLCJhIjoiY2pmOTEzbHo2MzU3cTJ3b201NDNkOXQxZiJ9.UYLkoWDRs877jt_-k4LH4g";

// parse location from url
type State = {
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
  panel: {
    open: boolean;
    leftOpen: boolean;
  }
};
// immutable state
let state: Readonly<State>;
function parseLocation(href = window.location.search) {
  const query = new URLSearchParams(href);
  let lat = parseFloat(query.get("lat") || "0");
  let lng = parseFloat(query.get("lng") || "0");
  let zoom = parseFloat(query.get("zoom") || "0");
  let pitch = parseFloat(query.get("pitch") || "0");
  let bearing = parseFloat(query.get("bearing") || "0");

  // parse state from query parameter
  const stateQuery = query.get("state") || "{}";
  state = JSON.parse(stateQuery);
  zoom = state.zoom || zoom;
  pitch = state.pitch || pitch;
  bearing = state.bearing || bearing;
  lng = state.lng || lng;
  lat = state.lat || lat;

  state = { lat, lng, zoom, bearing, pitch, panel: { open: true, leftOpen: true } };
  (window as any).state = state;
  return state;
}
// application state is preserved in the URL.
// If the URL is changed, the application state is lost.
// To avoid this, we use the history API to save the application state.
// `history.replaceState(state, "", location.href);`
// The application state is the map's zoom, center, pitch, and bearing.
// The application state is encoded as a URL parameter named "state".

function setState(state: Readonly<State>) {
  const query = new URLSearchParams();
  query.set("state", JSON.stringify(state));
  history.replaceState(state, "", `?${query}`);
}

var labelLayerId: string;

window.onload = () => {
  const locations = document.querySelectorAll("#locations a");

  locations.forEach((location) => {
    const href = location.getAttribute("href") || "";
    const anchor = location as HTMLAnchorElement;
    anchor.onclick = (e) => {
      e.preventDefault();
      // silently push history state
      const location = parseLocation(href);
      setState(location);
      map.setCenter([location.lng, location.lat]);
      anchor.blur();
    };
  });
  // const languages = document.querySelectorAll("#languages a");
  const dragDrop = document.querySelector("#drop-area") as HTMLDivElement;
  dragDrop.ondragenter = () => {
    dragDrop.classList.add("drag-over");
  };
  dragDrop.ondragleave = () => {
    dragDrop.classList.remove("drag-over");
  };
  dragDrop.oninput = (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length) {
      const fileArray = Array.from(files);
      fileArray.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const jsonData = (e.target as FileReader).result;
          if (file.name.toLowerCase().endsWith("csv") && jsonData) {
            console.log("csv", file.name);
            const lines = jsonData.toString().split("\n");
            const headers = lines[0].split(",").map(r => r.split("\"").join("").trim());
            // function which returns the index of a header
            // for example, returns "lat" for "latitude"
            const getHeaderIndex = (header: "lon"|"lat") => {
              const index = headers.indexOf(header);
              if (index === -1) {
                // console.warn(`header ${header} not found`);
              }
              return index;
            };

            const features = lines.slice(1).map((line, i) => {
              const values = line.split(",").map(r => r.split("\"").join("").trim());
              return {
                type: "Feature",
                id: i + 1,
                geometry: {
                  type: "Point",
                  coordinates: [
                    parseFloat(values[getHeaderIndex("lon")]),
                    parseFloat(values[getHeaderIndex("lat")]),
                  ],
                },
                properties: headers.reduce(
                  (obj: any, header, i) => {
                    obj[header] = values[i];
                    return obj;
                  },
                  {} as GeoJSON.Feature<GeoJSON.Point>
                ),
              };
            }
            );

            // generate line features
            const lineFeature: GeoJSON.Feature<GeoJSON.LineString> = {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: lines.slice(1).map((line, i) => {
                    const values = line.split(",").map(r => r.split("\"").join("").trim());
                    const lat = parseFloat(values[getHeaderIndex("lat")]);
                    const lng = parseFloat(values[getHeaderIndex("lon")]);
                    if (isNaN(lat) || isNaN(lng)) {
                      console.warn(`invalid line ${i}`);
                      return undefined;
                    }
                    return [lng, lat];
                  }).filter(f=>f) as any,
                },
                properties: {},
              };

            const source: GeoJSONSourceRaw = {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: features as GeoJSON.Feature[]
              },
            };
            const id = Math.random().toFixed(3).replace(".", "");
            map.addLayer({
              id: "data-source-line-" + id,
              type: "line",
              source: {
                type: "geojson",
                data: lineFeature
              },
              paint: {
                "line-width": {
                  stops: [
                    [0, 2],
                    [14, 2],
                    [15, 4],
                    [22, 6],
                  ]
                },
                "line-color": "#ff0000",
              },
            }, labelLayerId);
            map.addSource("data-source-" + id, source);
            map.addLayer({
              id: "data-source-point-" + id,
              type: "circle",
              source: "data-source-" + id,
              paint: {
                'circle-radius': [
                  'case',
                  ['boolean',
                    ['feature-state', 'hover'],
                    false
                  ],
                  5,
                  0
                ],
                'circle-stroke-color': [
                  'case',
                  ['boolean',
                    ['feature-state', 'hover'],
                    false
                  ],
                  '#ff0000',
                  '#fff'
                ],
                'circle-stroke-width': {
                  stops: [
                    [0, 0],
                    [14, 1],
                    [15, 2],
                    [22, 3],
                  ]
                },
                // The feature-state dependent circle-color expression will render
                // the color according to its magnitude when
                // a feature's hover state is set to true
                'circle-color': [
                  'case',
                  ['boolean',
                    ['feature-state', 'hover'],
                    false
                  ],
                  '#fff',
                  '#ff0000'
                ],
                
              },
            }, labelLayerId);
            let featureID = "";
            const  listener =  (e: {
              features?: mapboxgl.MapboxGeoJSONFeature[] | undefined;
          }) => {

              map.getCanvas().style.cursor = 'pointer';
              // Set variables equal to the current feature's magnitude, location, and time
              
              const firstFeature = (e.features as any)[0] as unknown as GeoJSON.Feature<GeoJSON.Point>;
              
              const el = document.getElementById("info");
              if (el && firstFeature) {
                function sanitize(props: any) {
                  // remove empty properties
                  return Object.keys(props).reduce((obj: any, key) => {
                    if (props[key] === "") {
                      delete obj[key];
                    }
                    return obj;
                  }, props);
                }
                el.innerHTML = `<code>${JSON.stringify(sanitize(firstFeature.properties), null, "  ").split("\n").join("<br>")}</code>`;
              }
              else if (el) {
                el.innerHTML = ``;
              }
              if (!e.features || e.features.length === 0) return;
              // Check whether features exist
              if (e.features.length > 0) {
                // Display the magnitude, location, and time in the sidebar
            
                // If quakeID for the hovered feature is not null,
                // use removeFeatureState to reset to the default behavior
                if (featureID) {
                  map.removeFeatureState({
                    source: "data-source-" + id,
                    id: featureID
                  });
                }
            
                featureID = e.features[0].id?.toString() || "";
            
                // When the mouse moves over the earthquakes-viz layer, update the
                // feature state for the feature under the mouse
                map.setFeatureState({
                  source: "data-source-" + id,
                  id: featureID,
                }, {
                  hover: true
                });
              }
            }
            map.on('mousemove', "data-source-point-" + id, listener);
            map.on('touchstart', "data-source-point-" + id, listener);
          }
          else if (jsonData) {
            const json = JSON.parse(jsonData.toString());
            const { lat, lng, zoom, pitch, bearing, data } = json;
            if (lng && lat) map.setCenter([lng, lat]);
            if (zoom) map.setZoom(zoom);
            if (pitch) map.setPitch(pitch);
            if (bearing) map.setBearing(bearing);
            // calculate data bounds
            // const bounds = data.features.map((d: any) => d.geometry.coordinates).reduce((bounds: number[], [x, y]: number[]) => {
            //   bounds[0] = Math.min(bounds[0], x);
            //   bounds[1] = Math.min(bounds[1], y);
            //   bounds[2] = Math.max(bounds[2], x);
            //   bounds[3] = Math.max(bounds[3], y);
            //   return bounds;
            // }, [Infinity, Infinity, -Infinity, -Infinity]);
          
            // add data as map source
            // add visual layers
            map.addLayer({
              id: "data-source-points",
              type: "circle",
              source: {
                type: "geojson",
                data,
              },
              paint: {
                "circle-radius": 10,
                "circle-color": "#ff0000",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ff0000",
              },
            }, labelLayerId);
          }
        };
        reader.readAsText(file);
      });
    }
  };

  const location = parseLocation(window.location.search);
  var map = new Map({
    container: "map",
    zoom: location.zoom || 14,
    center: [location.lng || -116.49, location.lat || 51.395],
    pitch: location.pitch || 50,
    bearing: location.bearing || 60,
    style: "mapbox://styles/mapbox-map-design/ckhqrf2tz0dt119ny6azh975y",
  });

  (window as any).map = map;

  map.on("load", function () {
    map.addSource("mapbox-dem", {
      type: "raster-dem",
      url: "mapbox://mapbox.mapbox-terrain-dem-v1",
      tileSize: 512,
      maxzoom: 14,
    });
    // add the DEM source as a terrain layer with exaggerated height
    map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

    // add a sky layer that will show when the map is highly pitched
    map.addLayer({
      id: "sky",
      type: "sky",
      paint: {
        "sky-type": "atmosphere",
        "sky-atmosphere-sun": [0.0, 0.0],
        "sky-atmosphere-sun-intensity": 15,
      },
    });
    // Insert the layer beneath any symbol layer.
    var layers = map.getStyle().layers;
    
    for (var i = 0; i < (layers?.length || 0); i++) {
      if (layers && layers[i].type === "symbol") {
        const symbolLayer = layers[i] as SymbolLayer;
        if (layers && symbolLayer.layout && symbolLayer.layout["text-field"])
          labelLayerId = layers[i].id;
        break;
      }
    }
    map.addLayer(
      {
        id: "add-3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 15,
        paint: {
          "fill-extrusion-color": "#aaa",

          // Use an 'interpolate' expression to
          // add a smooth transition effect to
          // the buildings as the user zooms in.
          "fill-extrusion-height": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "height"],
          ],
          "fill-extrusion-base": [
            "interpolate",
            ["linear"],
            ["zoom"],
            15,
            0,
            15.05,
            ["get", "min_height"],
          ],
          "fill-extrusion-opacity": 0.6,
        },
      },

      labelLayerId
    );
  });
};
