import { ScrollTrigger } from "../../lib/gsap.js";

/**
 * === Concepts ===
 * The World Map is comprised of different map pieces (home, top, middle, bottom).
 *   - home: starting point
 *   - top: top part of the map
 *   - middle: middle part of the map
 *   - bottom: bottom part of the map
 *
 * Each map piece contains one or more nodes (places the player can visit).
 *
 * The possible node layouts are kept simple on purpose all possible node
 * configurations used in this project look like this:
 *
 *      1                 1                 1
 *                        |                 |
 *                     2==3==4              3
 *                        |                 |
 *                        5                 5
 *
 * Node types are defined by their position in the layout:
 * - Node 1 is the "entry" node; alternatively "start" node (special designation for single node map piece)
 * - Node 2 is the "branch-left" node
 * - Node 3 is the "junction" node (if there is a left and right branch) or the "mid" node (if there is only a single branch)
 * - Node 4 is the "branch-right" node
 * - Node 5 is the "handoff" node (if this node causes a transition to the next piece of the map); alternatively "stop" node (special designation for final map node)
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

// Configure the node graph to define how nodes connect to each other across map pieces.
const nodeGraph = {
  /**
   * Keys are pieceId:nodeType, e.g. "home:start" or "top:entry".
   */
  "home:start": {
    pieceId: "home",
    directionTargets: { down: "top:entry" },
  },
  "top:entry": {
    pieceId: "top",
    directionTargets: { up: "home:start" },
  },
};

const state = {
  activeId: null,
  currentNodeId: null,
  isAnimating: false,
};

function setActivePiece(pieceId) {
  state.activeId = pieceId;

  pieceElements.forEach((element) => {
    element.dataset.active = element.dataset.mapPiece === pieceId ? "true" : "false";
  });
}

function getNodeElement(nodeId) {
  const [pieceId] = nodeId.split(":");
  return pieceMap.get(pieceId)?.nodes?.[nodeId] ?? null;
}

// Gets a node's position relative to the page, to be used for positioning elements, like Cody McCodeface, on the map.
function getNodePagePosition(nodeId) {
  const node = getNodeElement(nodeId);

  if (!node) {
    return null;
  }

  const rect = node.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2 + window.scrollY,
  };
}

// Updates the state of each node based on the current node and its neighbors.
function syncNodeState() {
  Object.keys(nodeGraph).forEach((nodeId) => {
    const node = getNodeElement(nodeId);

    if (!node) {
      return;
    }

    const isCurrent = nodeId === state.currentNodeId;
    const neighbors = Object.values(nodeGraph[state.currentNodeId]?.directionTargets ?? {});
    const isClickable = !state.isAnimating && neighbors.includes(nodeId);

    node.dataset.current = isCurrent ? "true" : "false";
    node.dataset.clickable = isClickable ? "true" : "false";
    node.disabled = !isClickable;

    if (isCurrent) {
      node.disabled = false;
    }
  });
}

// Sets Cody McCodeface's position on the map based on the specified node's position.
function setCodyAtNode(nodeId) {
  const position = getNodePagePosition(nodeId);

  if (!position) {
    return;
  }

  cody.style.left = `${position.x}px`;
  cody.style.top = `${position.y}px`;
}

state.currentNodeId = "home:start";
setActivePiece("home");
syncNodeState();
window.scrollTo(0, 0);

requestAnimationFrame(() => {
  window.scrollTo(0, 0);
  setCodyAtNode(state.currentNodeId);
  ScrollTrigger.refresh();
});

console.log("World map initialized with pieces:", pieceMap);
console.log("Active piece set to:", state.activeId);
console.log("Map pieces configured:", pieceConfigs);
console.log("World map initialized.");
