const root = document.getElementById("map-root");

if (!root) {
  throw new Error("The world map root element is missing.");
}

const cody = root.getElementById("cody");

if (!cody) {
  throw new Error("The cody element is missing.");
}
