/**
 * Layer 0: Surface Layer - Flat Earth Model v6
 * Реалистичное косинусное освещение в азимутальной проекции (пятна от светил)
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
                sunPosition: { value: new THREE.Vector2(0, 0) },
                moonPosition: { value: new THREE.Vector2(0, 0) },
                earthRadius: { value: this.config.earthRadius },
                dayColor: { value: new THREE.Color(0xffffff) },
                nightColor: { value: new THREE.Color(0x102235) },
                dayBrightness: { value: 0.0 },
                nightDarkness: { value: 0.85 },
                moonPhase: { value: 0.5 },
                moonBrightness: { value: 0.5 }
            },
            vertexShader: `
                varying vec2 vPosition;
                void main() {
                    vPosition = position.xy;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec2 sunPosition;
                uniform vec2 moonPosition;
                uniform float earthRadius;
                uniform vec3 dayColor;
                uniform vec3 nightColor;
                uniform float dayBrightness;
                uniform float nightDarkness;
                uniform float moonPhase;
                uniform float moonBrightness;

                varying vec2 vPosition;

                const float sunHeight = 6000.0;
                const float moonHeight = 4000.0;

                void main() {
                    // Солнце: ортогональная модель, плавное косинусное пятно
                    vec2 toSun = vPosition - sunPosition;
                    float dist2 = dot(toSun, toSun);
                    float rSun = sqrt(dist2 + sunHeight * sunHeight);
                    float sunCos = sunHeight / rSun;
                    float sunLight = smoothstep(0.07, 0.16, sunCos);

                    // Луна: то же самое, слабее и в зависимости от фазы
                    vec2 toMoon = vPosition - moonPosition;
                    float dist2m = dot(toMoon, toMoon);
                    float rMoon = sqrt(dist2m + moonHeight * moonHeight);
                    float moonCos = moonHeight / rMoon;
                    float moonLight = smoothstep(0.085, 0.18, moonCos) * moonBrightness * moonPhase;

                    // Комбинация света: преимущественно солнце, ночью подсветка от луны
                    float totalLight = sunLight + moonLight * (1.0 - sunLight);

                    vec3 color = mix(nightColor, dayColor, totalLight);

                    // Добавить лунный голубой оттенок ночью
                    vec3 moonTint = vec3(0.62, 0.74, 1.00);
                    color = mix(color, moonTint, moonLight * 0.9 * (1.0 - sunLight));

                    float darkness = mix(nightDarkness, dayBrightness, totalLight);

                    gl_FragColor = vec4(color, 1.0 - darkness);
                }
            `
        });

        this.lightingOverlay = new THREE.Mesh(geometry, material);
        this.lightingOverlay.position.y = 10;
        this.lightingOverlay.rotation.x = -Math.PI / 2;
        this.scene.add(this.lightingOverlay);
    }

    updateLighting(sunPos, moonPos) {
        // Ключ: используем X и Z (плоские координаты)
        this.sunPosition = { x: sunPos.x, z: sunPos.z };
        this.moonPosition = { x: moonPos.x, z: moonPos.z };

        if (this.lightingOverlay && this.lightingOverlay.material.uniforms) {
            this.lightingOverlay.material.uniforms.sunPosition.value.set(sunPos.x, sunPos.z);
            this.lightingOverlay.material.uniforms.moonPosition.value.set(moonPos.x, moonPos.z);

            // Фаза луны по позиции (оставляем прежнее приближение)
            const sx = sunPos.x, sz = sunPos.z;
            const mx = moonPos.x, mz = moonPos.z;
            const sunLen = Math.sqrt(sx * sx + sz * sz);
            const moonLen = Math.sqrt(mx * mx + mz * mz);
            if (sunLen > 0 && moonLen > 0) {
                const dot = (sx * mx + sz * mz) / (sunLen * moonLen);
                let phase = (Math.acos(Math.max(-1, Math.min(1, dot))) / Math.PI);
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
        const y = distance * Math.cos(theta);

        const markerGeometry = new THREE.RingGeometry(800, 1200, 64);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.7,
            depthWrite: false
        });
        this.eclipseMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.eclipseMarker.position.set(x, 30, y);
        this.eclipseMarker.rotation.x = -Math.PI / 2;
        this.scene.add(this.eclipseMarker);
    }
}

export default SurfaceLayer;
