/**
 * Layer 0: Surface Layer - Flat Earth Model v6
 * Реалистичное освещение в азимутальной проекции:
 * - световые пятна Солнца и Луны
 * - сезонное смещение (полярные дни/ночи в упрощённом виде)
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.lightingOverlay = null;
        this.sunPosition = { x: 0, z: 0 };
        this.moonPosition = { x: 0, z: 0 };
        this.sunDeclination = 0; // градусы
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
                sunPosition:    { value: new THREE.Vector2(0, 0) }, // (x,z)
                moonPosition:   { value: new THREE.Vector2(0, 0) }, // (x,z)
                earthRadius:    { value: this.config.earthRadius },
                nightColor:     { value: new THREE.Color(0x020715) },
                dayColor:       { value: new THREE.Color(0xf8f2d0) },
                moonColor:      { value: new THREE.Color(0x7fa8ff) },
                nightDarkness:  { value: 0.85 },
                moonPhase:      { value: 0.5 },
                moonBrightness: { value: 0.5 },
                sunDeclRad:     { value: 0.0 } // склонение в радианах
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
                uniform vec3  nightColor;
                uniform vec3  dayColor;
                uniform vec3  moonColor;
                uniform float nightDarkness;
                uniform float moonPhase;
                uniform float moonBrightness;
                uniform float sunDeclRad;

                varying vec2 vPos;

                const float sunHeight  = 5000.0;
                const float moonHeight = 4000.0;
                const float PI = 3.14159265359;

                void main() {
                    // Нормированное расстояние от центра (0..1)
                    float r = length(vPos) / earthRadius;
                    r = clamp(r, 0.0, 1.0);

                    // Псевдо-широта на диске (0 в центре, π/2 на краю)
                    float lat = r * (PI * 0.5);

                    // сезонный множитель: когда sunDeclRad > 0, север получает больше света
                    float seasonFactor = cos(lat - sunDeclRad);
                    seasonFactor = clamp(seasonFactor, -0.3, 1.0);

                    // Солнце
                    vec2 toSun = vPos - sunPosition;
                    float d2s  = dot(toSun, toSun);
                    float rs   = sqrt(d2s + sunHeight * sunHeight);
                    float cosSun = sunHeight / rs;

                    float sunLight = smoothstep(0.05, 0.18, cosSun * seasonFactor);

                    // Луна
                    vec2 toMoon = vPos - moonPosition;
                    float d2m   = dot(toMoon, toMoon);
                    float rm    = sqrt(d2m + moonHeight * moonHeight);
                    float cosMoon = moonHeight / rm;
                    float moonLight = smoothstep(0.07, 0.16, cosMoon) * moonBrightness * moonPhase;

                    float totalLight = sunLight + moonLight * (1.0 - sunLight);

                    // Цветовая смесь
                    vec3 col = mix(nightColor, dayColor, totalLight);
                    col = mix(col, moonColor, moonLight * (1.0 - sunLight) * 0.5);

                    float alpha = mix(nightDarkness, 0.0, totalLight);

                    gl_FragColor = vec4(col, alpha);
                }
            `
        });

        this.lightingOverlay = new THREE.Mesh(geometry, material);
        this.lightingOverlay.position.y = 10;
        this.lightingOverlay.rotation.x = -Math.PI / 2;
        this.scene.add(this.lightingOverlay);
    }

    // sunPos, moonPos — объекты из index: {x,y,z,...}, sunDeclinationDeg — в градусах
    updateLighting(sunPos, moonPos, sunDeclinationDeg = 0) {
        this.sunPosition  = { x: sunPos.x,  z: sunPos.z };
        this.moonPosition = { x: moonPos.x, z: moonPos.z };
        this.sunDeclination = sunDeclinationDeg;

        if (!this.lightingOverlay || !this.lightingOverlay.material.uniforms) return;

        const uniforms = this.lightingOverlay.material.uniforms;

        uniforms.sunPosition.value.set(sunPos.x, sunPos.z);
        uniforms.moonPosition.value.set(moonPos.x, moonPos.z);

        const decRad = sunDeclinationDeg * Math.PI / 180.0;
        uniforms.sunDeclRad.value = decRad;

        // Фаза луны по относительному положению на плоскости (x,z)
        const sx = sunPos.x, sz = sunPos.z;
        const mx = moonPos.x, mz = moonPos.z;
        const sunLen  = Math.sqrt(sx * sx + sz * sz);
        const moonLen = Math.sqrt(mx * mx + mz * mz);

        if (sunLen > 0 && moonLen > 0) {
            const dot = (sx * mx + sz * mz) / (sunLen * moonLen);
            let phase = Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI;
            phase = (1 + Math.cos(phase * Math.PI)) / 2; // 0..1
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
