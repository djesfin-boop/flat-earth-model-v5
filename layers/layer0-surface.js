/**
 * Layer 0: Surface Layer - Flat Earth Model v6
 * Реалистичное освещение в азимутальной проекции:
 * - световые пятна Солнца и Луны
 * - полярные дни/ночи с реалистичными сумерками
 * - градиент заката/восхода
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.lightingOverlay = null;
        this.sunPosition = { x: 0, z: 0 };
        this.moonPosition = { x: 0, z: 0 };
        this.sunDeclination = 0;
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
                dayColor:       { value: new THREE.Color(0xf8f2d0) },
                nightColor:     { value: new THREE.Color(0x050814) },
                sunsetColor:    { value: new THREE.Color(0xff7a33) },
                deepTwilight:   { value: new THREE.Color(0x112244) },
                moonColor:      { value: new THREE.Color(0x7fa8ff) },
                nightDarkness:  { value: 0.90 },
                moonPhase:      { value: 0.5 },
                moonBrightness: { value: 0.5 },
                sunDeclRad:     { value: 0.0 }
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
                uniform vec3  dayColor;
                uniform vec3  nightColor;
                uniform vec3  sunsetColor;
                uniform vec3  deepTwilight;
                uniform vec3  moonColor;
                uniform float nightDarkness;
                uniform float moonPhase;
                uniform float moonBrightness;
                uniform float sunDeclRad;

                varying vec2 vPos;

                const float sunHeight  = 5000.0;
                const float moonHeight = 4000.0;
                const float PI         = 3.14159265359;

                const float COS_DAY        = 0.25;
                const float COS_CIVIL_TW   = 0.10;
                const float COS_NAUT_TW    = 0.02;
                const float COS_ASTR_TW    = -0.10;
                const float COS_NIGHT      = -0.30;

                void main() {
                    // Нормированное расстояние от центра
                    float r = length(vPos) / earthRadius;
                    r = clamp(r, 0.0, 1.0);

                    // Псевдо-широта на диске
                    float lat = r * (PI * 0.5);

                    // Сезонный множитель
                    float cosSeason = cos(lat - sunDeclRad);

                    // Солнце
                    vec2  toSun = vPos - sunPosition;
                    float d2s   = dot(toSun, toSun);
                    float rSun  = sqrt(d2s + sunHeight * sunHeight);
                    float cosSunBase = sunHeight / rSun;
                    float cosSun = cosSunBase * cosSeason;

                    // Веса для сумерек
                    float wDay     = smoothstep(COS_CIVIL_TW, COS_DAY, cosSun);
                    float wCivil   = smoothstep(COS_NAUT_TW, COS_CIVIL_TW, cosSun) * (1.0 - wDay);
                    float wNaut    = smoothstep(COS_ASTR_TW, COS_NAUT_TW, cosSun) * (1.0 - wDay - wCivil);
                    float wAstr    = smoothstep(COS_NIGHT, COS_ASTR_TW, cosSun) * (1.0 - wDay - wCivil - wNaut);
                    float wNight   = 1.0 - wDay - wCivil - wNaut - wAstr;

                    // Цвет
                    vec3 col = vec3(0.0);
                    col += dayColor * wDay;
                    col += sunsetColor * wCivil;
                    col += deepTwilight * (wNaut + wAstr);
                    col += nightColor * wNight;

                    // Луна
                    vec2  toMoon = vPos - moonPosition;
                    float d2m    = dot(toMoon, toMoon);
                    float rMoon  = sqrt(d2m + moonHeight * moonHeight);
                    float cosMoon = moonHeight / rMoon;

                    float moonCore  = smoothstep(0.12, 0.22, cosMoon);
                    float moonHalo  = smoothstep(0.02, 0.12, cosMoon);
                    float moonLight = (moonCore * 0.8 + moonHalo * 0.4) * moonBrightness * moonPhase;

                    float sunMask = 1.0 - wDay;
                    col = mix(col, moonColor, moonLight * sunMask);

                    // Альфа
                    float lightLevel = wDay + 0.6 * wCivil + 0.3 * (wNaut + wAstr) + 0.1 * moonLight;
                    float alpha = mix(nightDarkness, 0.02, lightLevel);

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

        const decRad = sunDeclinationDeg * Math.PI / 180.0;
        uniforms.sunDeclRad.value = decRad;

        // фаза луны
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
