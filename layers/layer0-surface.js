/**
 * Layer 0: Surface Layer - Flat Earth Model v5
 * Координатная сетка, карта Глиссона и динамическое освещение пятнами Солнца/Луны поверх проекции
 * @version 5.2.0 (сет + пятна поверх)
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.gridGroup = new THREE.Group();
        this.sunSpot = null;
        this.moonSpot = null;
        this.sunPosition = { x: 0, y: 0 };
        this.moonPosition = { x: 0, y: 0 };
        this.createSurface();
        this.createCoordGrid();
        this.createLightingSpots();
    }
    createSurface() {
        const geometry = new THREE.CircleGeometry(this.config.earthRadius, 512);
        // Текстура Глиссона
        const loader = new THREE.TextureLoader();
        loader.load('assets/textures/azimuthal_map.png', texture => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.rotation.x = -Math.PI / 2;
            this.scene.add(this.mesh);
        });
    }
    createCoordGrid() {
        const r = this.config.earthRadius;
        const meridians = 24; // каждые 15°
        const parallels = 6; // каждые 2000км
        this.gridGroup.clear();
        // Меридианы
        for (let i = 0; i < meridians; i++) {
            const angle = (i / meridians) * Math.PI * 2;
            const x1 = Math.cos(angle) * r;
            const y1 = Math.sin(angle) * r;
            const material = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 });
            const points = [new THREE.Vector3(0, 0.1, 0), new THREE.Vector3(x1, 0.1, y1)];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            line.rotation.x = -Math.PI / 2;
            this.gridGroup.add(line);
        }
        // Параллели
        for (let i = 1; i < parallels; i++) {
            const pr = r * (i / parallels);
            const material = new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 1 });
            const circlePoints = [];
            for (let j = 0; j <= 128; j++) {
                const a = (j / 128) * Math.PI * 2;
                const x = Math.cos(a) * pr;
                const y = Math.sin(a) * pr;
                circlePoints.push(new THREE.Vector3(x, 0.11, y));
            }
            const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
            const circle = new THREE.Line(circleGeo, material);
            circle.rotation.x = -Math.PI / 2;
            this.gridGroup.add(circle);
        }
        this.scene.add(this.gridGroup);
    }
    createLightingSpots() {
        // Имитация световых пятен простыми градиентными Mesh (Surface + alpha)
        const r = this.config.earthRadius;
        // Солнце
        let sunGeo = new THREE.CircleGeometry(3000, 96);
        let sunMat = new THREE.MeshBasicMaterial({ color: 0xffefbb, transparent: true, opacity: 0.45 });
        this.sunSpot = new THREE.Mesh(sunGeo, sunMat);
        this.sunSpot.position.set(0, 20, 0);
        this.sunSpot.rotation.x = -Math.PI / 2;
        this.scene.add(this.sunSpot);
        // Луна
        let moonGeo = new THREE.CircleGeometry(800, 64);
        let moonMat = new THREE.MeshBasicMaterial({ color: 0xc1caf6, transparent: true, opacity: 0.20 });
        this.moonSpot = new THREE.Mesh(moonGeo, moonMat);
        this.moonSpot.position.set(0, 20, 0);
        this.moonSpot.rotation.x = -Math.PI / 2;
        this.scene.add(this.moonSpot);
    }
    updateLighting(sunPos, moonPos) {
        if (this.sunSpot && sunPos) {
            this.sunSpot.position.set(sunPos.x, 20, sunPos.y);
        }
        if (this.moonSpot && moonPos) {
            this.moonSpot.position.set(moonPos.x, 20, moonPos.y);
        }
        // Можно добавить динамику прозрачности по фазе/интенсивности
    }
    // остальные методы без изменений ...
}
export default SurfaceLayer;
