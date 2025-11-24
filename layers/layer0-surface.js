/**
 * Layer 0: Surface Layer - Flat Earth Model v5
 * Световые пятна Солнца и Луны на азимутальной карте
 * @version 5.6.0
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.sunPosition = { x: 0, y: 0 };
        this.moonPosition = { x: 0, y: 0 };
        this.moonPhase = 0;
        this.eclipseMarker = null;
        this.sunSpotMesh = null;
        this.moonPhaseMesh = null;
        
        this.createSurface();
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
            const material = new THREE.MeshBasicMaterial({ 
                map: texture, 
                side: THREE.DoubleSide 
            });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.rotation.x = -Math.PI / 2;
            this.scene.add(this.mesh);
        });
    }
    
    createSunSpot() {
        // Солнечное пятно с ярким радиальным градиентом
        const sunRadius = 5000; // увеличенный радиус для лучшей видимости
        const geometry = new THREE.CircleGeometry(sunRadius, 128);
        
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                color: { value: new THREE.Color(0xffeb3b) },
                centerOpacity: { value: 0.7 },
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
                    
                    // Сильный градиент для яркого центра
                    float gradient = pow(1.0 - r, 2.5);
                    float alpha = mix(edgeOpacity, centerOpacity, gradient);
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `
        });
        
        this.sunSpotMesh = new THREE.Mesh(geometry, material);
        this.sunSpotMesh.position.set(0, 25, 0);
        this.sunSpotMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.sunSpotMesh);
    }
    
    createMoonPhaseSpot() {
        // Лунное пятно с учётом фаз и ярким градиентом
        const radius = 2000;
        const geometry = new THREE.CircleGeometry(radius, 128);
        
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                phase: { value: 0 },
                color: { value: new THREE.Color(0xadd8e6) },
                opacity: { value: 0.5 }
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
                    
                    // Яркий градиент
                    float gradient = pow(1.0 - r, 1.8);
                    float alpha = opacity * visible * gradient;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `
        });
        
        this.moonPhaseMesh = new THREE.Mesh(geometry, material);
        this.moonPhaseMesh.position.set(0, 28, 0);
        this.moonPhaseMesh.rotation.x = -Math.PI / 2;
        this.scene.add(this.moonPhaseMesh);
    }
    
    updateLighting(sunPos, moonPos) {
        // Обновление положения солнечного пятна
        if (this.sunSpotMesh && sunPos) {
            this.sunSpotMesh.position.set(sunPos.x, 25, sunPos.y);
        }
        
        // Обновление положения лунного пятна
        if (this.moonPhaseMesh && moonPos) {
            this.moonPhaseMesh.position.set(moonPos.x, 28, moonPos.y);
        }
        
        // Расчет фазы Луны
        if (sunPos && moonPos) {
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
        const distance = r * (phi / (Math.PI / 2)); // расстояние от центра
        const x = distance * Math.sin(theta);
        const y = distance * Math.cos(theta);
        
        const markerGeometry = new THREE.RingGeometry(500, 700, 64);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.6,
            depthWrite: false
        });
        this.eclipseMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.eclipseMarker.position.set(x, 30, y);
        this.eclipseMarker.rotation.x = -Math.PI / 2;
        this.scene.add(this.eclipseMarker);
    }
}

export default SurfaceLayer;