/**
 * Layer 0: Surface Layer - Flat Earth Model v6
 * Реалистичное освещение с терминатором, полярными днями/ночами
 * и плавным переходом день/ночь в азимутальной проекции
 * @version 6.1.0
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.lightingOverlay = null;
        this.sunPosition = { x: 0, z: 0 };
        this.moonPosition = { x: 0, z: 0 };
        this.moonPhase = 0;
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
        // Слой освещения с реалистичным терминатором и сезонными эффектами
        const geometry = new THREE.CircleGeometry(this.config.earthRadius, 512);

        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                sunPosition:     { value: new THREE.Vector2(0, 0) },
                moonPosition:    { value: new THREE.Vector2(0, 0) },
                earthRadius:     { value: this.config.earthRadius },
                dayColor:        { value: new THREE.Color(0xffffff) },
                nightColor:      { value: new THREE.Color(0x000a1f) },
                twilightWidth:   { value: 3000 },
                dayBrightness:   { value: 0.0 },
                nightDarkness:   { value: 0.75 },
                moonPhase:       { value: 0.5 },
                moonBrightness:  { value: 0.4 },
                sunDeclination:  { value: 0.0 }  // склонение солнца в радианах
            },
            vertexShader: `
                varying vec2 vPosition;
                void main() {
                    vPosition = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec2  sunPosition;
                uniform vec2  moonPosition;
                uniform float earthRadius;
                uniform vec3  dayColor;
                uniform vec3  nightColor;
                uniform float twilightWidth;
                uniform float dayBrightness;
                uniform float nightDarkness;
                uniform float moonPhase;
                uniform float moonBrightness;
                uniform float sunDeclination;

                varying vec2 vPosition;

                const float sunHeight  = 5000.0;
                const float moonHeight = 4000.0;
                const float PI = 3.14159265359;

                void main() {
                    // Нормированная радиальная координата точки
                    float r = length(vPosition) / earthRadius;
                    r = clamp(r, 0.0, 1.0);

                    // "Широта" в азимутальной проекции: 0 в центре, π/2 на краю
                    float lat = r * (PI / 2.0);

                    // Сезонный множитель: когда солнце в северном полушарии,
                    // северные широты получают больший косинус
                    float cosSeason = cos(lat - sunDeclination);
                    // Немного подавляем отрицательное для мягкого терминатора
                    cosSeason = max(cosSeason, -0.15);

                    // ============= СОЛНЦЕ =============
                    vec2  toSun  = vPosition - sunPosition;
                    float dist2S = dot(toSun, toSun);
                    float rSun   = sqrt(dist2S + sunHeight * sunHeight);
                    float cosZenithSun = sunHeight / rSun;

                    // Применяем сезонную коррекцию к косинусу зенитного угла
                    float sunCos = cosZenithSun * cosSeason;

                    // Плавный переход день → сумерки → ночь
                    float sunLight = smoothstep(0.05, 0.18, sunCos);

                    // ============= ЛУНА =============
                    vec2  toMoon  = vPosition - moonPosition;
                    float dist2M  = dot(toMoon, toMoon);
                    float rMoon   = sqrt(dist2M + moonHeight * moonHeight);
                    float cosZenithMoon = moonHeight / rMoon;

                    // Луна: без сезонной коррекции (или можно применить по желанию)
                    float moonCos = cosZenithMoon;

                    float moonLight = smoothstep(0.07, 0.16, moonCos) * moonBrightness * moonPhase;

                    // ============= ИТОГОВОЕ ОСВЕЩЕНИЕ =============
                    float totalLight = sunLight + moonLight * (1.0 - sunLight);

                    // Смешивание цветов дня и ночи
                    vec3 color = mix(nightColor, dayColor, totalLight);

                    // Голубое лунное пятно видно в ночи
                    vec3 moonTint = vec3(0.60, 0.70, 0.90);
                    color = mix(color, moonTint, moonLight * (1.0 - sunLight) * 0.5);

                    // Затемнение (альфа-канал): ночь темнее, день прозрачнее
                    float darkness = mix(nightDarkness, dayBrightness, totalLight);

                    gl_FragColor = vec4(color, darkness);
                }
            `
        });

        this.lightingOverlay = new THREE.Mesh(geometry, material);
        this.lightingOverlay.position.y = 10;
        this.lightingOverlay.rotation.x = -Math.PI / 2;
        this.scene.add(this.lightingOverlay);
    }

    updateLighting(sunPos, moonPos, sunDeclinationDeg) {
        // Сохраняем позиции в азимутальной проекции (x, z)
        this.sunPosition  = { x: sunPos.x,  z: sunPos.z };
        this.moonPosition = { x: moonPos.x, z: moonPos.z };
        
        // Сохраняем склонение солнца (в радианах для шейдера)
        const decRad = sunDeclinationDeg * Math.PI / 180;
        this.sunDeclination = decRad;

        if (this.lightingOverlay && this.lightingOverlay.material.uniforms) {
            // Обновляем позиции светил на плоскости (x, z)
            this.lightingOverlay.material.uniforms.sunPosition.value.set(sunPos.x, sunPos.z);
            this.lightingOverlay.material.uniforms.moonPosition.value.set(moonPos.x, moonPos.z);

            // Передаём склонение солнца в шейдер для сезонного эффекта
            this.lightingOverlay.material.uniforms.sunDeclination.value = decRad;

            // Расчёт фазы Луны по отношению к Солнцу в плоскости (x, z)
            const sx = sunPos.x, sz = sunPos.z;
            const mx = moonPos.x, mz = moonPos.z;
            const sunLen  = Math.sqrt(sx * sx + sz * sz);
            const moonLen = Math.sqrt(mx * mx + mz * mz);

            if (sunLen > 0 && moonLen > 0) {
                const dot = (sx * mx + sz * mz) / (sunLen * moonLen);
                let phase = (Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI);
                // Преобразование в яркость (0 = новолуние, 1 = полнолуние)
                phase = (1.0 + Math.cos(phase * Math.PI)) / 2.0;
                this.lightingOverlay.material.uniforms.moonPhase.value = phase;
            }
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
