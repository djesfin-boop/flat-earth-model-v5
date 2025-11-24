/**
 * Layer 0: Surface Layer - Flat Earth Model v5
 * Добавлены световые пятна Солнца и Луны с правильной координатной сеткой
 * @version 5.5.0
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
        this.eclipseMarker = null;
        this.sunSpotMesh = null;
        this.moonPhaseMesh = null;
        
        this.createSurface();
        this.createCoordGrid();
        this.createSunSpot();
        this.createMoonPhaseSpot();
    }
    
    createSurface() {
        const geometry = new THREE.CircleGeometry(this.config.earthRadius, 512);
        const loader = new THREE.TextureLoader();
        loader.load('assets/azimuthal_map.png', texture => {
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
        const parallels = 9; // широты: 10°, 20°, ..., 90° (экватор до края)
        this.gridGroup.clear();
        
        // Меридианы (линии долготы от центра к краю)
        for (let i = 0; i < meridians; i++) {
            const angle = (i / meridians) * Math.PI * 2;
            const x1 = Math.sin(angle) * r;
            const y1 = Math.cos(angle) * r;
            const material = new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2, opacity: 0.6, transparent: true });
            const points = [
                new THREE.Vector3(0, 0.1, 0),
                new THREE.Vector3(x1, 0.1, y1)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            line.rotation.x = -Math.PI / 2;
            this.gridGroup.add(line);
        }
        
        // Параллели (широты) - концентрические круги
        // Формула азимутальной проекции: r = R * (90 - φ) / 90
        for (let i = 1; i <= parallels; i++) {
            const latitude = 90 - (i * 10); // широта в градусах: 80°, 70°, ..., 0° (экватор)
            const pr = r * (90 - latitude) / 90;
            const material = new THREE.LineBasicMaterial({ color: 0x0088ff, linewidth: 1, opacity: 0.5, transparent: true });
            const circlePoints = [];
            for (let j = 0; j <= 128; j++) {
                const a = (j / 128) * Math.PI * 2;
                const x = Math.sin(a) * pr;
                const y = Math.cos(a) * pr;
                circlePoints.push(new THREE.Vector3(x, 0.11, y));
            }
            const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
            const circle = new THREE.Line(circleGeo, material);
            circle.rotation.x = -Math.PI / 2;
            this.gridGroup.add(circle);
        }
        
        this.scene.add(this.gridGroup);
    }
    
    createSunSpot() {
        // Солнечное пятно с радиальным градиентом
        const sunRadius = 4000; // радиус дневного пятна ~4000 км
        const geometry = new THREE.CircleGeometry(sunRadius, 128);
        
        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                color: { value: new THREE.Color(0xfff4a3) },
                centerOpacity: { value: 0.5 },
                edgeOpacity: { value: 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv * 2.0 - 1.0;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float centerOpacity;
                uniform float edgeOpacity;
                varying vec2 vUv;
                
                void main() {
                    float r = length(vUv);
                    if (r > 1.0) discard;
                    
                    // Радиальный градиент от центра к краю
                    float gradient = 1.0 - r;
                    float alpha = mix(edgeOpacity, centerOpacity, gradient * gradient);
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `
        });
        
        this.sunSpotMesh = new THREE.Mesh(geometry, material);
        this.sunSpotMesh.position.set(0, 15, 0);
        this.sunSpotMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.sunSpotMesh);
    }
    
    createMoonPhaseSpot() {
        // Лунное пятно с учётом фаз
        const radius = 1200;
        const geometry = new THREE.CircleGeometry(radius, 128);
        
        const material = new THREE.ShaderMaterial({
            transparent: true,
            uniforms: {
                phase: { value: 0 },
                color: { value: new THREE.Color(0xc1caf6) },
                opacity: { value: 0.3 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv * 2.0 - 1.0;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float phase;
                uniform vec3 color;
                uniform float opacity;
                varying vec2 vUv;
                
                void main() {
                    float r = length(vUv);
                    if (r > 1.0) discard;
                    
                    float angle = atan(vUv.y, vUv.x);
                    float phaseShift = phase * 3.1415926;
                    float mask = (cos(angle - phaseShift) + 1.0) / 2.0;
                    float thresh = 0.5 + 0.5 * phase;
                    float visible = step(mask, thresh);
                    
                    // Градиент от центра к краю
                    float gradient = 1.0 - r;
                    float alpha = opacity * visible * gradient;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `
        });
        
        this.moonPhaseMesh = new THREE.Mesh(geometry, material);
        this.moonPhaseMesh.position.set(0, 18, 0);
        this.moonPhaseMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.moonPhaseMesh);
    }
    
    updateLighting(sunPos, moonPos) {
        // Обновление положения солнечного пятна
        if (this.sunSpotMesh && sunPos) {
            this.sunSpotMesh.position.set(sunPos.x, 15, sunPos.y);
        }
        
        // Обновление положения лунного пятна
        if (this.moonPhaseMesh && moonPos) {
            this.moonPhaseMesh.position.set(moonPos.x, 18, moonPos.y);
        }
        
        // Расчет фазы Луны
        const sx = sunPos.x, sy = sunPos.y;
        const mx = moonPos.x, my = moonPos.y;
        const sunLen = Math.sqrt(sx * sx + sy * sy);
        const moonLen = Math.sqrt(mx * mx + my * my);
        
        if (sunLen > 0 && moonLen > 0) {
            const l_s_dot = (sx * mx + sy * my) / (sunLen * moonLen);
            let phase = Math.acos(Math.max(-1, Math.min(1, l_s_dot))) / Math.PI;
            phase = Math.cos(phase * Math.PI);
            
            if (this.moonPhaseMesh && this.moonPhaseMesh.material.uniforms) {
                this.moonPhaseMesh.material.uniforms.phase.value = phase;
            }
        }
    }
    
    showEclipseMarker(lon, lat) {
        // Удаляем предыдущий маркер
        if (this.eclipseMarker) {
            this.scene.remove(this.eclipseMarker);
        }
        
        // Конвертация широты/долготы в координаты азимутальной проекции
        const r = this.config.earthRadius;
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lon * Math.PI / 180;
        const x = r * Math.sin(phi) * Math.sin(theta);
        const y = r * Math.sin(phi) * Math.cos(theta);
        
        const markerGeometry = new THREE.RingGeometry(550, 800, 64);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.5 
        });
        this.eclipseMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.eclipseMarker.position.set(x, 22, y);
        this.eclipseMarker.rotation.x = -Math.PI / 2;
        this.scene.add(this.eclipseMarker);
    }
}

export default SurfaceLayer;