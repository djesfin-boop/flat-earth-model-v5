/**
 * Layer 0: Surface Layer - Flat Earth Model v5
 * Координатная сетка, карта Глиссона и динамическая реалистичная маска фазы Луны как шейдер
 * @version 5.3.0 (маска)
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.gridGroup = new THREE.Group();
        this.sunPosition = { x: 0, y: 0 };
        this.moonPosition = { x: 0, y: 0 };
        this.moonPhase = 0;
        this.createSurface();
        this.createCoordGrid();
        this.createMoonPhaseSpot();
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
    createMoonPhaseSpot() {
        // Рисуем круг который затемняется маской через custom fragmentShader
        const radius = 800;
        const geometry = new THREE.CircleGeometry(radius, 128);
        // Шейдер: выводит освещённую часть круга в зависимости от нормали/фазы
        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                phase: { value: 0 }, // -1 = новолуние, 0 = полнолуние, 1 = новолуние
                color: { value: new THREE.Color(0xc1caf6) },
                opacity: { value: 0.21 }
            },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                uniform float phase;
                uniform vec3 color;
                uniform float opacity;
                varying vec2 vUv;
                void main() {
                    float r = length(vUv);
                    if (r > 1.0) discard;
                    // Реалистичная динамика: маска фазы синусоидально пересекает круг
                    float angle = atan(vUv.y, vUv.x);
                    float phaseShift = phase * 3.1415926; // от -pi до pi
                    float mask = (cos(angle - phaseShift) + 1.0) / 2.0;
                    float thresh = 0.5 + 0.5 * phase;
                    float visible = step(mask, thresh);
                    gl_FragColor = vec4(color, opacity * visible * (1.0 - r));
                }`
        });
        this.moonPhaseMesh = new THREE.Mesh(geometry, material);
        this.moonPhaseMesh.position.set(0, 21, 0);
        this.moonPhaseMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.moonPhaseMesh);
    }
    updateLighting(sunPos, moonPos) {
        // Положение диска
        if(this.moonPhaseMesh && moonPos) {
            this.moonPhaseMesh.position.set(moonPos.x, 21, moonPos.y);
        }
        // Расчет фазы: угол между вектором Земля->Солнце и Земля->Луна
        const sx = sunPos.x, sy = sunPos.y;
        const mx = moonPos.x, my = moonPos.y;
        const l_s_dot = (sx * mx + sy * my) / (Math.sqrt(sx * sx + sy * sy) * Math.sqrt(mx * mx + my * my));
        let phase = Math.acos(Math.max(-1, Math.min(1, l_s_dot))) / Math.PI; // [0,1]
        phase = Math.cos(phase * Math.PI); // (-1=нов, 0=полн, 1=нов)
        if(this.moonPhaseMesh && this.moonPhaseMesh.material.uniforms) {
            this.moonPhaseMesh.material.uniforms.phase.value = phase;
        }
    }
}
export default SurfaceLayer;
