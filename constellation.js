// Three.js Constellation Visualization
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { categories } from './categories.js';
import { computeStarOpacity, computeStarScale, routeClick, isTap } from './constellation-helpers.js';

export class Constellation {
  constructor(container, onQuoteSelect, onQuoteHover, onCategoryHover) {
    this.container = container;
    this.onQuoteSelect = onQuoteSelect;
    this.onQuoteHover = onQuoteHover;
    this.onCategoryHover = onCategoryHover;

    this.quotes = [];
    this.positions = {};
    this.embeddings = {};
    this.stars = new Map(); // quoteId -> mesh
    this.categoryLabels = new Map(); // categoryId -> sprite
    this.connectionLines = [];
    this.contradictionLines = [];
    this.contradictionMode = false;

    this.hoveredStar = null;
    this.selectedStar = null;
    this.focusedCategory = null; // Currently focused category

    this.init();
  }

  init() {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.z = 80;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.container,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 1.2;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 200;

    // Raycaster for interaction
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 1;
    this.mouse = new THREE.Vector2();

    // Groups
    this.starsGroup = new THREE.Group();
    this.linesGroup = new THREE.Group();
    this.contradictionGroup = new THREE.Group();
    this.labelsGroup = new THREE.Group();
    this.scene.add(this.starsGroup);
    this.scene.add(this.linesGroup);
    this.scene.add(this.contradictionGroup);
    this.scene.add(this.labelsGroup);
    this.contradictionGroup.visible = false;

    // Event listeners
    window.addEventListener('resize', () => this.onResize());
    this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.container.addEventListener('pointerdown', (e) => {
      this.pointerDownAt = { x: e.clientX, y: e.clientY };
    });
    this.container.addEventListener('click', (e) => this.onClick(e));

    // Animation time
    this.clock = new THREE.Clock();

    // Start animation loop
    this.animate();
  }

  // Create a star mesh for a quote
  createStar(quote, position) {
    // Star brightness varies with quote length
    const brightness = Math.min(0.5 + quote.text.length / 500, 1);
    const size = 0.8 + brightness * 0.4;

    // Get category color
    const category = categories[quote.category];
    const categoryColor = category ? new THREE.Color(category.color) : new THREE.Color(0x88aaff);

    // Create glow sprite with category color
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.createGlowTexture(),
      color: categoryColor,
      transparent: true,
      opacity: 0.6 * brightness,
      blending: THREE.AdditiveBlending
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(size * 4, size * 4, 1);
    sprite.userData.baseOpacity = 0.6 * brightness;

    // Core point with category tint
    const coreGeometry = new THREE.SphereGeometry(size * 0.3, 16, 16);
    const coreColor = categoryColor.clone().lerp(new THREE.Color(1, 1, 1), 0.7);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.userData.baseOpacity = 0.9;

    // Group star elements; children stay at the group origin so animate()
    // can float the group without double-counting the position.
    const group = new THREE.Group();
    group.add(sprite);
    group.add(core);
    group.position.set(position.x, position.y, position.z);
    group.userData = { quote, originalPosition: position, introScale: 1 };

    return group;
  }

  // Create text label for a category
  // count = number of quotes in this category, maxCount = largest category size
  createCategoryLabel(categoryId, category, count = 5, maxCount = 10) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;

    // Calculate size and brightness based on count
    // Normalize: smallest gets ~0.4, largest gets 1.0
    const normalizedSize = 0.4 + (count / maxCount) * 0.6;
    const fontSize = Math.floor(28 + normalizedSize * 20); // 28-48px
    const brightness = Math.floor(150 + normalizedSize * 105); // 150-255

    // Draw text
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px "Crimson Text", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // White/gray based on cluster size (bigger = brighter)
    ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.9)`;
    ctx.fillText(category.name, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.5 + normalizedSize * 0.4 // 0.5-0.9 opacity
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    // Scale based on size
    const scale = 25 + normalizedSize * 15; // 25-40
    sprite.scale.set(scale, scale * 0.25, 1);
    sprite.position.set(
      category.position.x,
      category.position.y + 25,
      category.position.z
    );
    sprite.userData = { categoryId, category, count, baseOpacity: 0.5 + normalizedSize * 0.4 };

    return sprite;
  }

  // Create glow texture
  createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(200, 220, 255, 0.8)');
    gradient.addColorStop(0.5, 'rgba(150, 180, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(100, 150, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  // Update constellation with new data
  updateConstellation(quotes, positions, embeddings) {
    this.quotes = quotes;
    this.positions = positions;
    this.embeddings = embeddings;

    // Clear existing stars
    while (this.starsGroup.children.length > 0) {
      this.starsGroup.remove(this.starsGroup.children[0]);
    }
    this.stars.clear();

    // Clear existing category labels
    this.categoryLabels.forEach((label) => {
      this.labelsGroup.remove(label);
    });
    this.categoryLabels.clear();

    // Reset focused category
    this.focusedCategory = null;

    // Count quotes per category
    const categoryCounts = {};
    for (const quote of quotes) {
      const cat = quote.category || 'wisdom';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(categoryCounts), 1);

    // Create stars for each quote
    for (const quote of quotes) {
      const position = positions[quote.id];
      if (!position) continue;

      const star = this.createStar(quote, position);
      this.starsGroup.add(star);
      this.stars.set(quote.id, star);
    }

    // Create category labels with size based on quote count
    for (const [categoryId, category] of Object.entries(categories)) {
      const count = categoryCounts[categoryId] || 0;
      const label = this.createCategoryLabel(categoryId, category, count, maxCount);
      this.labelsGroup.add(label);
      this.categoryLabels.set(categoryId, label);
    }

    // Clear connection lines
    this.clearConnectionLines();
  }

  // Add a single star to the constellation
  addStar(quote, position) {
    this.quotes.push(quote);
    this.positions[quote.id] = position;

    const star = this.createStar(quote, position);
    this.starsGroup.add(star);
    this.stars.set(quote.id, star);

    // Animate the star appearing
    this.animateStarIn(star);

    return star;
  }

  // Animate star appearing (writes introScale; animate() applies it)
  animateStarIn(star) {
    const startTime = this.clock.getElapsedTime();
    const duration = 0.8;
    star.userData.introScale = 0;

    const animate = () => {
      const elapsed = this.clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 2);
      star.userData.introScale = eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        star.userData.introScale = 1;
      }
    };

    animate();
  }

  // Show connection lines to nearest neighbors
  showConnections(quoteId, neighbors) {
    this.clearConnectionLines();

    const sourceStar = this.stars.get(quoteId);
    if (!sourceStar) return;

    const sourcePos = sourceStar.userData.originalPosition;
    if (!sourcePos) return;

    for (const neighbor of neighbors) {
      const targetStar = this.stars.get(neighbor.id);
      if (!targetStar) continue;

      const targetPos = targetStar.userData.originalPosition;
      if (!targetPos) continue;

      const points = [
        new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z),
        new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z)
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0x6699ff,
        transparent: true,
        opacity: 0.6
      });

      const line = new THREE.Line(geometry, material);
      this.linesGroup.add(line);
      this.connectionLines.push(line);
    }
  }

  // Clear connection lines
  clearConnectionLines() {
    for (const line of this.connectionLines) {
      this.linesGroup.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.connectionLines = [];
  }

  // Show contradiction lines
  showContradictions(contradictionPairs) {
    this.clearContradictions();

    for (const pair of contradictionPairs) {
      const star1 = this.stars.get(pair.quote1.id);
      const star2 = this.stars.get(pair.quote2.id);

      if (!star1 || !star2) continue;

      // Get positions from userData (the actual positions)
      const pos1 = star1.userData.originalPosition;
      const pos2 = star2.userData.originalPosition;

      if (!pos1 || !pos2) continue;

      const points = [
        new THREE.Vector3(pos1.x, pos1.y, pos1.z),
        new THREE.Vector3(pos2.x, pos2.y, pos2.z)
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: 0xff5555,
        transparent: true,
        opacity: 0.7,
        linewidth: 2
      });

      const line = new THREE.Line(geometry, material);
      this.contradictionGroup.add(line);
      this.contradictionLines.push(line);
    }
  }

  // Clear contradiction lines
  clearContradictions() {
    for (const line of this.contradictionLines) {
      this.contradictionGroup.remove(line);
      line.geometry.dispose();
      line.material.dispose();
    }
    this.contradictionLines = [];
  }

  // Toggle contradiction mode (opacity is derived per-frame in animate())
  setContradictionMode(enabled) {
    this.contradictionMode = enabled;
    this.contradictionGroup.visible = enabled;
  }

  // Focus camera on a specific star
  focusOnStar(quoteId) {
    const star = this.stars.get(quoteId);
    if (!star) return;

    const targetPosition = star.position.clone();

    // Animate camera to look at the star
    const startPosition = this.controls.target.clone();
    const startTime = this.clock.getElapsedTime();
    const duration = 0.6;

    const animateFocus = () => {
      const elapsed = this.clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing
      const eased = 1 - Math.pow(1 - progress, 3);

      this.controls.target.lerpVectors(startPosition, targetPosition, eased);

      if (progress < 1) {
        requestAnimationFrame(animateFocus);
      }
    };

    animateFocus();
    this.selectedStar = star;
  }

  // Get quote at mouse position
  getQuoteAtMouse() {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.starsGroup.children, true);

    if (intersects.length > 0) {
      // Find the parent group
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.quote) {
        obj = obj.parent;
      }
      return obj.userData?.quote || null;
    }

    return null;
  }

  // Get category label at mouse position (raycasts the actual label quad;
  // the old hand-rolled 0.25-NDC radius swallowed taps on nearby stars)
  getCategoryAtMouse() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.labelsGroup.children, false);
    return hits.length > 0 ? hits[0].object.userData.categoryId : null;
  }

  // Focus on a category - highlight its quotes and zoom in
  focusOnCategory(categoryId) {
    const category = categories[categoryId];
    if (!category) return;

    this.focusedCategory = categoryId;

    // Zoom camera to category center
    const targetPosition = new THREE.Vector3(
      category.position.x,
      category.position.y,
      category.position.z
    );

    const startTarget = this.controls.target.clone();
    const startCamPos = this.camera.position.clone();

    // Calculate new camera position (closer to cluster)
    const direction = new THREE.Vector3().subVectors(startCamPos, startTarget).normalize();
    const newCamPos = targetPosition.clone().add(direction.multiplyScalar(50));

    const startTime = this.clock.getElapsedTime();
    const duration = 0.8;

    const animateZoom = () => {
      const elapsed = this.clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Smooth easing
      const eased = 1 - Math.pow(1 - progress, 3);

      this.controls.target.lerpVectors(startTarget, targetPosition, eased);
      this.camera.position.lerpVectors(startCamPos, newCamPos, eased);

      if (progress < 1) {
        requestAnimationFrame(animateZoom);
      }
    };

    animateZoom();
  }

  // Unfocus category - stars and labels restore via derived state
  unfocusCategory() {
    this.focusedCategory = null;
  }

  // Event handlers
  setMouseFromEvent(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  onMouseMove(event) {
    this.setMouseFromEvent(event);

    // Check for category label hover
    const categoryId = this.getCategoryAtMouse();
    if (categoryId) {
      this.container.style.cursor = 'pointer';
      return;
    }

    const quote = this.getQuoteAtMouse();

    if (quote && quote !== this.hoveredStar?.userData?.quote) {
      // New hover
      this.hoveredStar = this.stars.get(quote.id);
      this.onQuoteHover?.(quote);
      this.container.style.cursor = 'pointer';
    } else if (!quote && this.hoveredStar) {
      // End hover
      this.hoveredStar = null;
      this.onQuoteHover?.(null);
      this.container.style.cursor = 'grab';
    } else if (!quote) {
      this.container.style.cursor = 'grab';
    }
  }

  onClick(event) {
    // Ignore click events that conclude an orbit drag
    if (this.pointerDownAt && !isTap(this.pointerDownAt.x, this.pointerDownAt.y, event.clientX, event.clientY)) {
      return;
    }
    this.setMouseFromEvent(event);

    const route = routeClick({
      quote: this.getQuoteAtMouse(),
      categoryId: this.getCategoryAtMouse(),
      focusedCategory: this.focusedCategory
    });

    switch (route.action) {
      case 'selectQuote':
        if (route.alsoFocusStar) {
          this.focusOnStar(route.quote.id);
        }
        this.onQuoteSelect?.(route.quote);
        break;
      case 'focusCategory':
        this.focusOnCategory(route.categoryId);
        break;
      case 'unfocusCategory':
        this.unfocusCategory();
        break;
    }
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Animation loop
  animate() {
    requestAnimationFrame(() => this.animate());

    const time = this.clock.getElapsedTime();

    // Float, pulse, and derive opacity/scale from semantic state
    this.stars.forEach((star, id) => {
      const basePos = star.userData.originalPosition;
      if (!basePos) return;

      star.position.y = basePos.y + Math.sin(time * 0.5 + id.charCodeAt(0)) * 0.15;

      const pulse = 0.9 + Math.sin(time * 2 + id.charCodeAt(0) * 0.1) * 0.1;
      const starCategory = star.userData.quote?.category;

      for (const child of star.children) {
        if (!child.material) continue;
        child.material.opacity = computeStarOpacity({
          baseOpacity: child.userData.baseOpacity,
          isSprite: child.isSprite === true,
          pulse,
          starCategory,
          focusedCategory: this.focusedCategory,
          contradictionMode: this.contradictionMode
        });
      }

      const scale = computeStarScale({
        introScale: star.userData.introScale ?? 1,
        isHovered: star === this.hoveredStar,
        starCategory,
        focusedCategory: this.focusedCategory
      });
      star.scale.set(scale, scale, scale);
    });

    this.categoryLabels.forEach((label, catId) => {
      label.material.opacity = this.focusedCategory
        ? (catId === this.focusedCategory ? 1 : 0.2)
        : label.userData.baseOpacity;
    });

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  // Cleanup
  dispose() {
    this.renderer.dispose();
    this.controls.dispose();
  }
}
