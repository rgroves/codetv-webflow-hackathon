import { gsap } from "../../lib/gsap.js";

const FULL_CIRCLE = Math.PI * 2;
const START_ANGLE = -Math.PI / 2;

document.querySelectorAll("[data-power-bundle]").forEach((bundle) => {
  const logos = Array.from(bundle.querySelectorAll("[data-power-logo]"));

  if (logos.length === 0) {
    return;
  }

  const motion = gsap.matchMedia();

  bundle.addEventListener(
    "power-bundle:collect",
    () => {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const currentTransforms = reduceMotion
        ? []
        : logos.map((logo) => getComputedStyle(logo).transform);

      motion.revert();

      if (reduceMotion) {
        bundle.remove();
        return;
      }

      logos.forEach((logo, index) => {
        gsap.set(logo, { transform: currentTransforms[index] });
      });

      gsap.to(logos, {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 0,
        opacity: 0,
        duration: 0.5,
        stagger: 0.06,
        ease: "back.in(1.7)",
      });

      gsap.to(bundle, {
        opacity: 0,
        duration: 0.2,
        delay: 0.4,
        onComplete: () => bundle.remove(),
      });
    },
    { once: true },
  );

  motion.add("(prefers-reduced-motion: no-preference)", () => {
    const orbit = { angle: START_ANGLE };
    let orbitRadius = 0;
    let weaveDistance = 0;

    const render = () => {
      logos.forEach((logo, index) => {
        const phase = (FULL_CIRCLE * index) / logos.length;
        const angle = orbit.angle + phase;
        const weave = Math.sin(angle * 2 + phase * 0.65);
        const radius = orbitRadius + weave * weaveDistance;
        const depth = (weave + 1) / 2;

        gsap.set(logo, {
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          rotation: Math.sin(angle * 3) * 4,
          scale: 0.95 + depth * 0.1,
          force3D: true,
        });
      });
    };

    const measure = () => {
      const logoSize = logos[0].offsetWidth;
      const bundleStyles = getComputedStyle(bundle);
      const orbitFactor = Number.parseFloat(bundleStyles.getPropertyValue("--power-orbit-factor")) || 1.4;
      const weaveFactor = Number.parseFloat(bundleStyles.getPropertyValue("--power-weave-factor")) || 0.3;

      orbitRadius = logoSize * orbitFactor;
      weaveDistance = logoSize * weaveFactor;
      render();
    };

    measure();

    const orbitTween = gsap.to(orbit, {
      angle: START_ANGLE + FULL_CIRCLE,
      duration: 14,
      ease: "none",
      repeat: -1,
      paused: true,
      onUpdate: render,
    });

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(logos[0]);

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          orbitTween.resume();
        } else {
          orbitTween.pause();
        }
      },
      { rootMargin: "10%" },
    );
    visibilityObserver.observe(logos[0]);

    return () => {
      orbitTween.kill();
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      gsap.set(logos, { clearProps: "transform" });
    };
  });
});
