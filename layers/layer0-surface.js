/**
 * Layer 0: Surface Layer - Flat Earth Model v5
 * Реалистичное освещение поверхности с пятнами от Солнца и Луны
 * 
 * @version 5.0.0
 * @author Flat Earth Model Team
 */

class SurfaceLayer {
    /**
     * @param {THREE.Scene} scene - Three.js сцена
     * @param {Object} config - Конфигурация слоя
     * @param {number} config.earthRadius - Радиус Земли в км
     */
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.mesh = null;
        this.sunPosition = { x: 0, y: 0 };
        this.moonPosition = { x: 0, y: 0 };
        
        this.createSurface();
    }

    /**
     * Создание геометрии и материала поверхности
     */
    createSurface() {
        // Высокополигональная геометрия для плавных градиентов
        const geometry = new THREE.CircleGeometry(this.config.earthRadius, 512);
        
        // Кастомные шейдеры для реалистичного освещения
        const material = new THREE.ShaderMaterial({
            uniforms: {
                sunPosition: { value: new THREE.Vector2(0, 0) },
                moonPosition: { value: new THREE.Vector2(0, 0) },
                sunIntensity: { value: 1.0 },
                moonIntensity: { value: 0.2 },
                sunRadius: { value: 3000 },
                moonRadius: { value: 800 }
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
                uniform float sunIntensity;
                uniform float moonIntensity;
                uniform float sunRadius;
                uniform float moonRadius;
                
                varying vec2 vPosition;
                
                void main() {
                    // Расчет расстояния до подсолнечной точки
                    float distToSun = length(vPosition - sunPosition);
                    float sunBrightness = 0.0;
                    
                    if (distToSun < sunRadius) {
                        float t = distToSun / sunRadius;
                        sunBrightness = (1.0 - t) * sunIntensity;
                        
                        // Мягкий край для реалистичности
                        if (t > 0.7) {
                            sunBrightness *= (1.0 - (t - 0.7) / 0.3);
                        }
                    }
                    
                    // Расчет расстояния до подлунной точки
                    float distToMoon = length(vPosition - moonPosition);
                    float moonBrightness = 0.0;
                    
                    if (distToMoon < moonRadius) {
                        float t = distToMoon / moonRadius;
                        moonBrightness = (1.0 - t * t) * moonIntensity;
                    }
                    
                    // Базовый цвет поверхности (ночь)
                    vec3 baseColor = vec3(0.1, 0.2, 0.3);
                    
                    // Солнечный свет (теплый)
                    vec3 sunColor = vec3(1.0, 0.96, 0.88) * sunBrightness;
                    
                    // Лунный свет (холодный)
                    vec3 moonColor = vec3(0.69, 0.77, 0.87) * moonBrightness;
                    
                    // Финальный цвет
                    gl_FragColor = vec4(baseColor + sunColor + moonColor, 1.0);
                }
            `,
            side: THREE.DoubleSide
        });
        
        // Создание меша
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2; // Поворот в горизонтальное положение
        
        // Добавление в сцену
        this.scene.add(this.mesh);
    }

    /**
     * Обновление освещения на основе положений светил
     * @param {Object} sunPos - Позиция Солнца {x, y}
     * @param {Object} moonPos - Позиция Луны {x, y}
     */
    updateLighting(sunPos, moonPos) {
        if (!this.mesh || !this.mesh.material.uniforms) return;
        
        this.sunPosition = sunPos;
        this.moonPosition = moonPos;
        
        // Обновление uniform-переменных шейдера
        this.mesh.material.uniforms.sunPosition.value.set(sunPos.x, sunPos.y);
        this.mesh.material.uniforms.moonPosition.value.set(moonPos.x, moonPos.y);
        this.mesh.material.uniforms.sunIntensity.value = 
            parseFloat(document.getElementById('sunIntensity').value) / 100;
        this.mesh.material.uniforms.moonIntensity.value = 
            parseFloat(document.getElementById('moonIntensity').value) / 100;
        this.mesh.material.uniforms.sunRadius.value = 
            parseFloat(document.getElementById('sunRadius').value);
        this.mesh.material.uniforms.moonRadius.value = 
            parseFloat(document.getElementById('moonRadius').value);
    }

    /**
     * Получить яркость в конкретной точке поверхности
     * @param {number} x - Координата X
     * @param {number} y - Координата Y
     * @returns {number} Яркость от 0.0 до 1.0
     */
    getBrightnessAt(x, y) {
        const distToSun = Math.sqrt(
            Math.pow(x - this.sunPosition.x, 2) + 
            Math.pow(y - this.sunPosition.y, 2)
        );
        const distToMoon = Math.sqrt(
            Math.pow(x - this.moonPosition.x, 2) + 
            Math.pow(y - this.moonPosition.y, 2)
        );
        
        const sunRadius = parseFloat(document.getElementById('sunRadius').value);
        const moonRadius = parseFloat(document.getElementById('moonRadius').value);
        
        let brightness = 0.1; // Базовая яркость
        
        if (distToSun < sunRadius) {
            const t = distToSun / sunRadius;
            brightness += (1.0 - t) * 0.9;
        }
        
        if (distToMoon < moonRadius) {
            const t = distToMoon / moonRadius;
            brightness += (1.0 - t * t) * 0.2;
        }
        
        return Math.min(brightness, 1.0);
    }

    /**
     * Получить положение подсолнечной точки
     * @returns {Object} {x, y, intensity}
     */
    getSunSubsolarPoint() {
        return {
            x: this.sunPosition.x,
            y: this.sunPosition.y,
            intensity: parseFloat(document.getElementById('sunIntensity').value) / 100
        };
    }

    /**
     * Получить положение подлунной точки
     * @returns {Object} {x, y, intensity}
     */
    getMoonSublunarPoint() {
        return {
            x: this.moonPosition.x,
            y: this.moonPosition.y,
            intensity: parseFloat(document.getElementById('moonIntensity').value) / 100
        };
    }

    /**
     * Экспорт состояния слоя для других слоёв
     * @returns {Object} Состояние слоя
     */
    exportState() {
        return {
            sunPosition: this.sunPosition,
            moonPosition: this.moonPosition,
            earthRadius: this.config.earthRadius,
            sunIntensity: this.mesh.material.uniforms.sunIntensity.value,
            moonIntensity: this.mesh.material.uniforms.moonIntensity.value,
            sunRadius: this.mesh.material.uniforms.sunRadius.value,
            moonRadius: this.mesh.material.uniforms.moonRadius.value
        };
    }

    /**
     * Обновление радиуса Земли
     * @param {number} newRadius - Новый радиус в км
     */
    updateEarthRadius(newRadius) {
        this.config.earthRadius = newRadius;
        this.scene.remove(this.mesh);
        this.createSurface();
    }
}
