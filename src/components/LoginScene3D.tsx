import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface LoginScene3DProps {
  focused?: boolean;
}

const _dummy = new THREE.Object3D();
const _nodeColor = new THREE.Color();

function createVaultGridTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#070a0f';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.22)';
    ctx.lineWidth = 1.5;
    for (let r = 48; r <= 240; r += 48) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(256, 256);
      ctx.lineTo(256 + Math.cos(angle) * 248, 256 + Math.sin(angle) * 248);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.08)';
    for (let step = 0; step <= 512; step += 32) {
      ctx.beginPath();
      ctx.moveTo(step, 0);
      ctx.lineTo(step, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, step);
      ctx.lineTo(512, step);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

export const LoginScene3D: React.FC<LoginScene3DProps> = ({ focused = false }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const focusedRef = useRef(focused);
  const [fallbackActive, setFallbackActive] = useState(false);

  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) || '');
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch {
      setFallbackActive(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 720;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080c);
    scene.fog = new THREE.FogExp2(0x06080c, 0.052);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(4.8, 2.7, 8.2);
    camera.lookAt(-0.9, 0.1, 0);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmrem.dispose();

    // Lighting rig
    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x05070a, 0.65);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.1);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const emeraldRim = new THREE.DirectionalLight(0x10b981, 1.8);
    emeraldRim.position.set(-7, 3, -5);
    scene.add(emeraldRim);

    const coreGlow = new THREE.PointLight(0x10b981, 2.4, 14, 1.5);
    coreGlow.position.set(-2.1, 0.3, 0);
    scene.add(coreGlow);

    // Materials
    const gunmetalMat = new THREE.MeshPhysicalMaterial({
      color: 0x111722,
      metalness: 0.88,
      roughness: 0.28,
      clearcoat: 0.45,
    });

    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      metalness: 0.94,
      roughness: 0.18,
    });

    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      metalness: 0.15,
      roughness: 0.12,
      transmission: isSoftwareGl ? 0 : 0.72,
      ior: 1.5,
      thickness: 0.9,
      emissive: 0x047857,
      emissiveIntensity: 0.45,
    });

    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });

    const conduitMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.55,
      roughness: 0.3,
      metalness: 0.6,
    });

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const gridTexture = createVaultGridTexture(maxAnisotropy);
    const floorMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.65,
      metalness: 0.45,
    });

    // Ground disc
    const floorGeo = new THREE.CircleGeometry(7.2, 64);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(-1.6, -1.85, 0);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Composite 8-Part DSR Security Vault Core (positioned slightly left for split hero framing)
    const vaultGroup = new THREE.Group();
    vaultGroup.position.set(-2.1, 0.15, 0);
    scene.add(vaultGroup);

    const plinthGeo = new THREE.CylinderGeometry(2.1, 2.45, 0.34, 8);
    const plinthMesh = new THREE.Mesh(plinthGeo, gunmetalMat);
    plinthMesh.position.y = -1.68;
    vaultGroup.add(plinthMesh);

    const lathePoints = [
      new THREE.Vector2(0.01, -1.5),
      new THREE.Vector2(1.45, -1.45),
      new THREE.Vector2(1.65, -1.15),
      new THREE.Vector2(1.25, -0.92),
      new THREE.Vector2(0.85, -0.82),
      new THREE.Vector2(0.01, -0.82),
    ];
    const turbineGeo = new THREE.LatheGeometry(lathePoints, 24);
    const turbineMesh = new THREE.Mesh(turbineGeo, gunmetalMat);
    vaultGroup.add(turbineMesh);

    const collarGeo = new THREE.TorusGeometry(1.72, 0.04, 16, 72);
    const collarMesh = new THREE.Mesh(collarGeo, goldMat);
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.position.y = -1.12;
    vaultGroup.add(collarMesh);

    const prismGeo = new THREE.OctahedronGeometry(0.86, 0);
    const prismMesh = new THREE.Mesh(prismGeo, crystalMat);
    prismMesh.castShadow = true;
    vaultGroup.add(prismMesh);

    const cageGeo = new THREE.IcosahedronGeometry(1.26, 1);
    const cageMesh = new THREE.Mesh(cageGeo, shieldMat);
    vaultGroup.add(cageMesh);

    const gimbalOuterGeo = new THREE.TorusGeometry(1.92, 0.045, 16, 80);
    const gimbalOuter = new THREE.Mesh(gimbalOuterGeo, gunmetalMat);
    gimbalOuter.rotation.x = Math.PI * 0.34;
    vaultGroup.add(gimbalOuter);

    const gimbalInnerGeo = new THREE.TorusGeometry(1.56, 0.032, 16, 72);
    const gimbalInner = new THREE.Mesh(gimbalInnerGeo, goldMat);
    gimbalInner.rotation.y = Math.PI * 0.25;
    vaultGroup.add(gimbalInner);

    // Curved data conduits connecting base pillars to ring assembly
    const conduitGeos: THREE.TubeGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(a) * 1.9, -1.5, Math.sin(a) * 1.9),
        new THREE.Vector3(Math.cos(a) * 1.55, -0.65, Math.sin(a) * 1.55),
        new THREE.Vector3(Math.cos(a) * 0.95, 0.1, Math.sin(a) * 0.95),
      ]);
      const tGeo = new THREE.TubeGeometry(curve, 20, 0.024, 8, false);
      conduitGeos.push(tGeo);
      const tMesh = new THREE.Mesh(tGeo, conduitMat);
      vaultGroup.add(tMesh);
    }

    // Orbiting Telemetry Satellites (InstancedMesh)
    const nodeCount = 18;
    const nodeGeo = new THREE.OctahedronGeometry(0.11, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.55,
      roughness: 0.25,
    });
    const satellites = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount);
    satellites.frustumCulled = false;
    vaultGroup.add(satellites);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Pointer parallax (subtle, damped)
    let pointerX = 0;
    let pointerY = 0;
    const handlePointerMove = (e: PointerEvent) => {
      pointerX = (e.clientX / (window.innerWidth || 1) - 0.5) * 2;
      pointerY = (e.clientY / (window.innerHeight || 1) - 0.5) * 2;
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    let frameId = 0;
    let disposed = false;
    let contextLost = false;
    let elapsedAccum = 0;
    let camYawOffset = 0;
    let camPitchOffset = 0;
    let coreSpeedScale = 1;
    const clock = new THREE.Clock();

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext();
      if (
        typeof WebGL2RenderingContext !== 'undefined' &&
        gl instanceof WebGL2RenderingContext &&
        typeof gl.fenceSync === 'function'
      ) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed || contextLost) return;
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    }

    function tick() {
      if (disposed || contextLost) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const speedTarget = prefersReduced ? 0.15 : focusedRef.current ? 1.55 : 1.0;
      coreSpeedScale = THREE.MathUtils.damp(coreSpeedScale, speedTarget, 4, delta);
      elapsedAccum += delta * coreSpeedScale;

      camYawOffset = THREE.MathUtils.damp(camYawOffset, pointerX * 0.65, 3.5, delta);
      camPitchOffset = THREE.MathUtils.damp(camPitchOffset, -pointerY * 0.35, 3.5, delta);

      camera.position.set(4.8 + camYawOffset, 2.7 + camPitchOffset, 8.2);
      camera.lookAt(-0.9, 0.1, 0);

      prismMesh.rotation.y = elapsedAccum * 0.48;
      prismMesh.rotation.x = Math.sin(elapsedAccum * 0.35) * 0.22;
      cageMesh.rotation.y = -elapsedAccum * 0.22;
      gimbalOuter.rotation.z = elapsedAccum * 0.26;
      gimbalInner.rotation.x = elapsedAccum * 0.36;

      for (let i = 0; i < nodeCount; i++) {
        const angle = (i / nodeCount) * Math.PI * 2 + elapsedAccum * 0.2;
        const radius = 2.55 + (i % 3) * 0.42;
        const y = Math.sin(elapsedAccum * 0.8 + i) * 0.42;
        _dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        _dummy.rotation.set(elapsedAccum + i, elapsedAccum * 0.5, 0);
        _dummy.scale.setScalar(i % 4 === 0 ? 1.25 : 0.85);
        _dummy.updateMatrix();
        satellites.setMatrixAt(i, _dummy.matrix);
        _nodeColor.setHex(i % 5 === 0 ? 0xd4af37 : 0x10b981);
        satellites.setColorAt(i, _nodeColor);
      }
      satellites.instanceMatrix.needsUpdate = true;
      if (satellites.instanceColor) {
        satellites.instanceColor.needsUpdate = true;
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    };

    const handleContextRestored = () => {
      contextLost = false;
      clock.getDelta();
      tick();
    };

    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    tick();

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth || 1280;
      const h = container.clientHeight || window.innerHeight || 720;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      floorGeo.dispose();
      plinthGeo.dispose();
      turbineGeo.dispose();
      collarGeo.dispose();
      prismGeo.dispose();
      cageGeo.dispose();
      gimbalOuterGeo.dispose();
      gimbalInnerGeo.dispose();
      nodeGeo.dispose();
      conduitGeos.forEach((g) => g.dispose());
      gridTexture.dispose();
      floorMat.dispose();
      gunmetalMat.dispose();
      goldMat.dispose();
      crystalMat.dispose();
      shieldMat.dispose();
      conduitMat.dispose();
      nodeMat.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (fallbackActive) {
    return (
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 24% 48%, rgba(16, 185, 129, 0.16), transparent 52%), radial-gradient(circle at 78% 72%, rgba(212, 175, 55, 0.08), transparent 45%)',
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    />
  );
};
