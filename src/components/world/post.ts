import {
  BloomEffect, ChromaticAberrationEffect, Effect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import * as THREE from "three";

/**
 * The world's lens (pmndrs postprocessing): HDR render, bloom on everything bright (glows, rims, the moving dot),
 * the chapter's exposure, neutral tone mapping, then a chromatic fringe that widens with scroll speed (the page's
 * CSS grain already covers the whole screen). Two passes, because chromatic aberration samples its input and would
 * drop the bloom otherwise.
 */

/** Scales the HDR image by the chapter's exposure before tone mapping (dims the world behind dense copy). */
class ExposureEffect extends Effect {
  constructor() {
    super(
      "ExposureEffect",
      /* glsl */ `
        uniform float exposure;
        void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
          outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
        }
      `,
      { uniforms: new Map([["exposure", new THREE.Uniform(1)]]) },
    );
  }
}

export type Lens = {
  render: (dt: number) => void;
  setSize: (width: number, height: number) => void;
  setExposure: (value: number) => void;
  /** 0 at rest, 1 at full scroll speed. */
  setWarp: (value: number) => void;
  dispose: () => void;
};

export function createLens(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, lowPower: boolean): Lens {
  const composer = new EffectComposer(renderer, {
    frameBufferType: THREE.HalfFloatType,
    multisampling: lowPower ? 0 : 4,
  });
  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: 0.32,
    luminanceSmoothing: 0.25,
    intensity: 1.15,
    radius: 0.72,
    resolutionScale: lowPower ? 0.5 : 1,
  });
  const exposure = new ExposureEffect();
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL });
  const fringe = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0004, 0.0003), radialModulation: true, modulationOffset: 0.2 });

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new EffectPass(camera, bloom, exposure, tone));
  composer.addPass(new EffectPass(camera, fringe));

  return {
    render: (dt) => composer.render(dt),
    setSize: (w, h) => composer.setSize(w, h, false),
    setExposure: (v) => { exposure.uniforms.get("exposure")!.value = v; },
    setWarp: (v) => {
      fringe.offset.set(0.0004 + v * 0.0032, 0.0003 + v * 0.0022);
      bloom.intensity = 1.15 + v * 0.6;
    },
    dispose: () => composer.dispose(),
  };
}
