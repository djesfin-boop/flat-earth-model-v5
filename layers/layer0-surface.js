/**
 * Layer 0: Surface Layer - Flat Earth Model v6.2
 * Реалистичное косинусное освещение в азимутальной проекции
 * - Точный расчёт зенитного угла для каждой точки
 * - Круглые (не деформированные) световые пятна Солнца и Луны
 * - Плавное затухание по косинусному закону
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

    createLightingOverlay() {
        const geometry = new THREE.CircleGeometry(this.config.earthRadius, 512);

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                sunPosition:    { value: new THREE.Vector2(0, 0) },
                moonPosition:   { value: new THREE.Vector2(0, 0) },
                earthRadius:    { value: this.config.earthRadius },
                sunColor:       { value: new THREE.Color(0xffffcc) },
                moonColor:      { value: new THREE.Color(0xaabbff) },
                sunBrightness:  { value: 1.0 },
                moonBrightness: { value: 0.15 },
                moonPhase:      { value: 0.5 }
            },
            vertexShader: `
                varying vec2 vPos;
                void main() {
                    vPos = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec2  sunPosition;
                uniform vec2  moonPosition;
                uniform float earthRadius;
                uniform vec3  sunColor;
                uniform vec3  moonColor;
                uniform float sunBrightness;
                uniform float moonBrightness;
                uniform float moonPhase;

                varying vec2 vPos;

                const float sunHeight  = 5000.0;   // высота солнца над плоскостью
                const float moonHeight = 4000.0;   // высота луны над плоскостью

                void main() {
                    // Точка на плоскости
                    vec2 p = vPos;

                    // ========== СОЛНЦЕ ==========
                    // Расстояние от проекции солнца до текущей точки на плоскости
                    vec2 toSun = p - sunPosition;
                    float distSun = length(toSun);
                    
                    // Расстояние в 3D (учитывая высоту солнца)
                    float r3dSun = sqrt(distSun * distSun + sunHeight * sunHeight);
                    
                    // Косинус зенитного угла (угол между вертикалью и лучом от солнца)
                    float cosSun = sunHeight / r3dSun;
                    
                    // Яркость по косинусному закону (max при cosSun=1, min при cosSun=0)
                    float sunBright = max(0.0, cosSun);
                    sunBright = pow(sunBright, 1.2);  // немного усилить контраст
                    
                    // ========== ЛУНА ==========
                    vec2 toMoon = p - moonPosition;
                    float distMoon = length(toMoon);
                    float r3dMoon = sqrt(distMoon * distMoon + moonHeight * moonHeight);
                    float cosMoon = moonHeight / r3dMoon;
                    float moonBright = max(0.0, cosMoon);
                    moonBright = pow(moonBright, 1.2);
                    
                    // Фаза луны
                    moonBright *= moonBrightness * moonPhase;
                    
                    // ========== ИТОГОВОЙ ЦВЕТ ==========
                    // Луна видна только там, где солнце слабое
                    vec3 col = sunColor * (sunBright * sunBrightness);
                    col += moonColor * moonBright;
                    
                    // Альфа-канал: затемнение ночи (там, где нет ни солнца, ни луны)
                    float light = sunBright + moonBright;
                    float alpha = 0.9 - light * 0.85;  // ночь тёмная (alpha=0.9), день прозрачный (alpha=0.05)
                    
                    gl_FragColor = vec4(col, alpha);
                }
            `
        });

        this.lightingOverlay = new THREE.Mesh(geometry, material);
        this.lightingOverlay.position.y = 10;
        this.lightingOverlay.rotation.x = -Math.PI / 2;
        this.scene.add(this.lightingOverlay);
    }

    updateLighting(sunPos, moonPos, sunDeclinationDeg = 0) {
        this.sunPosition  = { x: sunPos.x,  z: sunPos.z };
        this.moonPosition = { x: moonPos.x, z: moonPos.z };

        if (!this.lightingOverlay || !this.lightingOverlay.material.uniforms) return;

        const uniforms = this.lightingOverlay.material.uniforms;
        
        uniforms.sunPosition.value.set(sunPos.x, sunPos.z);
        uniforms.moonPosition.value.set(moonPos.x, moonPos.z);

        // Фаза луны
        const sx = sunPos.x, sz = sunPos.z;
        const mx = moonPos.x, mz = moonPos.z;
        const sunLen  = Math.sqrt(sx * sx + sz * sz);
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
