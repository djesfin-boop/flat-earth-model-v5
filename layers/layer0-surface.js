/**
 * Layer 0: Surface Layer - Flat Earth Model v6.4
 * Проекция Глисона (равнорасстояний азимутальная)
 * ИСПРАВЛЕНО: Корректное совмещение карты с математической проекцией
 * - Шейдерное перепроецирование equirectangular -> azimuthal equidistant
 * - Яркие световые пятна (Солнце + Луна)
 * - Точный косинусный расчёт зенитного угла
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.lightingOverlay = null;
        this.sunPosition = { x: 0, z: 0 };
        this.moonPosition = { x: 0, z: 0 };
        this.eclipseMarker = null;
        
        this.createSurface();
        this.createLightingOverlay();
    }

    createSurface() {
        const R = this.config.earthRadius;
        const segments = 512;
        
        // Создаём геометрию с правильными UV для азимутальной проекции
        const geometry = new THREE.CircleGeometry(R, segments);
        
        const loader = new THREE.TextureLoader();
        loader.load('assets/azimuthal_map.png', texture => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            
            // Шейдерный материал для перепроецирования equirectangular -> azimuthal
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    mapTexture: { value: texture },
                    earthRadius: { value: R },
                    mapRotation: { value: 0.0 } // Поворот карты (для коррекции)
                },
                vertexShader: `
                    varying vec2 vUv;
                    varying vec2 vPos;
                    void main() {
                        vUv = uv;
                        vPos = position.xy;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform sampler2D mapTexture;
                    uniform float earthRadius;
                    uniform float mapRotation;
                    
                    varying vec2 vUv;
                    varying vec2 vPos;
                    
                    const float PI = 3.14159265359;
                    
                    void main() {
                        // Нормализованные координаты от центра (-1 до 1)
                        vec2 normPos = vPos / earthRadius;
                        
                        // Расстояние от центра (0 = полюс, 1 = край)
                        float dist = length(normPos);
                        
                        // За пределами диска - прозрачный
                        if (dist > 1.0) {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
                            return;
                        }
                        
                        // Угол от оси X (долгота)
                        float theta = atan(normPos.x, normPos.y) + mapRotation;
                        
                        // Проекция Глисона: dist = (90 - lat) / 90
                        // Поэтому lat = 90 * (1 - dist)
                        float lat = 90.0 * (1.0 - dist);
                        
                        // Преобразуем в UV для equirectangular текстуры
                        // u = (lon + 180) / 360, v = (lat + 90) / 180
                        float lon = theta * 180.0 / PI;
                        
                        float u = (lon + 180.0) / 360.0;
                        float v = (lat + 90.0) / 180.0;
                        
                        // Коррекция для северного полушария (центр = северный полюс)
                        // v идёт от 0.5 (экватор) до 1.0 (северный полюс)
                        // При dist=0 (полюс) -> lat=90 -> v=1.0
                        // При dist=1 (край) -> lat=0 -> v=0.5
                        
                        vec4 texColor = texture2D(mapTexture, vec2(u, v));
                        gl_FragColor = texColor;
                    }
                `,
                side: THREE.DoubleSide,
                transparent: true
            });
            
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.rotation.x = -Math.PI / 2;
            this.scene.add(this.mesh);
        });
    }

    createLightingOverlay() {
        const geometry = new THREE.CircleGeometry(this.config.earthRadius, 512);
        
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                sunPosition: { value: new THREE.Vector2(0, 0) },
                moonPosition: { value: new THREE.Vector2(0, 0) },
                earthRadius: { value: this.config.earthRadius },
                sunColor: { value: new THREE.Color(0xffff88) },
                moonColor: { value: new THREE.Color(0x88ddff) },
                sunBrightness: { value: 1.2 },
                moonBrightness: { value: 0.25 },
                moonPhase: { value: 0.5 }
            },
            vertexShader: `
                varying vec2 vPos;
                void main() {
                    vPos = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec2 sunPosition;
                uniform vec2 moonPosition;
                uniform float earthRadius;
                uniform vec3 sunColor;
                uniform vec3 moonColor;
                uniform float sunBrightness;
                uniform float moonBrightness;
                uniform float moonPhase;
                
                varying vec2 vPos;
                
                const float sunHeight = 5000.0;
                const float moonHeight = 4000.0;
                
                void main() {
                    vec2 p = vPos;
                    
                    // ========== СОЛНЦЕ ==========
                    vec2 toSun = p - sunPosition;
                    float distSun = length(toSun);
                    float r3dSun = sqrt(distSun * distSun + sunHeight * sunHeight);
                    float cosSun = sunHeight / r3dSun;
                    float sunBright = max(0.0, cosSun * cosSun);
                    
                    // ========== ЛУНА ==========
                    vec2 toMoon = p - moonPosition;
                    float distMoon = length(toMoon);
                    float r3dMoon = sqrt(distMoon * distMoon + moonHeight * moonHeight);
                    float cosMoon = moonHeight / r3dMoon;
                    float moonBright = max(0.0, cosMoon * cosMoon);
                    moonBright *= moonBrightness * moonPhase;
                    
                    // ========== ИТОГОВОЙ ЦВЕТ ==========
                    vec3 col = sunColor * (sunBright * sunBrightness);
                    col += moonColor * moonBright;
                    
                    float light = sunBright + moonBright;
                    float alpha = 0.95 - light * 0.90;
                    
                    gl_FragColor = vec4(col, alpha);
                }
            `
        });
        
        this.lightingOverlay = new THREE.Mesh(geometry, material);
        this.lightingOverlay.position.y = 10;
        this.lightingOverlay.rotation.x = -Math.PI / 2;
        this.scene.add(this.lightingOverlay);
    }

    // Установить поворот карты (для коррекции ориентации)
    setMapRotation(angleDeg) {
        if (this.mesh && this.mesh.material.uniforms) {
            this.mesh.material.uniforms.mapRotation.value = angleDeg * Math.PI / 180;
        }
    }

    updateLighting(sunPos, moonPos, sunDeclinationDeg = 0) {
        this.sunPosition = { x: sunPos.x, z: sunPos.z };
        this.moonPosition = { x: moonPos.x, z: moonPos.z };
        
        if (!this.lightingOverlay || !this.lightingOverlay.material.uniforms) return;
        
        const uniforms = this.lightingOverlay.material.uniforms;
        uniforms.sunPosition.value.set(sunPos.x, sunPos.z);
        uniforms.moonPosition.value.set(moonPos.x, moonPos.z);
        
        // Фаза луны
        const sx = sunPos.x, sz = sunPos.z;
        const mx = moonPos.x, mz = moonPos.z;
        const sunLen = Math.sqrt(sx * sx + sz * sz);
        const moonLen = Math.sqrt(mx * mx + mz * mz);
        
        if (sunLen > 0 && moonLen > 0) {
            const dot = (sx * mx + sz * mz) / (sunLen * moonLen);
            let phase = Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI;
            phase = (1 + Math.cos(phase * Math.PI)) / 2;
            uniforms.moonPhase.value = phase;
        }
    }

    showEclipseMarker(lon, lat) {
        if (this.eclipseMarker) {
            this.scene.remove(this.eclipseMarker);
        }
        
        const r = this.config.earthRadius;
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lon * Math.PI / 180;
        const distance = r * (phi / (Math.PI / 2));
        const x = distance * Math.sin(theta);
        const z = distance * Math.cos(theta);
        
        const markerGeometry = new THREE.RingGeometry(800, 1200, 64);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.7,
            depthWrite: false
        });
        
        this.eclipseMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.eclipseMarker.position.set(x, 30, z);
        this.eclipseMarker.rotation.x = -Math.PI / 2;
        this.scene.add(this.eclipseMarker);
    }
}

export default SurfaceLayer;
