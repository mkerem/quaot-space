import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

// Mirrors the fixed getCategoryAtMouse: raycast label sprite quads instead
// of a 0.25-NDC radius around their centers.
function categoryAt(ndc, camera, labelsGroup) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(labelsGroup.children, false);
  return hits.length > 0 ? hits[0].object.userData.categoryId : null;
}

describe('label sprite raycasting', () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 0, 80);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  const labelsGroup = new THREE.Group();
  const label = new THREE.Sprite(new THREE.SpriteMaterial());
  label.position.set(-40, 55, 0); // wisdom cluster label (y+25)
  label.scale.set(30, 7.5, 1);    // mid-size label
  label.userData = { categoryId: 'wisdom' };
  labelsGroup.add(label);
  labelsGroup.updateMatrixWorld(true);

  const ndcOf = (pos) => {
    const p = pos.clone().project(camera);
    return new THREE.Vector2(p.x, p.y);
  };

  it('hits a tap on the label quad', () => {
    expect(categoryAt(ndcOf(label.position), camera, labelsGroup)).toBe('wisdom');
  });

  it('misses a star 10 world units below the label (old 0.25-NDC zone caught it)', () => {
    const nearStar = new THREE.Vector3(-40, 45, 0);
    expect(categoryAt(ndcOf(nearStar), camera, labelsGroup)).toBe(null);
  });
});
