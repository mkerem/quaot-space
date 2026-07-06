import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('test harness', () => {
  it('imports three and does vector math headlessly', () => {
    const v = new THREE.Vector3(3, 4, 0);
    expect(v.length()).toBe(5);
  });
});
