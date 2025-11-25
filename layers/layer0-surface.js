/**
 * Layer 0: Surface Layer - Flat Earth Model v5
 * Реалистичное освещение с терминатором и плавным переходом день/ночь
 * @version 6.0.0
 */

class SurfaceLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.lightingOverlay = null;
        this.sunPosition = { x: 0, y: 0 };
        this.moonPosition = { x: 0, y: 0 };
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
        // Слой освещения с реалистичным терминатором
        const geometry = new THREE.CircleGeometry(this.config.earthRadius, 512);
        
        const material = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
                sunPosition: { value: new THREE.Vector2(0, 0) },
                moonPosition: { value: new THREE.Vector2(0, 0) },
                earthRadius: { value: this.config.earthRadius },
                dayColor: { value: new THREE.Color(0xffffff) },
                nightColor: { value: new THREE.Color(0x000a1f) },
                twilightWidth: { value: 3000 }, // ширина сумеречной зоны в км
                dayBrightness: { value: 0.0 }, // 0.0 = не затемняет карту днём
                nightDarkness: { value: 0.75 }, // затемнение ночью
                moonPhase: { value: 0.5 },
                moonBrightness: { value: 0.4 }
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
                uniform float twilightWidth;
                uniform float dayBrightness;
                uniform float nightDarkness;
                uniform float moonPhase;
                uniform float moonBrightness;
                
                varying vec2 vPosition;
                
                void main() {
                    // Расстояние от текущей точки до центра солнечного пятна
                    float distToSun = distance(vPosition, sunPosition);
                    
                    // Радиус дневного пятна (половина Земли для упрощения)
                    float dayRadius = earthRadius * 0.5;
                    
                    // Расстояние от границы дня (положительное = день, отрицательное = ночь)
                    float distFromTerminator = dayRadius - distToSun;
                    
                    // Плавный переход через сумеречную зону
                    float sunLight = smoothstep(-twilightWidth, twilightWidth, distFromTerminator);
                    
                    // Лунное освещение
                    float distToMoon = distance(vPosition, moonPosition);
                    float moonRadius = earthRadius * 0.25;
                    float moonLight = smoothstep(moonRadius + 2000.0, moonRadius - 1000.0, distToMoon);
                    moonLight *= moonBrightness * moonPhase;
                    
                    // Общее освещение
                                    // Расчёт затмения: когда Луна близко к Солнцу, солнечный свет затеняется
                float sunMoonDist = distance(sunPosition, moonPosition);
                float eclipseFactor = smoothstep(300.0, 2000.0, sunMoonDist);
                float adjustedSunLight = sunLight * eclipseFactor;
                float totalLight = adjustedSunLight + moonLight * (1.0 - adjustedSunLight);
                    // Смешивание цветов дня и ночи
                    vec3 color = mix(nightColor, dayColor, totalLight);
                    
                    // Затемнение: днём почти не видно (прозрачно), ночью темно
                                    // Добавляем видимое голубоватое лунное пятно
                vec3 moonTint = vec3(0.6, 0.7, 0.9);
                color = mix(color, moonTint, moonLight * 0.4);
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
    
    updateLighting(sunPos, moonPos) {
        this.sunPosition = sunPos;
        this.moonPosition = moonPos;
        
        if (this.lightingOverlay && this.lightingOverlay.material.uniforms) {
            // Обновление позиций в шейдере
            this.lightingOverlay.material.uniforms.sunPosition.value.set(sunPos.x, sunPos.y);
            this.lightingOverlay.material.uniforms.moonPosition.value.set(moonPos.x, moonPos.y);
            
            // Расчёт фазы Луны
            const sx = sunPos.x, sy = sunPos.y;
            const mx = moonPos.x, my = moonPos.y;
            const sunLen = Math.sqrt(sx * sx + sy * sy);
            const moonLen = Math.sqrt(mx * mx + my * my);
            
            if (sunLen > 0 && moonLen > 0) {
                const dot = (sx * mx + sy * my) / (sunLen * moonLen);
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
