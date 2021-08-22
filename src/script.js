const fs = require("fs");

const data = fs.readFileSync("./features.geojson");
// parse json
const features = JSON.parse(data);
//filter point type features
const points = features.features.filter(feature => feature.geometry.type === "Point");

// wrap in feature collection
const featureCollection = {
  type: "FeatureCollection",
  features: points
};
// write to file
fs.writeFileSync("./points.geojson", JSON.stringify(featureCollection));
