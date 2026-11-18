import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ArrowUpRight,
  Camera,
  Eye,
  Layers,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Project } from '../types/domain';
import { formatCurrency, isDateOverdue } from '../utils/calculations';

interface CommandCore3DProps {
  projects: Project[];
  heightClass?: string;
  onInspectProject?: (project: Project) => void;
}

type CameraPreset = 'ORBITAL' | 'TOP_RADAR' | 'CORE_FOCUS';
type ColorMode = 'STATUS' | 'PRIORITY';

const PRESET_VIEWS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  ORBITAL: { pos: [5.8, 3.9, 6.4], target: [0, 0, 0] },
  TOP_RADAR: { pos: [0.05, 8.6, 1.4], target: [0, 0, 0] },
  CORE_FOCUS: { pos: [3.3, 1.45, 3.6], target: [0, 0.1, 0] },
};

// Pre-allocated math helpers (zero per-frame GC)
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _raycaster = new THREE.Raycaster();
const _pointer = new THREE.Vector2();
const _targetCamPos = new THREE.Vector3(...PRESET_VIEWS.ORBITAL.pos);
const _targetLookAt = new THREE.Vector3(...PRESET_VIEWS.ORBITAL.target);

function createCommandGridTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, 512, 512);

    // Radar concentric rings
    for (let r = 56; r <= 240; r += 46) {
      ctx.strokeStyle = r === 148 ? 'rgba(212, 175, 55, 0.25)' : 'rgba(16, 185, 129, 0.2)';
      ctx.lineWidth = r === 148 ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Azimuth spokes
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(256, 256);
      ctx.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

export const CommandCore3D: React.FC<CommandCore3DProps> = ({
  projects,
  heightClass = 'h-[440px] lg:h-[490px]',
  onInspectProject,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [exploded, setExploded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [preset, setPreset] = useState<CameraPreset>('ORBITAL');
  const [colorMode, setColorMode] = useState<ColorMode>('STATUS');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const [webglFallback, setWebglFallback] = useState(false);
  const [resetNonce, setResetNonce] = useState(0);

  const explodedRef = useRef(exploded);
  const pausedRef = useRef(paused);
  const presetRef = useRef(preset);
  const colorModeRef = useRef(colorMode);
  const selectedIdRef = useRef<string | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const resetNonceRef = useRef(resetNonce);
  const projectsRef = useRef(projects);
  const userNavigatingRef = useRef(false);
  const cameraAnimatingRef = useRef(false);

  useEffect(() => {
    explodedRef.current = exploded;
  }, [exploded]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    colorModeRef.current = colorMode;
  }, [colorMode]);

  useEffect(() => {
    projectsRef.current = projects;
    if (selectedProject) {
      const fresh = projects.find((p) => p.id === selectedProject.id) || null;
      setSelectedProject(fresh);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    selectedIdRef.current = selectedProject?.id || null;
  }, [selectedProject]);

  useEffect(() => {
    hoveredIdRef.current = hoveredProject?.id || null;
  }, [hoveredProject]);

  const applyPreset = (nextPreset: CameraPreset) => {
    setPreset(nextPreset);
    presetRef.current = nextPreset;
    const v = PRESET_VIEWS[nextPreset];
    _targetCamPos.set(...v.pos);
    _targetLookAt.set(...v.target);
    userNavigatingRef.current = false;
    cameraAnimatingRef.current = true;
  };

  useEffect(() => {
    if (resetNonce !== resetNonceRef.current) {
      resetNonceRef.current = resetNonce;
      setSelectedProject(null);
      applyPreset('ORBITAL');
    }
  }, [resetNonce]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
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
      });
    } catch {
      setWebglFallback(true);
      return;
    }

    const width = container.clientWidth || 720;
    const height = container.clientHeight || 460;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d13);
    scene.fog = new THREE.FogExp2(0x090d13, 0.042);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(...PRESET_VIEWS.ORBITAL.pos);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 13.5;
    controls.maxPolarAngle = Math.PI * 0.48;

    const handleControlStart = () => {
      userNavigatingRef.current = true;
      cameraAnimatingRef.current = false;
    };
    controls.addEventListener('start', handleControlStart);

    // 3-Point Studio Lighting Rig
    const hemi = new THREE.HemisphereLight(0x88b4c9, 0x0a0d12, 0.72);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x10b981, 1.6);
    rimLight.position.set(-6, 3, -5);
    scene.add(rimLight);

    const coreLight = new THREE.PointLight(0x10b981, 1.8, 10, 1.6);
    coreLight.position.set(0, 0.25, 0);
    scene.add(coreLight);

    // Materials
    const obsidianMat = new THREE.MeshPhysicalMaterial({
      color: 0x131922,
      metalness: 0.86,
      roughness: 0.26,
      clearcoat: 0.55,
    });
    const goldMat = new THREE.MeshPhysicalMaterial({
      color: 0xd4af37,
      metalness: 0.94,
      roughness: 0.18,
    });
    const emeraldMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      metalness: 0.5,
      roughness: 0.2,
      emissive: 0x059669,
      emissiveIntensity: 0.48,
    });
    const opticalGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x10b981,
      metalness: 0.1,
      roughness: 0.12,
      transmission: isSoftwareGl ? 0 : 0.72,
      ior: 1.48,
      thickness: 0.75,
      emissive: 0x047857,
      emissiveIntensity: 0.4,
    });
    const latticeMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    });
    const conduitMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x047857,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.35,
    });

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const gridTexture = createCommandGridTexture(maxAnisotropy);
    const floorMat = new THREE.MeshStandardMaterial({
      map: gridTexture,
      roughness: 0.62,
      metalness: 0.4,
    });

    // Ground Radar Disc
    const floorGeo = new THREE.CircleGeometry(5.2, 64);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -1.16;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Composite Multi-Part DSR Command Core Group
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    const baseGeo = new THREE.CylinderGeometry(1.75, 2.1, 0.26, 8);
    const baseMesh = new THREE.Mesh(baseGeo, obsidianMat);
    baseMesh.position.y = -0.98;
    baseMesh.receiveShadow = true;
    coreGroup.add(baseMesh);

    const collarGeo = new THREE.TorusGeometry(1.68, 0.036, 14, 64);
    const collarMesh = new THREE.Mesh(collarGeo, goldMat);
    collarMesh.rotation.x = Math.PI / 2;
    collarMesh.position.y = -0.82;
    coreGroup.add(collarMesh);

    const lathePoints = [
      new THREE.Vector2(0.01, -0.82),
      new THREE.Vector2(1.05, -0.78),
      new THREE.Vector2(1.22, -0.58),
      new THREE.Vector2(0.84, -0.45),
      new THREE.Vector2(0.01, -0.42),
    ];
    const housingGeo = new THREE.LatheGeometry(lathePoints, 24);
    const housingMesh = new THREE.Mesh(housingGeo, obsidianMat);
    coreGroup.add(housingMesh);

    const innerCoreGeo = new THREE.OctahedronGeometry(0.76, 0);
    const innerCore = new THREE.Mesh(innerCoreGeo, opticalGlassMat);
    innerCore.castShadow = true;
    coreGroup.add(innerCore);

    const shieldGeo = new THREE.IcosahedronGeometry(1.12, 1);
    const shieldMesh = new THREE.Mesh(shieldGeo, latticeMat);
    coreGroup.add(shieldMesh);

    const outerRingGeo = new THREE.TorusGeometry(1.64, 0.045, 16, 72);
    const outerRing = new THREE.Mesh(outerRingGeo, emeraldMat);
    outerRing.rotation.x = Math.PI * 0.32;
    coreGroup.add(outerRing);

    const innerRingGeo = new THREE.TorusGeometry(1.36, 0.032, 16, 72);
    const innerRing = new THREE.Mesh(innerRingGeo, goldMat);
    innerRing.rotation.y = Math.PI * 0.25;
    coreGroup.add(innerRing);

    const crownGeo = new THREE.CylinderGeometry(0.2, 0.38, 0.24, 6);
    const crownMesh = new THREE.Mesh(crownGeo, goldMat);
    crownMesh.position.y = 1.48;
    coreGroup.add(crownMesh);

    // 6 Curved Telemetry Conduits linking Core to Orbital Plane
    const conduitGeos: THREE.TubeGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(Math.cos(angle) * 0.9, -0.65, Math.sin(angle) * 0.9),
        new THREE.Vector3(Math.cos(angle) * 1.65, -0.95, Math.sin(angle) * 1.65),
        new THREE.Vector3(Math.cos(angle) * 2.45, -1.05, Math.sin(angle) * 2.45),
      ]);
      const cGeo = new THREE.TubeGeometry(curve, 18, 0.022, 8, false);
      conduitGeos.push(cGeo);
      coreGroup.add(new THREE.Mesh(cGeo, conduitMat));
    }

    // Raycastable Instanced Project Satellite Nodes (Layer 1)
    const maxNodes = 24;
    const nodeGeo = new THREE.OctahedronGeometry(0.19, 0);
    const nodeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.45,
      roughness: 0.22,
    });
    const instancedNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, maxNodes);
    instancedNodes.frustumCulled = false;
    instancedNodes.layers.set(1);
    camera.layers.enable(1);
    scene.add(instancedNodes);

    // Highlight halo ring around active/selected satellite
    const focusRingGeo = new THREE.TorusGeometry(0.32, 0.022, 12, 36);
    const focusRingMat = new THREE.MeshBasicMaterial({ color: 0xd4af37 });
    const focusRingMesh = new THREE.Mesh(focusRingGeo, focusRingMat);
    focusRingMesh.visible = false;
    scene.add(focusRingMesh);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const nodePositions: THREE.Vector3[] = Array.from({ length: maxNodes }, () => new THREE.Vector3());

    // Throttled pointer hover & click raycasting
    let lastHoverCheck = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const pickProjectAtClient = (clientX: number, clientY: number): { index: number; project: Project | null } => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return { index: -1, project: null };
      _pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      _raycaster.layers.set(1);
      _raycaster.setFromCamera(_pointer, camera);
      const hits = _raycaster.intersectObject(instancedNodes, false);
      if (hits.length > 0 && typeof hits[0].instanceId === 'number') {
        const idx = hits[0].instanceId;
        const proj = projectsRef.current[idx] || null;
        return { index: idx, project: proj };
      }
      return { index: -1, project: null };
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      const { project } = pickProjectAtClient(e.clientX, e.clientY);
      renderer.domElement.style.cursor = project ? 'pointer' : 'grab';
      setHoveredProject((prev) => (prev?.id === project?.id ? prev : project));
    };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 6) return; // Was an orbit drag, not a click
      const { index, project } = pickProjectAtClient(e.clientX, e.clientY);
      if (project && index >= 0) {
        setSelectedProject(project);
        const p = nodePositions[index];
        _targetLookAt.copy(p);
        _targetCamPos.set(p.x * 1.65 + 1.5, Math.max(1.2, p.y + 1.4), p.z * 1.65 + 1.5);
        userNavigatingRef.current = false;
        cameraAnimatingRef.current = true;
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointerup', handlePointerUp);

    let frameId = 0;
    let disposed = false;
    let contextLost = false;
    let explodeProgress = 0;
    let elapsedAccum = 0;
    const clock = new THREE.Clock();

    function updateNodes(elapsed: number, explodeVal: number) {
      const list = projectsRef.current;
      const count = Math.min(maxNodes, Math.max(list.length, 6));
      instancedNodes.count = count;
      let focusShown = false;

      for (let i = 0; i < count; i++) {
        const proj = list[i];
        const angle = (i / count) * Math.PI * 2 + elapsed * 0.18;
        const radius = 2.7 + (i % 3) * 0.48 + explodeVal * 0.72;
        const y = Math.sin(elapsed * 0.85 + i * 1.1) * 0.36 + (i % 2 === 0 ? 0.28 : -0.18);

        nodePositions[i].set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        _dummy.position.copy(nodePositions[i]);
        _dummy.rotation.set(elapsed * 0.65 + i, elapsed * 0.45, 0);

        const isActiveNode = Boolean(
          proj && (proj.id === selectedIdRef.current || proj.id === hoveredIdRef.current)
        );
        const baseScale = proj ? 0.85 + (proj.progress / 100) * 0.45 : 0.88;
        _dummy.scale.setScalar(isActiveNode ? baseScale * 1.38 : baseScale);
        _dummy.updateMatrix();
        instancedNodes.setMatrixAt(i, _dummy.matrix);

        if (proj && proj.id === selectedIdRef.current) {
          focusRingMesh.position.copy(nodePositions[i]);
          focusRingMesh.rotation.set(elapsed * 1.1, elapsed * 0.8, 0);
          focusRingMesh.visible = true;
          focusShown = true;
        }

        if (!proj) {
          _color.setHex(0x10b981);
        } else if (colorModeRef.current === 'PRIORITY') {
          if (proj.priority === 'CRITICAL') _color.setHex(0xef4444);
          else if (proj.priority === 'HIGH') _color.setHex(0xf59e0b);
          else if (proj.priority === 'MEDIUM') _color.setHex(0xd4af37);
          else _color.setHex(0x10b981);
        } else {
          if (proj.status === 'Completed') {
            _color.setHex(0x10b981);
          } else if (isDateOverdue(proj.expectedCompletionDate, false) || proj.priority === 'CRITICAL') {
            _color.setHex(0xf59e0b);
          } else if (proj.status === 'Under Review' || proj.status === 'On Hold') {
            _color.setHex(0xd4af37);
          } else {
            _color.setHex(0x34d399);
          }
        }
        instancedNodes.setColorAt(i, _color);
      }

      if (!focusShown) {
        focusRingMesh.visible = false;
      }

      instancedNodes.instanceMatrix.needsUpdate = true;
      if (instancedNodes.instanceColor) {
        instancedNodes.instanceColor.needsUpdate = true;
      }
    }

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
      if (!pausedRef.current) {
        elapsedAccum += delta;
      }

      if (cameraAnimatingRef.current && !userNavigatingRef.current) {
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 5, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 5, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 5, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetLookAt.x, 5, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetLookAt.y, 5, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetLookAt.z, 5, delta);
        if (
          camera.position.distanceTo(_targetCamPos) < 0.04 &&
          controls.target.distanceTo(_targetLookAt) < 0.04
        ) {
          cameraAnimatingRef.current = false;
        }
      }

      const targetExplode = explodedRef.current ? 1 : 0;
      explodeProgress = THREE.MathUtils.damp(explodeProgress, targetExplode, 6, delta);

      innerCore.rotation.y = elapsedAccum * 0.48;
      innerCore.rotation.x = Math.sin(elapsedAccum * 0.35) * 0.22;
      shieldMesh.rotation.y = -elapsedAccum * 0.24;
      outerRing.rotation.z = elapsedAccum * 0.3;
      innerRing.rotation.x = elapsedAccum * 0.38;
      crownMesh.position.y = 1.48 + explodeProgress * 0.7;
      baseMesh.position.y = -0.98 - explodeProgress * 0.38;
      collarMesh.position.y = -0.82 - explodeProgress * 0.34;
      shieldMesh.scale.setScalar(1 + explodeProgress * 0.24);

      updateNodes(elapsedAccum, explodeProgress);

      controls.update();
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
      const w = container.clientWidth || 720;
      const h = container.clientHeight || 460;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ResizeObserver ensures fullscreen transitions re-measure canvas cleanly
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => handleResize())
        : null;
    if (ro) ro.observe(container);

    return () => {
      disposed = true;
      ro?.disconnect();
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', handleControlStart);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointerup', handlePointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      controls.dispose();
      floorGeo.dispose();
      baseGeo.dispose();
      collarGeo.dispose();
      housingGeo.dispose();
      innerCoreGeo.dispose();
      shieldGeo.dispose();
      outerRingGeo.dispose();
      innerRingGeo.dispose();
      crownGeo.dispose();
      nodeGeo.dispose();
      focusRingGeo.dispose();
      conduitGeos.forEach((g) => g.dispose());
      gridTexture.dispose();
      floorMat.dispose();
      obsidianMat.dispose();
      goldMat.dispose();
      emeraldMat.dispose();
      opticalGlassMat.dispose();
      latticeMat.dispose();
      conduitMat.dispose();
      nodeMat.dispose();
      focusRingMat.dispose();
      envTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const inspected = selectedProject || hoveredProject;

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-4 z-50 flex flex-col rounded-2xl overflow-hidden border border-emerald-500/30 bg-[#090D13] shadow-2xl'
          : 'relative rounded-xl overflow-hidden border border-white/10 bg-[#090D13]'
      }
    >
      {/* Header Bar outside canvas */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 bg-[#0E131B]">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-100 truncate">
            Enterprise 3D Project Topology
          </h3>
          <p className="text-xs text-gray-400 truncate">
            Orbit, zoom, or click any satellite node · {projects.length} active telemetry engagements
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            title={fullscreen ? 'Exit Expanded View' : 'Expand 3D View'}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{fullscreen ? 'Exit Full' : 'Expand'}</span>
          </button>
          <button
            type="button"
            onClick={() => setControlsVisible((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{controlsVisible ? 'Zen Mode' : 'Show Dock'}</span>
          </button>
        </div>
      </div>

      {/* Dedicated WebGL Canvas Container */}
      <div className={`relative w-full ${fullscreen ? 'flex-1 min-h-0' : heightClass}`}>
        {webglFallback ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#090D13]">
            <p className="text-sm font-semibold text-gray-200">
              3D Hardware Context Unavailable
            </p>
            <p className="text-xs text-gray-400 mt-1 max-w-md">
              Rendering fallback summary for {projects.length} enterprise projects.
            </p>
          </div>
        ) : (
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        )}

        {/* Solid opaque collapsible bottom control dock (NO backdrop-filter over WebGL) */}
        {controlsVisible && !webglFallback && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 max-w-[95%]"
            style={{ backgroundColor: 'rgba(11, 15, 22, 0.94)' }}
          >
            <div className="flex items-center gap-1 pr-2 border-r border-white/10">
              <Camera className="w-3.5 h-3.5 text-emerald-400 mr-0.5 hidden sm:inline" />
              {(['ORBITAL', 'TOP_RADAR', 'CORE_FOCUS'] as CameraPreset[]).map((pKey) => (
                <button
                  key={pKey}
                  type="button"
                  onClick={() => applyPreset(pKey)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                    preset === pKey
                      ? 'bg-emerald-500 text-gray-950 font-semibold'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {pKey === 'ORBITAL' ? 'Orbital' : pKey === 'TOP_RADAR' ? 'Top Radar' : 'Core Focus'}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setColorMode((m) => (m === 'STATUS' ? 'PRIORITY' : 'STATUS'))}
              className="px-2 py-1 rounded text-[11px] font-medium text-amber-300 hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Color: {colorMode === 'STATUS' ? 'Status' : 'Priority'}
            </button>

            <button
              type="button"
              onClick={() => setExploded((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                exploded
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Layers className="w-3 h-3" />
              {exploded ? 'Assemble' : 'Explode'}
            </button>

            <button
              type="button"
              onClick={() => setPaused((v) => !v)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            <button
              type="button"
              onClick={() => setResetNonce((n) => n + 1)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-gray-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Selected / Hovered Telemetry Bar cleanly below canvas */}
      <div className="px-4 py-2.5 border-t border-white/8 bg-[#0C1017] flex flex-wrap items-center justify-between gap-3 text-xs">
        {inspected ? (
          <>
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <span className="font-mono text-emerald-400 font-semibold">{inspected.projectCode}</span>
              <span className="font-semibold text-white truncate">{inspected.projectName}</span>
              <span className="text-gray-400 hidden sm:inline">· {inspected.clientName}</span>
            </div>
            <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums">
              <span className="text-amber-300">{inspected.status}</span>
              <span className="text-emerald-400">{inspected.progress}%</span>
              <span className="text-gray-300 hidden md:inline">{formatCurrency(inspected.budget)}</span>
              {selectedProject && onInspectProject && (
                <button
                  type="button"
                  onClick={() => onInspectProject(selectedProject)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-sans font-semibold transition-colors"
                >
                  Open Project <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between w-full text-gray-400">
            <span>Hover or click any orbiting telemetry satellite to inspect project metrics.</span>
            <span className="font-mono text-[11px] text-gray-500 hidden sm:inline">
              Emerald: Nominal · Gold: Review/Hold · Amber/Red: Critical/Overdue
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
