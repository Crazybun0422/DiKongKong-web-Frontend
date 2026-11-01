// Photograph-derived Mini 4 Pro camera and three-axis gimbal.
// Design units: millimetres. +Y up, +Z forward. Parent applies the metre scale.
// Sources: reference/highres/sensors.jpg and product-original.png.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const V = (...coordinates) => new THREE.Vector3(...coordinates);

function part(parent, name, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(...position);
  parent.add(object);
  return object;
}

function roundedBox(parent, name, size, position, material, radius = .6) {
  return part(parent, name, new RoundedBoxGeometry(...size, Math.max(...size) < 2 ? 1 : 3, Math.min(radius, ...size.map(n => n * .45))), material, position);
}

function cylinder(parent, name, radius, length, position, material, axis = [0, 0, 1], backRadius = radius) {
  const object = part(parent, name, new THREE.CylinderGeometry(radius, backRadius, length, 48, 1), material, position);
  object.quaternion.setFromUnitVectors(V(0, 1, 0), V(...axis).normalize());
  return object;
}

function torus(parent, name, radius, thickness, position, material, axis = [0, 0, 1]) {
  const object = part(parent, name, new THREE.TorusGeometry(radius, thickness, 8, 64), material, position);
  object.quaternion.setFromUnitVectors(V(0, 0, 1), V(...axis).normalize());
  return object;
}

function roundRectangle(width, height, radius, segments = 12) {
  const r = Math.min(radius, width * .499, height * .499);
  const centers = [[width / 2 - r, height / 2 - r], [-width / 2 + r, height / 2 - r], [-width / 2 + r, -height / 2 + r], [width / 2 - r, -height / 2 + r]];
  const points = [];
  centers.forEach(([cx, cy], corner) => {
    for (let step = 0; step <= segments; step++) {
      const angle = (corner + step / segments) * Math.PI / 2;
      points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
    }
  });
  return points;
}

// Each section is [z, width, height, corner radius, centre Y].
// A closed profile sequence makes an annular solid with a real open centre.
function contourLoft(sections, { caps = false, segments = 12 } = {}) {
  const positions = [], uv = [], indices = [];
  const count = 4 * (segments + 1), stride = count + 1;
  sections.forEach(([z, width, height, radius, centerY = 0], row) => {
    const contour = roundRectangle(width, height, radius, segments);
    for (let index = 0; index <= count; index++) {
      const [x, y] = contour[index % count];
      positions.push(x, y + centerY, z);
      uv.push(index / count, row / (sections.length - 1));
    }
  });
  for (let row = 0; row < sections.length - 1; row++) for (let index = 0; index < count; index++) {
    const a = row * stride + index, b = a + 1, c = b + stride, d = a + stride;
    indices.push(a, b, c, a, c, d);
  }
  if (caps) for (const row of [0, sections.length - 1]) {
    const centre = positions.length / 3;
    positions.push(0, sections[row][4] || 0, sections[row][0]);
    uv.push(.5, row === 0 ? 0 : 1);
    for (let index = 0; index < count; index++) {
      const a = row * stride + index, b = a + 1;
      if (row === 0) indices.push(centre, b, a);
      else indices.push(centre, a, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (let row = 0; row < sections.length; row++) {
    const first = row * stride, last = first + count;
    const normal = V().fromBufferAttribute(normals, first).add(V().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z);
    normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  return geometry;
}

function contourLine(parent, name, width, height, radius, z, centerY, thickness, material) {
  const points = roundRectangle(width, height, radius, 14).map(([x, y]) => V(x, y + centerY, z));
  points.push(points[0].clone());
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return part(parent, name, new THREE.TubeGeometry(curve, 160, thickness, 6, false), material);
}

function extrudedShape(parent, name, shape, depth, material, position, bevel = .32) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 20 });
  return part(parent, name, geometry, material, position);
}

function sphericalElement(radius, sag = .34) {
  const radial = 64, rings = 14, vertices = [0, 0, sag], uv = [.5, .5], indices = [];
  for (let row = 1; row <= rings; row++) {
    const t = row / rings;
    for (let step = 0; step <= radial; step++) {
      const angle = step / radial * TAU;
      vertices.push(Math.cos(angle) * radius * t, Math.sin(angle) * radius * t, sag * (1 - t * t));
      uv.push(.5 + Math.cos(angle) * t / 2, .5 + Math.sin(angle) * t / 2);
    }
  }
  for (let step = 0; step < radial; step++) indices.push(0, 1 + step, 2 + step);
  for (let row = 0; row < rings - 1; row++) for (let step = 0; step < radial; step++) {
    const a = 1 + row * (radial + 1) + step, b = a + radial + 1;
    indices.push(a, b, b + 1, a, b + 1, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function fastener(parent, name, position, normal, M, radius = .55) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  group.quaternion.setFromUnitVectors(V(0, 0, 1), V(...normal).normalize());
  parent.add(group);
  cylinder(group, 'Recessed fastener seat', radius * 1.22, .18, [0, 0, -.06], M.inner);
  cylinder(group, 'Dark machined fastener', radius, .15, [0, 0, .06], M.blackMetal);
  torus(group, 'Fastener turned edge', radius * .86, .032, [0, 0, .15], M.metal);
  for (const angle of [0, Math.PI / 3, Math.PI * 2 / 3]) {
    const groove = roundedBox(group, 'Six point drive recess', [radius * 1.18, radius * .19, .035], [0, 0, .151], M.inner, .04);
    groove.rotation.z = angle;
  }
  return group;
}

function cableRibbon(parent, name, points, width, material, side = [1, 0, 0]) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => V(...p)));
  const vertices = [], uv = [], indices = [];
  for (let step = 0; step <= 40; step++) {
    const t = step / 40, point = curve.getPoint(t), tangent = curve.getTangent(t);
    const across = V(...side).addScaledVector(tangent, -V(...side).dot(tangent)).normalize();
    for (const sign of [-1, 1]) vertices.push(...point.clone().addScaledVector(across, sign * width / 2).toArray());
    uv.push(0, t, 1, t);
    if (step < 40) { const a = step * 2; indices.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const ribbonMaterial = material.clone();
  ribbonMaterial.name = 'Flexible gimbal circuit cover';
  ribbonMaterial.side = THREE.DoubleSide;
  return part(parent, name, geometry, ribbonMaterial);
}

function smallInscription(camera) {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#a0a5a0';
  context.font = '500 76px Arial';
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillText('E24  F1.7', 256, 65);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.name = 'Camera focal length and aperture engraving';
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .66, map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  part(camera, 'Fine filter rim inscription', new THREE.PlaneGeometry(8.9, 1.65), material, [-3.1, 8.65, 13.42]);
}

export function createDetailedGimbal(M) {
  const gimbal = new THREE.Group();
  gimbal.name = 'Gimbal';
  gimbal.userData = { reconstruction: 'DJI Mini 4 Pro official closeup', designUnits: 'mm', cameraCenter: [0, 56, 62] };

  // A shallow isolation cradle sits inside the nose cavity, leaving the camera open.
  const mountShape = new THREE.Shape(roundRectangle(21, 10.5, 3).map(([x, y]) => new THREE.Vector2(x, y)));
  const mount = extrudedShape(gimbal, 'Recessed vibration isolation bridge', mountShape, 1.8, M.dark, [0, 68.5, 46.3], .5);
  mount.rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    cylinder(gimbal, 'Elastomer isolation bushing ' + side, 2, 2.1, [side * 8.1, 68.7, 46.3], M.rubber, [0, 1, 0]);
    fastener(gimbal, 'Isolation bridge fastener ' + side, [side * 8.1, 67.5, 46.3], [0, -1, 0], M, .6);
  }
  cylinder(gimbal, 'Upper yaw motor housing', 5.35, 4.5, [0, 64.7, 46.4], M.blackMetal, [0, 1, 0], 4.9);
  torus(gimbal, 'Yaw housing parting seam', 5.17, .1, [0, 64.8, 46.4], M.seam, [0, 1, 0]);
  cylinder(gimbal, 'Lower yaw bearing face', 4.48, .4, [0, 62.3, 46.4], M.metal, [0, 1, 0]);

  // Curved cast bridge: its section is drawn in the side plane and extruded across X.
  const rearArmShape = new THREE.Shape();
  rearArmShape.moveTo(-1.7, 7.4); rearArmShape.lineTo(2.4, 7.4);
  rearArmShape.quadraticCurveTo(3.7, 5.2, 2.7, 2.8);
  rearArmShape.lineTo(2.2, -2); rearArmShape.quadraticCurveTo(.2, -4.5, -2.3, -3);
  rearArmShape.lineTo(-2.3, -.5); rearArmShape.quadraticCurveTo(.7, 1.3, -.4, 3.9); rearArmShape.closePath();
  const rearArm = extrudedShape(gimbal, 'Swept yaw to roll bridge', rearArmShape, 3.8, M.metal, [-1.9, 56.3, 47.8], .35);
  rearArm.rotation.y = Math.PI / 2;
  cylinder(gimbal, 'Rear roll motor body', 6.25, 3.2, [0, 56.2, 47.8], M.blackMetal);
  cylinder(gimbal, 'Rear roll bearing cover', 5.2, .45, [0, 56.2, 49.6], M.metal);
  torus(gimbal, 'Roll motor concentric seam', 5.8, .1, [0, 56.2, 49.38], M.seam);
  for (const angle of [Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4]) {
    fastener(gimbal, 'Roll cover fastener', [Math.cos(angle) * 4.25, 56.2 + Math.sin(angle) * 4.25, 49.94], [0, 0, 1], M, .42);
  }

  // One continuous, bevelled U-yoke carries both pitch bearings; it is open in the middle.
  const yokeShape = new THREE.Shape();
  yokeShape.moveTo(-16.15, 2.5); yokeShape.lineTo(-16.15, -3.7);
  yokeShape.bezierCurveTo(-16.15, -9.6, -13.4, -12.1, -8.2, -12.1);
  yokeShape.lineTo(8.2, -12.1); yokeShape.bezierCurveTo(13.4, -12.1, 16.15, -9.6, 16.15, -3.7);
  yokeShape.lineTo(16.15, 2.5); yokeShape.quadraticCurveTo(15, 3.5, 13.5, 2.5);
  yokeShape.lineTo(13.5, -3.8); yokeShape.bezierCurveTo(13.5, -7.7, 11.4, -9.5, 7.8, -9.5);
  yokeShape.lineTo(-7.8, -9.5); yokeShape.bezierCurveTo(-11.4, -9.5, -13.5, -7.7, -13.5, -3.8);
  yokeShape.lineTo(-13.5, 2.5); yokeShape.quadraticCurveTo(-15, 3.5, -16.15, 2.5); yokeShape.closePath();
  extrudedShape(gimbal, 'Continuous curved pitch yoke', yokeShape, 2.1, M.metal, [0, 56.2, 55.2], .42);
  cylinder(gimbal, 'Yoke rear roll coupling', 4.1, 5.7, [0, 49.4, 52.6], M.blackMetal);
  for (const side of [-1, 1]) {
    cylinder(gimbal, 'Pitch motor shell ' + side, 4.9, 3.3, [side * 14.05, 56.2, 60.1], M.blackMetal, [side, 0, 0], 4.5);
    cylinder(gimbal, 'Pitch motor tapered cheek ' + side, 4.3, .6, [side * 15.95, 56.2, 60.1], M.metal, [side, 0, 0], 4.75);
    torus(gimbal, 'Pitch bearing fine seam ' + side, 4.42, .085, [side * 15.62, 56.2, 60.1], M.seam, [side, 0, 0]);
    cylinder(gimbal, 'Pitch axis dust seal ' + side, 3.6, .25, [side * 12.22, 56.2, 60.1], M.rubber, [side, 0, 0]);
    fastener(gimbal, 'Pitch bearing recessed screw ' + side, [side * 16.32, 56.2, 60.1], [side, 0, 0], M, .65);
    cableRibbon(gimbal, 'Folded pitch flex cable ' + side, [[side * 7.4, 65.7, 45.3], [side * 11.7, 63.2, 48.8], [side * 13.2, 59.6, 53], [side * 12.8, 54.8, 54], [side * 11.7, 52.2, 56.6]], 1.5, M.rubber);
  }

  const camera = new THREE.Group();
  camera.name = 'Camera';
  camera.position.set(0, 56, 62);
  camera.userData = { bodyWidthMM: 24, bodyHeightMM: 21, totalDepthMM: 24.8 };
  gimbal.add(camera);

  // Smooth tapered, rounded rectangular shell; no cuboid core or giant circular lens barrel.
  part(camera, 'Continuous tapered camera shell', contourLoft([
    [-11.4, 17.6, 15.6, 5.4], [-11.1, 18.7, 16.8, 5.5], [-10.3, 20.3, 18.2, 5.6],
    [-8.6, 22.1, 19.6, 5.5], [-6.3, 23.55, 20.7, 5.2], [-3.1, 24, 21, 5.1],
    [3.5, 24, 21, 4.9], [7.7, 23.85, 20.9, 5.1], [9.7, 23.4, 20.6, 5.35], [10.75, 22.9, 20, 5.45],
  ], { caps: true }), M.dark);

  // Filter shoe: a single hollow annular loft from the outer wall to the recessed square throat.
  const frameProfile = [
    [10.5, 23.0, 20.3, 5.3], [11.2, 23.8, 21.0, 5.55], [12.6, 24.0, 21.0, 5.7],
    [13.15, 23.8, 20.8, 5.65], [13.38, 23.3, 20.3, 5.45],
    [13.38, 19.35, 16.8, 5.15, -.55], [13.12, 18.8, 16.25, 5.05, -.55],
    [11.2, 13.5, 11.7, 4.25, -.55], [10.5, 13.5, 11.7, 4.25, -.55], [10.5, 23.0, 20.3, 5.3],
  ];
  part(camera, 'Hollow rounded square filter shoe', contourLoft(frameProfile), M.blackMetal);
  contourLine(camera, 'Outer filter seam', 23.45, 20.5, 5.5, 11.3, 0, .095, M.seam);
  contourLine(camera, 'Fine satin filter leading edge', 23.5, 20.5, 5.5, 13.3, 0, .065, M.metal);

  // Nested rounded-square machining catches light along the real recessed filter opening.
  for (let step = 0; step < 7; step++) {
    contourLine(camera, 'Concentric square filter groove ' + step, 18.7 - step * .79, 16.15 - step * .68, 5.02 - step * .115, 13.05 - step * .245, -.55, .075, step % 2 ? M.inner : M.metal);
  }
  const aperture = new THREE.Shape(roundRectangle(13.8, 12.05, 4.3).map(([x, y]) => new THREE.Vector2(x, y - .55)));
  part(camera, 'Recessed optical chamber', new THREE.ShapeGeometry(aperture, 24), M.inner, [0, 0, 11.22]);
  cylinder(camera, 'Small optical barrel shoulder', 5.02, .38, [0, -.7, 11.46], M.blackMetal);
  torus(camera, 'Optical retaining ring', 4.8, .105, [0, -.7, 11.72], M.metal);
  torus(camera, 'Inner antireflection lip', 4.51, .12, [0, -.7, 11.83], M.inner);
  cylinder(camera, 'Deep objective entrance pupil', 4.39, .1, [0, -.7, 11.61], M.inner);
  const secondaryCoating = M.glass.clone();
  secondaryCoating.name = 'Internal green multicoated objective surface';
  secondaryCoating.color.set('#163c35');
  secondaryCoating.roughness = .15;
  cylinder(camera, 'Recessed multicoated objective cell', 3.57, .08, [0, -.7, 11.7], secondaryCoating);
  cylinder(camera, 'Small internal entrance pupil', 2.57, .06, [0, -.7, 11.78], M.inner);
  torus(camera, 'Internal objective retaining cell', 2.78, .065, [0, -.7, 11.77], M.blackMetal);
  const frontCoating = M.glass.clone();
  frontCoating.name = 'Translucent aspherical optical coating';
  frontCoating.transparent = true;
  frontCoating.opacity = .61;
  frontCoating.depthWrite = false;
  frontCoating.roughness = .065;
  if (frontCoating.isMeshPhysicalMaterial) { frontCoating.transmission = .12; frontCoating.thickness = .26; }
  part(camera, 'Small aspherical coated front element', sphericalElement(4.36, .39), frontCoating, [0, -.7, 11.84]);
  smallInscription(camera);

  // Side recesses and curved fins follow the tapered housing, rather than floating box grilles.
  for (const side of [-1, 1]) {
    const panelShape = new THREE.Shape(roundRectangle(10.6, 12.5, 2.15).map(([x, y]) => new THREE.Vector2(x, y)));
    const panel = part(camera, 'Recessed lateral heat sink ' + side, new THREE.ShapeGeometry(panelShape, 20), M.inner, [side * 11.98, .65, .3]);
    panel.rotation.y = side * Math.PI / 2;
    for (let row = 0; row < 8; row++) {
      const y = 5.65 - row * 1.43;
      const path = new THREE.CatmullRomCurve3([
        V(side * 11.82, y, -4.6), V(side * 12.06, y + .08, -2.7), V(side * 12.17, y + .08, 1.3), V(side * 11.97, y - .08, 5.0),
      ]);
      part(camera, 'Rounded lateral cooling fin ' + side + '-' + row, new THREE.TubeGeometry(path, 24, .27, 8, false), M.dark);
    }
    const sideSeam = new THREE.CatmullRomCurve3([V(side * 8.8, -6.2, -10.65), V(side * 10.7, -7.8, -7), V(side * 11.1, -8.2, -.8), V(side * 10.8, -8.15, 5.9)]);
    part(camera, 'Camera moulding perimeter joint ' + side, new THREE.TubeGeometry(sideSeam, 32, .085, 6, false), M.seam);
    fastener(camera, 'Lower camera casing screw ' + side, [side * 6.2, -8.4, -7.1], [0, -1, -.24], M, .38);
  }
  contourLine(camera, 'Rear camera service lid seam', 17.7, 15.7, 5.35, -11.29, 0, .08, M.seam);
  for (const side of [-1, 1]) fastener(camera, 'Rear camera service fastener ' + side, [side * 5.4, 4.5, -11.45], [0, 0, -1], M, .42);

  return gimbal;
}
