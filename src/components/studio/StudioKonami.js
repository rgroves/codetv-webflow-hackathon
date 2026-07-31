import { gsap } from "../../lib/gsap.js";

const konamiLogos = document.querySelectorAll("[data-studio-konami]");
const KONAMI_CODE = [
  "up",
  "up",
  "down",
  "down",
  "left",
  "right",
  "left",
  "right",
  "b",
  "a",
];
const KONAMI_DESTINATION = "https://youtu.be/BPSbpxuKAps?si=O3M9IaSyAH2N0ZAh&t=25";

const getKeyTokens = (key) => {
  const normalizedKey = key.toLowerCase();
  const keyTokens = {
    arrowup: ["up"],
    w: ["up"],
    arrowdown: ["down"],
    s: ["down"],
    arrowleft: ["left"],
    a: ["left", "a"],
    arrowright: ["right"],
    d: ["right"],
    b: ["b"],
  };

  return keyTokens[normalizedKey] ?? [];
};

konamiLogos.forEach((konami) => {
  const logo = konami.querySelector(".studio-konami__logo");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let isShown = false;
  let isNavigating = false;
  let codeCursor = 0;

  const showKonami = () => {
    if (isShown || !logo) {
      return;
    }

    isShown = true;
    konami.style.visibility = "visible";
    konami.setAttribute("aria-hidden", "false");

    gsap.fromTo(
      konami,
      { opacity: 0, scale: 0.55, rotation: -7 },
      {
        opacity: 1,
        scale: 1,
        rotation: 0,
        duration: reduceMotion.matches ? 0.01 : 0.55,
        ease: "back.out(1.8)",
      },
    );

    if (reduceMotion.matches) {
      return;
    }

    gsap.to(logo, {
      filter: "drop-shadow(0 0 8px rgba(255, 91, 29, 0.95)) drop-shadow(0 0 15px rgba(240, 154, 24, 0.7))",
      duration: 1.6,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });

    gsap.timeline({ repeat: -1 })
      .to(logo, { x: 0, y: -3, duration: 0.8, ease: "none" })
      .to(logo, { x: 2.2, y: -2.2, duration: 0.8, ease: "none" })
      .to(logo, { x: 3, y: 0, duration: 0.8, ease: "none" })
      .to(logo, { x: 2.2, y: 2.2, duration: 0.8, ease: "none" })
      .to(logo, { x: 0, y: 3, duration: 0.8, ease: "none" })
      .to(logo, { x: -2.2, y: 2.2, duration: 0.8, ease: "none" })
      .to(logo, { x: -3, y: 0, duration: 0.8, ease: "none" })
      .to(logo, { x: -2.2, y: -2.2, duration: 0.8, ease: "none" })
      .to(logo, { x: 0, y: -3, duration: 0.8, ease: "none" });
  };

  const onKonamiKeyDown = (event) => {
    if (!isShown || isNavigating || event.repeat) {
      return;
    }

    const keyTokens = getKeyTokens(event.key);

    if (keyTokens.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const expectedToken = KONAMI_CODE[codeCursor];

    if (keyTokens.includes(expectedToken)) {
      codeCursor += 1;

      gsap.fromTo(
        logo,
        { scale: 1.08 },
        { scale: 1, duration: 0.16, ease: "steps(3)" },
      );

      if (codeCursor < KONAMI_CODE.length) {
        return;
      }

      isNavigating = true;
      gsap.killTweensOf(logo);
      gsap.to(logo, {
        scale: 1.3,
        filter: "drop-shadow(0 0 12px #fff) drop-shadow(0 0 22px #ff7b18)",
        duration: reduceMotion.matches ? 0.01 : 0.28,
        ease: "steps(4)",
        onComplete: () => window.location.assign(KONAMI_DESTINATION),
      });
      return;
    }

    codeCursor = keyTokens.includes(KONAMI_CODE[0]) ? 1 : 0;
  };

  window.addEventListener("studio-konami:show", showKonami);
  window.addEventListener("keydown", onKonamiKeyDown, { capture: true });
});
