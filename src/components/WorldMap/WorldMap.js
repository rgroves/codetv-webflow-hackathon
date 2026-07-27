import { gsap, ScrollTrigger } from "../../lib/gsap.js";

// Cooldown period in milliseconds to prevent rapid scroll events.
const SCROLL_WHEEL_COOLDOWN_MS = 300;

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
// Seam transitions directions should not be defined in the nodeGraph, but rather in the seamTransitions object below.
// The nodeGraph should only define directional connections within a single map piece.
const nodeGraph = {
  /**
   * Keys are pieceId:nodeType, e.g. "home:start" or "top:entry".
   */
  "home:start": {
    pieceId: "home",
    directionTargets: {},
  },
  "top:entry": {
    pieceId: "top",
    directionTargets: { down: "top:mid" },
  },
  "top:mid": {
    pieceId: "top",
    directionTargets: { up: "top:entry", down: "top:stop" },
  },
  "top:stop": {
    pieceId: "top",
    directionTargets: { up: "top:mid"},
  },
};

const seamTransitions = {
  "home:start": {
    targetNodeId: "top:entry",
    targetPieceId: "top",
    direction: "down",
  },
  "top:entry": {
    targetNodeId: "home:start",
    targetPieceId: "home",
    direction: "up",
  },
};

// Set of center nodes used to prevent scroll movement when Cody McCodeface is
// not on a center node, to prevent accidental scrolling when on a branch node.
const centerPathNodes = new Set(Array.from(root.querySelectorAll(".node-x-mid")).map((node) => node.dataset.nodeId));

const state = {
  activeId: null,
  currentNodeId: null,
  isAnimating: false,
  resizePending: false,
  handoffInFlight: false,
  wheelCooldownUntil: 0,
  scrollLockCleanup: null,
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

function onResize() {
  if (state.resizePending) {
    return;
  }

  state.resizePending = true;

  requestAnimationFrame(() => {
    setCodyAtNode(state.currentNodeId);
    ScrollTrigger.refresh();
    state.resizePending = false;
  });
}

window.addEventListener("resize", onResize);

function getTargetNodeForDirection(direction) {
  return nodeGraph[state.currentNodeId]?.directionTargets?.[direction] ?? null;
}

function getSeamTransitionForDirection(nodeId, direction) {
  const transition = seamTransitions[nodeId];

  if (!transition || transition.direction !== direction) {
    return null;
  }

  return transition;
}

function scrollToPiece(pieceId) {
  const piece = pieceMap.get(pieceId);

  if (!piece) {
    return Promise.resolve();
  }

  state.handoffInFlight = true;
  lockNativeScroll();

  return new Promise((resolve) => {
    gsap.to(window, {
      duration: 0.9,
      ease: "power2.inOut",
      scrollTo: { y: piece.element, offsetY: 12 },
      onComplete: () => {
        state.handoffInFlight = false;
        unlockNativeScroll();
        resolve();
      },
      onInterrupt: () => {
        state.handoffInFlight = false;
        unlockNativeScroll();
        resolve();
      },
    });
  });
}

async function transitionFromCurrentSeam(direction) {
  if (state.isAnimating || state.handoffInFlight) {
    return;
  }

  console.log(`Attempting to transition from node ${state.currentNodeId} across seam in direction ${direction}.`);
  const transition = getSeamTransitionForDirection(state.currentNodeId, direction);

  if (!transition) {
    return;
  }

  state.isAnimating = true;
  syncNodeState();

  console.log(`Transitioning from node ${state.currentNodeId} to node ${transition.targetNodeId} across seam in direction ${direction}.`);
  await scrollToPiece(transition.targetPieceId);
  state.currentNodeId = transition.targetNodeId;
  setActivePiece(transition.targetPieceId);

  state.isAnimating = false;
  syncNodeState();
  setCodyAtNode(state.currentNodeId);
}

function getDirectionForMove(fromId, toId) {
  const targets = nodeGraph[fromId]?.directionTargets ?? {};

  return Object.entries(targets).find(([, candidate]) => candidate === toId)?.[0] ?? null;
}

function getSeamTransition(nodeId, fromNodeId) {
  const transition = seamTransitions[nodeId];

  if (!transition || transition.targetNodeId === fromNodeId) {
    return null;
  }

  return transition;
}

async function transitionAcrossSeam(fromNodeId, direction) {
  const transition = getSeamTransition(state.currentNodeId, fromNodeId);

  if (!transition) {
    return;
  }

  await scrollToPiece(transition.targetPieceId);
  state.currentNodeId = transition.targetNodeId;
  setActivePiece(transition.targetPieceId);
  setCodyAtNode(state.currentNodeId);
}

async function moveCodyTo(targetNodeId) {
  if (state.isAnimating || state.handoffInFlight || targetNodeId === state.currentNodeId) {
    return;
  }

  const currentNodeId = state.currentNodeId;
  const direction = getDirectionForMove(currentNodeId, targetNodeId);

  if (!direction) {
    return;
  }

  const targetPosition = getNodePagePosition(targetNodeId);

  if (!targetPosition) {
    return;
  }

  state.isAnimating = true;
  syncNodeState();

  await gsap.to(cody, {
    left: targetPosition.x,
    top: targetPosition.y,
    duration: 0.45,
    ease: "power2.inOut",
  });

  state.currentNodeId = targetNodeId;
  setActivePiece(nodeGraph[targetNodeId].pieceId);
  await transitionAcrossSeam(currentNodeId, direction);

  state.isAnimating = false;
  syncNodeState();
  setCodyAtNode(state.currentNodeId);
}

function onKeyDown(event) {
  const keyMap = {
    ArrowUp: "up",
    w: "up",
    W: "up",
    ArrowLeft: "left",
    a: "left",
    A: "left",
    ArrowDown: "down",
    s: "down",
    S: "down",
    ArrowRight: "right",
    d: "right",
    D: "right",
  };
  if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }

  const direction = keyMap[event.key];

  if (!direction) {
    return;
  }

  console.log(`Key pressed: ${event.key}, mapped to direction: ${direction}.`);
  const targetNodeId = getTargetNodeForDirection(direction);

  console.log(`Current node: ${state.currentNodeId}, target node for direction "${direction}": ${targetNodeId}.`);
  if (!targetNodeId) {
    console.log(`No target node found for direction "${direction}" from current node "${state.currentNodeId}". Checking for seam transition.`);
    const seamTransition = getSeamTransitionForDirection(state.currentNodeId, direction);

    if (seamTransition) {
      event.preventDefault();
      transitionFromCurrentSeam(direction);
    }

    return;
  }

  event.preventDefault();
  moveCodyTo(targetNodeId);
}

window.addEventListener("keydown", onKeyDown);


function onWheel(event) {
  if (state.isAnimating || state.handoffInFlight || event.deltaY === 0) {
    return;
  }

  if (Date.now() < state.wheelCooldownUntil) {
    event.preventDefault();
    return;
  }

  if (!centerPathNodes.has(state.currentNodeId)) {
    event.preventDefault();
    return;
  }

  const direction = event.deltaY > 0 ? "down" : "up";
  const targetNodeId = getTargetNodeForDirection(direction);

  if (!targetNodeId) {
    const seamTransition = getSeamTransitionForDirection(state.currentNodeId, direction);

    if (seamTransition) {
      event.preventDefault();
      state.wheelCooldownUntil = Date.now() + SCROLL_WHEEL_COOLDOWN_MS;
      transitionFromCurrentSeam(direction);
      return;
    }

    return;
  }

  event.preventDefault();
  state.wheelCooldownUntil = Date.now() + SCROLL_WHEEL_COOLDOWN_MS;
  moveCodyTo(targetNodeId);
}

function lockNativeScroll() {
  if (state.scrollLockCleanup) {
    return;
  }

  const body = document.body;
  const previousBodyTouchAction = body.style.touchAction;
  const blockedKeys = new Set([
    "ArrowUp",
    "ArrowDown",
    "PageUp",
    "PageDown",
    "Home",
    "End",
    " ",
  ]);

  const preventScroll = (event) => {
    event.preventDefault();
  };

  const preventScrollKeys = (event) => {
    if (blockedKeys.has(event.key)) {
      event.preventDefault();
    }
  };

  body.style.touchAction = "none";

  window.addEventListener("wheel", preventScroll, { passive: false });
  window.addEventListener("touchmove", preventScroll, { passive: false });
  window.addEventListener("keydown", preventScrollKeys, { passive: false });

  state.scrollLockCleanup = () => {
    body.style.touchAction = previousBodyTouchAction;
    window.removeEventListener("wheel", preventScroll);
    window.removeEventListener("touchmove", preventScroll);
    window.removeEventListener("keydown", preventScrollKeys);
    state.scrollLockCleanup = null;
  };
}

function unlockNativeScroll() {
  state.scrollLockCleanup?.();
}

window.addEventListener("wheel", onWheel, { passive: false });


function onNodeClick(event) {
  console.log("Node click event:", event);
  const node = event.currentTarget;
  const targetNodeId = node.dataset.nodeId;
  const neighbors = Object.values(nodeGraph[state.currentNodeId]?.directionTargets ?? {});

  if (!targetNodeId || !neighbors.includes(targetNodeId)) {
    return;
  }

  moveCodyTo(targetNodeId);
}

pieceConfigs.forEach((piece) => {
  Object.values(piece.nodes).forEach((node) => {
    console.log("addinglistiner",node);
    node.addEventListener("click", onNodeClick);
  });
});
