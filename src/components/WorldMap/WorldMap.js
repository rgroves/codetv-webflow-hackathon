import { gsap, ScrollTrigger } from "../../lib/gsap.js";

// Cooldown period in milliseconds to prevent rapid scroll events.
const SCROLL_WHEEL_COOLDOWN_MS = 300;
const SWIPE_MIN_DISTANCE_PX = 40;
const SWIPE_SCROLL_LOCK_DISTANCE_PX = 8;
const STUDIO_WORD_CLOUD_DURATION_SECONDS = 8;
const SEAM_FLIP_SETTINGS = {
  up: { rotationX: -88, rotationY: 0, transformOrigin: "50% 0%" },
  down: { rotationX: 88, rotationY: 0, transformOrigin: "50% 100%" },
  left: { rotationX: 0, rotationY: 88, transformOrigin: "0% 50%" },
  right: { rotationX: 0, rotationY: -88, transformOrigin: "100% 50%" },
};

const studioNodeMessages = {
  "bottom:entry": [
    {
      speaker: "Jason",
      message: "What would you build if you had 30 minutes to plan and 4 hours to build?",
    },
    {
      speaker: "Jason",
      message: "If you want to see us make more TV for developers, head to codetv.dev to learn more details and join up!",
    },
  ],
  "bottom:mid": [
    {
      speaker: "Cassie",
      message: "Animate pretty much anything on the web with GSAP!",
    },
    {
      speaker: "Cassie",
      message: "I can't believe everything that people put together. Did you watch the episode?",
    },
  ],
  "bottom:south": [
    {
      speaker: "Henry",
      message: "The soul business is booming!",
    },
    {
      speaker: "Henry",
      message: "Is your soul on the blockchain?",
    },
  ],
  "bottom:east": [
    {
      speaker: "Ilja",
      message: "No problem! It's just a couple of div blocks.",
    },
    {
      speaker: "Dennis",
      message: "Three types of animation, too much? Nah, it's a nice challenge.",
    },
  ],
  "bottom:west": [
    {
      speaker: "David",
      message: "If you're going to launch in 4.5 hours, you better dress the part.",
    },
    {
      speaker: "Steven",
      message: "Crash the lander. Crash the world... Don't crash the lander!",
    },
  ],
};

const studioNodeAvatars = {
  "bottom:entry": ["jason"],
  "bottom:mid": ["cassie"],
  "bottom:south": ["henry"],
  "bottom:east": ["ilja", "dennis"],
  "bottom:west": ["david", "steven"],
};

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

const mapDialog = root.querySelector("[data-map-dialog]");
const bottomMapSection = root.querySelector('[data-map-piece="bottom"]')?.closest(".map-section");
const powerTrailLayer = root.querySelector("[data-power-trail-layer]");
const studioCamera = root.querySelector("[data-studio-camera]");
const studioCameraShell = root.querySelector("[data-studio-camera-shell]");
const studioCameraControls = Array.from(root.querySelectorAll("[data-studio-camera-direction]"));
const mobileStudioCamera = window.matchMedia("(max-width: 760px)");

const cody = root.querySelector("#cody");

if (!cody) {
  throw new Error("The cody element is missing.");
}

if (!powerTrailLayer) {
  throw new Error("The power trail layer is missing.");
}

if (!studioCamera || !studioCameraShell || studioCameraControls.length === 0) {
  throw new Error("The studio camera is missing.");
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
  {
    id: "bottom",
    element: root.querySelector('[data-map-piece="bottom"]'),
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
    directionTargets: { down: "top:junction" },
  },
  "top:junction": {
    pieceId: "top",
    directionTargets: { up: "top:entry", left: "top:branch-left", right: "top:branch-right", down: "top:stop" },
  },
  "top:branch-left": {
    pieceId: "top",
    directionTargets: { right: "top:junction" },
  },
  "top:branch-right": {
    pieceId: "top",
    directionTargets: { left: "top:junction" },
  },
  "top:stop": {
    pieceId: "top",
    directionTargets: { up: "top:junction" },
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
  touchGesture: null,
  scrollLockCleanup: null,
  inventory: new Set(),
  powerTrailItems: [],
  powerTrailCursor: 0,
  studioNodeVisits: new Map(),
  departedStudioNodes: new Set(),
  studioComplete: false,
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
  const isStudioNode = nodeId.startsWith("bottom:");

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2 + (isStudioNode ? rect.height * 0.36 : 0) + window.scrollY,
  };
}

function updateStudioCameraEdges() {
  const maxScrollLeft = Math.max(0, studioCamera.scrollWidth - studioCamera.clientWidth);
  const cameraIsActive =
    mobileStudioCamera.matches &&
    state.currentNodeId?.startsWith("bottom:") &&
    maxScrollLeft > 1;
  const directionTargets = nodeGraph[state.currentNodeId]?.directionTargets ?? {};
  const canPanLeft = cameraIsActive && !state.isAnimating && Boolean(directionTargets.left);
  const canPanRight = cameraIsActive && !state.isAnimating && Boolean(directionTargets.right);

  studioCameraShell.dataset.canPanLeft = canPanLeft ? "true" : "false";
  studioCameraShell.dataset.canPanRight = canPanRight ? "true" : "false";

  studioCameraControls.forEach((control) => {
    const direction = control.dataset.studioCameraDirection;
    control.disabled = direction === "left" ? !canPanLeft : !canPanRight;
  });
}

function getStudioCameraTarget(nodeId) {
  if (!mobileStudioCamera.matches || !nodeId.startsWith("bottom:") || studioCamera.clientWidth === 0) {
    return null;
  }

  const node = getNodeElement(nodeId);

  if (!node) {
    return null;
  }

  const cameraRect = studioCamera.getBoundingClientRect();
  const nodeRect = node.getBoundingClientRect();
  const nodeCenter = nodeRect.left - cameraRect.left + studioCamera.scrollLeft + nodeRect.width / 2;
  const maxScrollLeft = Math.max(0, studioCamera.scrollWidth - studioCamera.clientWidth);
  let scrollLeft = Math.min(maxScrollLeft, Math.max(0, nodeCenter - studioCamera.clientWidth / 2));

  if (scrollLeft < 16) {
    scrollLeft = 0;
  } else if (maxScrollLeft - scrollLeft < 16) {
    scrollLeft = maxScrollLeft;
  }

  return {
    scrollLeft,
    x: cameraRect.left + nodeCenter - scrollLeft,
  };
}

function setStudioCameraAtNode(nodeId) {
  if (!mobileStudioCamera.matches) {
    studioCamera.scrollLeft = 0;
    updateStudioCameraEdges();
    return;
  }

  const target = getStudioCameraTarget(nodeId);

  if (target) {
    studioCamera.scrollLeft = target.scrollLeft;
  }

  updateStudioCameraEdges();
}

function onStudioCameraControlClick(event) {
  const direction = event.currentTarget.dataset.studioCameraDirection;
  const targetNodeId = getTargetNodeForDirection(direction);

  if (targetNodeId) {
    moveCodyTo(targetNodeId);
  }
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
    const seamDirection = isCurrent && !state.isAnimating
      ? seamTransitions[nodeId]?.direction
      : null;

    node.dataset.current = isCurrent ? "true" : "false";
    node.dataset.clickable = isClickable ? "true" : "false";
    node.disabled = !isClickable;

    if (seamDirection) {
      node.dataset.seamDirection = seamDirection;
    } else {
      delete node.dataset.seamDirection;
    }

    if (isCurrent) {
      node.disabled = false;
    }
  });

  updateStudioCameraEdges();
}

// Sets Cody McCodeface's position on the map based on the specified node's position.
function setCodyAtNode(nodeId) {
  const position = getNodePagePosition(nodeId);

  if (!position) {
    return;
  }

  cody.dataset.location = nodeId.startsWith("bottom:") ? "studio" : "map";
  cody.style.left = `${position.x}px`;
  cody.style.top = `${position.y}px`;
}

state.currentNodeId = "home:start";
setActivePiece("home");
syncNodeState();
window.scrollTo(0, 0);
updateCodyPose("down", 0);

requestAnimationFrame(() => {
  window.scrollTo(0, 0);
  setStudioCameraAtNode(state.currentNodeId);
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
    setStudioCameraAtNode(state.currentNodeId);
    setCodyAtNode(state.currentNodeId);
    ScrollTrigger.refresh();
    state.resizePending = false;
  });
}

window.addEventListener("resize", onResize);
studioCamera.addEventListener("scroll", updateStudioCameraEdges, { passive: true });
studioCameraControls.forEach((control) => {
  control.addEventListener("click", onStudioCameraControlClick);
});

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

function dismissStudioWordCloud() {
  window.dispatchEvent(new Event("studio-word-cloud:dismiss"));
}

function scrollToPiece(pieceId, direction) {
  const piece = pieceMap.get(pieceId);

  if (!piece) {
    return Promise.resolve();
  }

  const flipTarget = piece.element.closest(".map-section") ?? piece.element;
  const flipSettings = SEAM_FLIP_SETTINGS[direction];
  const targetScrollY = Math.max(
    0,
    piece.element.getBoundingClientRect().top + window.scrollY - 12,
  );
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flipFromVars = flipSettings && !reduceMotion
    ? { ...flipSettings, transformPerspective: 1200, willChange: "transform" }
    : null;
  const flipToVars = {
    rotationX: 0,
    rotationY: 0,
    duration: 0.9,
    ease: "power2.inOut",
  };

  state.handoffInFlight = true;
  lockNativeScroll();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;

      settled = true;
      gsap.set(flipTarget, { clearProps: "transform,transformOrigin,willChange" });
      state.handoffInFlight = false;
      unlockNativeScroll();
      resolve();
    };
    const timeline = gsap.timeline({
      onComplete: finish,
      onInterrupt: finish,
    });

    if (flipFromVars) {
      timeline.fromTo(flipTarget, flipFromVars, flipToVars, 0);
    }

    timeline.to(window, {
      duration: 0.9,
      ease: "power2.inOut",
      scrollTo: { y: targetScrollY },
    }, 0);
  });
}

async function transitionFromCurrentSeam(direction) {
  if (state.studioComplete || state.isAnimating || state.handoffInFlight) {
    return;
  }

  console.log(`Attempting to transition from node ${state.currentNodeId} across seam in direction ${direction}.`);
  const transition = getSeamTransitionForDirection(state.currentNodeId, direction);

  if (!transition) {
    return;
  }

  dismissStudioWordCloud();
  state.isAnimating = true;
  syncNodeState();
  await shrinkCody();
  updateCodyPose(direction, 1);

  console.log(`Transitioning from node ${state.currentNodeId} to node ${transition.targetNodeId} across seam in direction ${direction}.`);
  await scrollToPiece(transition.targetPieceId, direction);
  state.currentNodeId = transition.targetNodeId;
  setActivePiece(transition.targetPieceId);

  updateCodyPose(direction, 0);
  setStudioCameraAtNode(state.currentNodeId);
  setCodyAtNode(state.currentNodeId);
  await unshrinkCody();
  state.isAnimating = false;
  syncNodeState();
  triggerActionForNode(state.currentNodeId);
}

function getDirectionForMove(fromId, toId) {
  const targets = nodeGraph[fromId]?.directionTargets ?? {};

  return Object.entries(targets).find(([, candidate]) => candidate === toId)?.[0] ?? null;
}

function updateCodyPose(direction, intensity = 0) {
  const tiltMap = { up: 0, down: 0, left: -7, right: 7 };
  const tilt = tiltMap[direction] ?? 0;

  gsap.set(cody, {
    xPercent: -50,
    yPercent: -100,
    rotate: tilt,
  });

  gsap.set(cody.querySelector(".cody-sprite"), {
    transformOrigin: "50% 100%",
    y: intensity ? -15 : 0,
  });
}

async function shrinkCody() {
  // Shrink Cody McCodeface as if falling into the center of a node.
  await gsap.to(cody, {
    scale: 0,
    transformOrigin: "50% 100%",
    duration: 0.3,
    ease: "power2.inOut",
  });
}

async function unshrinkCody() {
  // Re-bigify Cody McCodeface as if popping out of a node.
  await gsap.to(cody, {
    scale: 1,
    duration: 0.3,
    ease: "power2.inOut",
  });
}

async function moveCodyTo(targetNodeId) {
  if (state.studioComplete || state.isAnimating || state.handoffInFlight || targetNodeId === state.currentNodeId) {
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

  const studioCameraTarget = getStudioCameraTarget(targetNodeId);

  if (studioCameraTarget) {
    targetPosition.x = studioCameraTarget.x;
  }

  dismissStudioWordCloud();
  state.isAnimating = true;
  syncNodeState();
  updateCodyPose(direction, 1);

  await playMoveCodyAnimation(cody, targetPosition, studioCameraTarget);

  state.currentNodeId = targetNodeId;
  setActivePiece(nodeGraph[targetNodeId].pieceId);

  state.isAnimating = false;
  updateCodyPose(direction, 0);
  syncNodeState();
  setCodyAtNode(state.currentNodeId);

  triggerActionForNode(state.currentNodeId);
}

async function playMoveCodyAnimation(cody, targetPosition, studioCameraTarget = null) {
  const trailItems = state.currentNodeId.startsWith("bottom:") ? [] : state.powerTrailItems;
  const trailAnimation = getPowerTrailAnimationSettings();

  let trailCount = 0;

  const createTrailItem = () => {
    const codyRect = cody.getBoundingClientRect();
    const trailItem = trailItems[state.powerTrailCursor % trailItems.length];
    const element = document.createElement(trailItem.type === "logo" ? "img" : "span");

    state.powerTrailCursor += 1;
    element.classList.add("power-trail-item");

    if (trailItem.type === "logo") {
      element.classList.add("power-trail-item--logo");
      element.src = trailItem.src;
      element.alt = "";
      element.setAttribute("aria-hidden", "true");
      element.draggable = false;
    } else {
      element.classList.add("power-trail-item--emoji");
      element.textContent = trailItem.value;
    }

    powerTrailLayer.appendChild(element);

    gsap.set(element, {
      left: codyRect.left + codyRect.width / 2,
      top: codyRect.top + codyRect.height / 2,
      xPercent: -50,
      yPercent: -50,
      scale: 1,
    });

    gsap.to(element, {
      x: gsap.utils.random(-trailAnimation.spread, trailAnimation.spread),
      y: gsap.utils.random(-trailAnimation.spread, trailAnimation.spread),
      rotation: gsap.utils.random(-25, 25),
      scale: gsap.utils.random(trailAnimation.minScale, trailAnimation.maxScale),
      opacity: 1,
      duration: 0.9,
      ease: "power1.out",
      onComplete: () => element.remove(),
    });

    trailCount += 1;
  };

  const updateTrail = () => {
    if (trailItems.length === 0) {
      return;
    }

    const expectedTrailCount = Math.floor(tl.progress() * 20);

    while (trailCount < expectedTrailCount) {
      createTrailItem();
    }
  };

  const tl = gsap.timeline({ onUpdate: updateTrail });

  if (studioCameraTarget) {
    tl.to(studioCamera, {
      scrollLeft: studioCameraTarget.scrollLeft,
      duration: 0.45,
      ease: "power2.inOut",
    }, 0);
  }

  await tl.to(cody, {
    left: targetPosition.x,
    top: targetPosition.y,
    duration: 0.45,
    ease: "power2.inOut",
  }, 0);

  updateStudioCameraEdges();
}

function getPowerTrailAnimationSettings() {
  const styles = getComputedStyle(powerTrailLayer);
  const readNumber = (property, fallback) => Number.parseFloat(styles.getPropertyValue(property)) || fallback;

  return {
    spread: readNumber("--power-trail-spread", 150),
    minScale: readNumber("--power-trail-min-scale", 2),
    maxScale: readNumber("--power-trail-max-scale", 4),
  };
}

function onKeyDown(event) {
  if (mapDialog?.open) {
    return;
  }

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

const collectPowerBundle = (powerId) => {
  const bundle = document.getElementById(`${powerId}-bundle`);
  bundle?.dispatchEvent(new Event("power-bundle:collect"));
};

const getPowerBundleLogoTrailItems = (powerId) => {
  const bundle = document.getElementById(`${powerId}-bundle`);

  if (!bundle) {
    return [];
  }

  return Array.from(bundle.querySelectorAll("[data-power-logo] img"))
    .map((logo) => logo.currentSrc || logo.src)
    .filter(Boolean)
    .map((src) => ({ type: "logo", src }));
};

const addPowerTrailItems = (powerId, emojis) => {
  state.powerTrailItems.push(
    ...emojis.map((value) => ({ type: "emoji", value })),
    ...getPowerBundleLogoTrailItems(powerId),
  );
};

const collectCodePower = () => {
  showMapDialog("Power Up", "Code Power", "You gained the power of code!");
  state.inventory.add("code-power");
  addPowerTrailItems("code-power", ['🧙', '✨', '🧑‍💻']);
  collectPowerBundle("code-power");
};

const collectCommunityPower = () => {
  showMapDialog("Power Up", "Community Power", "You gained the power of community!");
  state.inventory.add("community-power");
  addPowerTrailItems("community-power", ['🧡', '😆', '💪']);
  collectPowerBundle("community-power");
};

const triggerStudioWordCloud = (nodeId) => {
  const messages = studioNodeMessages[nodeId];

  if (!messages) {
    return;
  }

  const visitCount = state.studioNodeVisits.get(nodeId) ?? 0;
  const wordCloud = messages[visitCount];

  state.studioNodeVisits.set(nodeId, visitCount + 1);

  if (!wordCloud) {
    return;
  }

  window.dispatchEvent(new CustomEvent("studio-word-cloud:show", {
    detail: {
      ...wordCloud,
      nodeId,
      isFinalVisit: visitCount === messages.length - 1,
      duration: STUDIO_WORD_CLOUD_DURATION_SECONDS,
    },
  }));
};

const exitStudioAvatars = (nodeId) => {
  const avatarIds = studioNodeAvatars[nodeId];
  const studioDoor = root.querySelector(".studio-curtained-door");

  if (!avatarIds || !studioDoor || state.departedStudioNodes.has(nodeId)) {
    return;
  }

  const avatars = avatarIds
    .map((avatarId) => root.querySelector(`[data-studio-avatar="${avatarId}"]`))
    .filter(Boolean);

  if (avatars.length === 0) {
    return;
  }

  state.departedStudioNodes.add(nodeId);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doorRect = studioDoor.getBoundingClientRect();
  const doorTarget = {
    x: doorRect.left + doorRect.width / 2,
    y: doorRect.top + doorRect.height * 0.7,
  };
  const exitTimeline = gsap.timeline();

  avatars.forEach((avatar, index) => {
    const avatarRect = avatar.getBoundingClientRect();
    const avatarCenter = {
      x: avatarRect.left + avatarRect.width / 2,
      y: avatarRect.top + avatarRect.height / 2,
    };
    const startAt = reduceMotion ? 0 : index * 0.18;
    const travelDuration = reduceMotion ? 0.2 : 1;
    const label = avatar.querySelector(".studio-avatar__label");
    const image = avatar.querySelector(".studio-avatar__image");
    const shadow = avatar.querySelector(".studio-avatar__shadow");

    avatar.setAttribute("aria-hidden", "true");
    avatar.dataset.exiting = "true";

    if (label) {
      exitTimeline.to(label, { opacity: 0, duration: reduceMotion ? 0.01 : 0.12 }, startAt);
    }

    if (shadow) {
      exitTimeline.to(shadow, { opacity: 0, duration: travelDuration * 0.7 }, startAt);
    }

    if (image && !reduceMotion) {
      exitTimeline.to(image, {
        y: -4,
        duration: 0.1,
        repeat: 7,
        yoyo: true,
        ease: "steps(2)",
      }, startAt);
    }

    exitTimeline
      .to(avatar, {
        x: `+=${doorTarget.x - avatarCenter.x}`,
        y: `+=${doorTarget.y - avatarCenter.y}`,
        scale: reduceMotion ? 0.35 : 0.65,
        duration: travelDuration,
        ease: "power2.inOut",
      }, startAt)
      .to(avatar, {
        opacity: 0,
        duration: reduceMotion ? 0.12 : 0.28,
        ease: "power1.in",
      }, startAt + travelDuration * 0.72)
      .set(avatar, { zIndex: 13 }, startAt + travelDuration * 0.82)
      .call(() => {
        avatar.remove();
        completeStudioWhenEmpty();
      }, [], startAt + travelDuration + 0.02);
  });
};

function completeStudioWhenEmpty() {
  if (state.studioComplete || root.querySelector("[data-studio-avatar]")) {
    return;
  }

  if (state.isAnimating || state.handoffInFlight) {
    requestAnimationFrame(completeStudioWhenEmpty);
    return;
  }

  state.studioComplete = true;

  const currentNodeId = state.currentNodeId;
  const currentNode = getNodeElement(currentNodeId);
  const currentNodeConfig = nodeGraph[currentNodeId];

  if (currentNodeConfig) {
    currentNodeConfig.directionTargets = {};
  }

  delete seamTransitions[currentNodeId];

  const nodesToRemove = Array.from(root.querySelectorAll("[data-node]"))
    .filter((node) => node !== currentNode);
  const labelsToRemove = Array.from(root.querySelectorAll(
    ".path-label, .studio-node-label",
  ));
  const elementsToRemove = [...nodesToRemove, ...labelsToRemove];

  nodesToRemove.forEach((node) => {
    node.disabled = true;
    node.dataset.clickable = "false";
  });

  syncNodeState();

  if (elementsToRemove.length === 0) {
    window.dispatchEvent(new Event("studio-konami:show"));
    return;
  }

  gsap.to(elementsToRemove, {
    opacity: 0,
    scale: 0.72,
    duration: 0.32,
    stagger: { each: 0.025, from: "random" },
    ease: "steps(4)",
    onComplete: () => {
      nodesToRemove.forEach((node) => {
        const nodeId = node.dataset.nodeId;

        node.remove();

        if (!nodeId) {
          return;
        }

        delete nodeGraph[nodeId];

        pieceConfigs.forEach((piece) => {
          delete piece.nodes[nodeId];
        });
      });

      labelsToRemove.forEach((label) => label.remove());
      window.dispatchEvent(new Event("studio-konami:show"));
    },
  });
}

window.addEventListener("studio-word-cloud:complete", (event) => {
  const detail = event.detail;

  if (detail?.isFinalVisit && detail.nodeId) {
    exitStudioAvatars(detail.nodeId);
  }
});

const triggerActionForNode = (nodeId) => {
  triggerStudioWordCloud(nodeId);

  switch (nodeId) {
    case "top:branch-left":
      if (!state.inventory.has("code-power")) collectCodePower();
      break;

    case "top:branch-right":
      if (!state.inventory.has("community-power")) collectCommunityPower();
      break;

    case "top:stop":
      if (!state.inventory.has("EOL")) {
        if (["code-power", "community-power"].every((power) => state.inventory.has(power))) {
          showMapDialog("Cody McCodeface says...", "I'm ready", "Let's head to the CodeTV studio!");
          state.inventory.add("EOL");
          revealBottomMapPiece();
        } else {
          const powersNeeded = ["code-power", "community-power"].filter((power) => !state.inventory.has(power)).map((power) => power.replace(/(.+)-power$/, "the power of $1"));
          showMapDialog("Cody McCodeface says...", "I'm not ready yet.", `Help me find ${powersNeeded.join(" and ")} so that I can confidently make my way to the CodeTV studio.`);
        }
      }
      break;

    default:
      // noop
      break;
  }
};

function revealBottomMapPiece() {
  if (!bottomMapSection) {
    return;
  }

  Object.assign(nodeGraph, {
    "bottom:entry": {
      pieceId: "bottom",
      directionTargets: { down: "bottom:mid" },
    },
    "bottom:mid": {
      pieceId: "bottom",
      directionTargets: { up: "bottom:entry", left: "bottom:west", right: "bottom:east", down: "bottom:south" },
    },
    "bottom:west": {
      pieceId: "bottom",
      directionTargets: { right: "bottom:mid" },
    },
    "bottom:east": {
      pieceId: "bottom",
      directionTargets: { left: "bottom:mid" },
    },
    "bottom:south": {
      pieceId: "bottom",
      directionTargets: { up: "bottom:mid" },
    },
  });

  seamTransitions["top:stop"] = {
    targetNodeId: "bottom:entry",
    targetPieceId: "bottom",
    direction: "down",
  };

  seamTransitions["bottom:entry"] = {
    targetNodeId: "top:stop",
    targetPieceId: "top",
    direction: "up",
  };

  bottomMapSection.hidden = false;
  syncNodeState();
  ScrollTrigger.refresh();
}

function showMapDialog(eyebrow, title, message) {
  window.dispatchEvent(new CustomEvent("map-dialog:show", {
    detail: { eyebrow, title, message },
  }));
}


window.addEventListener("keydown", onKeyDown);


function onWheel(event) {
  if (mapDialog?.open || state.isAnimating || state.handoffInFlight || event.deltaY === 0) {
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

function getTouchByIdentifier(touchList, identifier) {
  return Array.from(touchList).find((touch) => touch.identifier === identifier) ?? null;
}

function getSwipeDirection(deltaX, deltaY) {
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (Math.max(horizontalDistance, verticalDistance) < SWIPE_MIN_DISTANCE_PX) {
    return null;
  }

  if (horizontalDistance > verticalDistance) {
    return deltaX > 0 ? "left" : "right";
  }

  return deltaY > 0 ? "up" : "down";
}

function moveCodyInDirection(direction) {
  if (mapDialog?.open || state.studioComplete || state.isAnimating || state.handoffInFlight) {
    return false;
  }

  const targetNodeId = getTargetNodeForDirection(direction);

  if (targetNodeId) {
    moveCodyTo(targetNodeId);
    return true;
  }

  if (getSeamTransitionForDirection(state.currentNodeId, direction)) {
    transitionFromCurrentSeam(direction);
    return true;
  }

  return false;
}

function onTouchStart(event) {
  if (mapDialog?.open || event.touches.length !== 1) {
    state.touchGesture = null;
    return;
  }

  const touch = event.touches[0];

  state.touchGesture = {
    identifier: touch.identifier,
    startX: touch.clientX,
    startY: touch.clientY,
  };
}

function onTouchMove(event) {
  const gesture = state.touchGesture;

  if (!gesture || event.touches.length !== 1) {
    state.touchGesture = null;
    return;
  }

  const touch = getTouchByIdentifier(event.touches, gesture.identifier);

  if (!touch) {
    state.touchGesture = null;
    return;
  }

  const distance = Math.max(
    Math.abs(touch.clientX - gesture.startX),
    Math.abs(touch.clientY - gesture.startY),
  );

  if (distance >= SWIPE_SCROLL_LOCK_DISTANCE_PX) {
    event.preventDefault();
  }
}

function onTouchEnd(event) {
  const gesture = state.touchGesture;
  state.touchGesture = null;

  if (!gesture || mapDialog?.open) {
    return;
  }

  const touch = getTouchByIdentifier(event.changedTouches, gesture.identifier);

  if (!touch) {
    return;
  }

  const direction = getSwipeDirection(
    touch.clientX - gesture.startX,
    touch.clientY - gesture.startY,
  );

  if (!direction) {
    return;
  }

  event.preventDefault();
  moveCodyInDirection(direction);
}

function onTouchCancel() {
  state.touchGesture = null;
}

root.addEventListener("touchstart", onTouchStart, { passive: true });
root.addEventListener("touchmove", onTouchMove, { passive: false });
root.addEventListener("touchend", onTouchEnd, { passive: false });
root.addEventListener("touchcancel", onTouchCancel, { passive: true });

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
    console.log("addinglistiner", node);
    node.addEventListener("click", onNodeClick);
  });
});
