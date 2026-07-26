/**
 * === Concepts ===
 * The World Map is comprised of different map pieces (home, top, middle, bottom).
 *
 * Each map piece contains one or more nodes (places the player can visit).
 */
const root = document.querySelector("#map-root");

if (!root) {
  throw new Error("The world map root element is missing.");
}

const cody = root.querySelector("#cody");

if (!cody) {
  throw new Error("The cody element is missing.");
}

// Configure map pieces by defining their corresponding DOM elements and nodes
const pieceConfigs = [
  {
    id: "home",
    element: root.querySelector('[data-map-piece="home"]'),
    nodes: {}
  },
  {
    id: "top",
    element: root.querySelector('[data-map-piece="top"]'),
    nodes: {}
  },
].reduce((acc, piece) => {
  if (piece.element) {
    acc.push(piece);
  } else {
    console.warn(`Map piece with id "${piece.id}" is missing its corresponding DOM element.`);
  }
  return acc;
}, []);

pieceConfigs.forEach((piece) => {
  piece.element.querySelectorAll("[data-node]").forEach((node) => {
    // A node's id is a combination of the map piece id and the node's
    // data-node attribute to ensure uniqueness across pieces,
    // e.g. "top:entry". It essentially identifies the location of the node
    // within the map piece it is located in.
    const id = `${piece.id}:${node.dataset.node}`;
    piece.nodes[id] = node;
    node.dataset.nodeId = id;
  });
});

const pieceMap = new Map(pieceConfigs.map((piece) => [piece.id, piece]));
const pieceElements = Array.from(root.querySelectorAll("[data-map-piece]"));

const state = {
  activeId: null,
};

function setActivePiece(pieceId) {
  state.activeId = pieceId;

  pieceElements.forEach((element) => {
    element.dataset.active = element.dataset.mapPiece === pieceId ? "true" : "false";
  });
}

setActivePiece("home")


console.log("World map initialized with pieces:", pieceMap);
console.log("Active piece set to:", state.activeId);
console.log("Map pieces configured:", pieceConfigs);
console.log("World map initialized.");
