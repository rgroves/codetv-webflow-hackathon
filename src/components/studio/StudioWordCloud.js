import { gsap } from "../../lib/gsap.js";

const wordClouds = document.querySelectorAll("[data-studio-word-cloud]");

wordClouds.forEach((cloud) => {
  const panel = cloud.querySelector(".studio-word-cloud__panel");
  const speakerLabel = cloud.querySelector("[data-studio-word-cloud-speaker]");
  const wordsContainer = cloud.querySelector("[data-studio-word-cloud-words]");
  const announcement = cloud.querySelector("[data-studio-word-cloud-announcement]");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeTimeline = null;
  let activeDetail = null;

  const hideCloud = () => {
    cloud.setAttribute("aria-hidden", "true");
    cloud.style.visibility = "hidden";
  };

  const completeCloud = () => {
    const completedDetail = activeDetail;

    activeTimeline = null;
    activeDetail = null;
    hideCloud();

    if (completedDetail) {
      window.dispatchEvent(new CustomEvent("studio-word-cloud:complete", {
        detail: completedDetail,
      }));
    }
  };

  const showCloud = ({ speaker, message, duration = 8, nodeId, isFinalVisit = false }) => {
    if (!speaker || !message || !panel || !speakerLabel || !wordsContainer || !announcement) {
      return;
    }

    activeTimeline?.kill();
    completeCloud();
    gsap.killTweensOf(cloud.querySelectorAll(".studio-word-cloud__word"));

    const words = message.trim().split(/\s+/);
    wordsContainer.replaceChildren();

    const wordElements = words.map((word) => {
      const element = document.createElement("span");
      element.className = "studio-word-cloud__word";
      element.textContent = word;
      wordsContainer.appendChild(element);
      return element;
    });

    speakerLabel.textContent = speaker;
    cloud.dataset.speaker = speaker.toLowerCase();
    cloud.style.visibility = "visible";
    cloud.setAttribute("aria-hidden", "false");
    announcement.textContent = `${speaker} says: ${message}`;
    activeDetail = { speaker, message, nodeId, isFinalVisit };

    const motionDuration = reduceMotion.matches ? 0.01 : 0.32;
    const stagger = reduceMotion.matches ? 0 : Math.min(0.065, 1.35 / words.length);

    activeTimeline = gsap.timeline({
      defaults: { ease: "steps(5)" },
      onComplete: completeCloud,
    });

    activeTimeline
      .set(cloud, { opacity: 1, y: 0 })
      .fromTo(
        panel,
        { scale: 0.45, y: 14 },
        { scale: 1, y: 0, duration: motionDuration, transformOrigin: "50% 100%" },
      )
      .fromTo(
        speakerLabel,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: motionDuration * 0.8 },
        "<",
      )
      .fromTo(
        wordElements,
        {
          opacity: 0,
          scale: 0,
          y: (index) => (index % 2 === 0 ? 9 : -7),
          rotation: (index) => (index % 3 - 1) * 10,
        },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          rotation: (index) => (index % 5 - 2) * 1.5,
          duration: reduceMotion.matches ? 0.01 : 0.24,
          stagger,
        },
        "<0.08",
      )
      .to(
        wordElements,
        {
          y: (index) => (index % 2 === 0 ? -2 : 2),
          duration: reduceMotion.matches ? 0.01 : 0.45,
          stagger: reduceMotion.matches ? 0 : 0.025,
          repeat: reduceMotion.matches ? 0 : 1,
          yoyo: true,
          ease: "steps(2)",
        },
        ">0.08",
      )
      .to(
        wordElements,
        {
          opacity: 0,
          scale: 0.6,
          y: -7,
          duration: reduceMotion.matches ? 0.01 : 0.28,
          stagger: reduceMotion.matches ? 0 : { each: 0.025, from: "random" },
        },
        duration,
      )
      .to(
        cloud,
        {
          opacity: 0,
          y: -8,
          duration: reduceMotion.matches ? 0.01 : 0.35,
        },
        "<0.08",
      )
      .set(cloud, { y: 0 });
  };

  window.addEventListener("studio-word-cloud:show", (event) => {
    showCloud(event.detail ?? {});
  });

  gsap.set(cloud, { opacity: 0 });
  hideCloud();
});
