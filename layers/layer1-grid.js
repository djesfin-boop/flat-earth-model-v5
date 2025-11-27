/**
 * Layer 1: Grid Layer - Проекция Глисона (равнорасстояний азимутальная)
 * Азимутальная сетка координат, города, видимые линии
 * ОПТИМИЗИРОВАНО: переиспользование материалов/геометрий, кэширование текстур
 */

class GridLayer {
    // ========== Статические/переиспользуемые ресурсы ==========
    static lineMaterial = null;
    static cityMaterial = null;
    static cityMarkerGeometry = null;
    static labelTextureCache = new Map();

    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.gridGroup = new THREE.Group();
        this.gridEnabled = false;
        
        // Инициализация переиспользуемых ресурсов (один раз)
        this.initSharedResources();
        
        this.scene.add(this.gridGroup);
        this.createGrid();
    }

    initSharedResources() {
        // Общий материал для линий сетки
        if (!GridLayer.lineMaterial) {
            GridLayer.lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x4488ff, 
                linewidth: 2,
                fog: false
            });
        }
        
        // Общий материал для маркеров городов
        if (!GridLayer.cityMaterial) {
            GridLayer.cityMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff4444,
                transparent: true,
                opacity: 0.9,
                fog: false
            });
        }
        
        // Общая геометрия для маркеров городов
        if (!GridLayer.cityMarkerGeometry) {
            GridLayer.cityMarkerGeometry = new THREE.CircleGeometry(400, 16);
        }
    }

    // Проекция Глисона: latitude → distance_from_center
    gleasonProject(latitudeDeg, longitudeDeg) {
        const R = this.config.earthRadius;
        
        // phi = угол от полюса в радианах
        const phi = (90 - latitudeDeg) * Math.PI / 180;
        
        // distance = R * phi / (π/2) — равнорасстояний проекция Глисона
        const distance = R * (phi / (Math.PI / 2));
        
        // theta = долгота в радианах
        const theta = longitudeDeg * Math.PI / 180;
        
        // Декартовы координаты на плоскости
        const x = distance * Math.sin(theta);
        const z = distance * Math.cos(theta);
        
        return { x, z, distance };
    }

    createGrid() {
        const R = this.config.earthRadius;
        const latStep = this.config.gridLatStep || 10;
        const lonStep = this.config.gridLonStep || 30;
        const latSegmentStep = this.config.gridLatSegmentStep || 3;
        const lonSegmentStep = this.config.gridLonSegmentStep || 2;

        // ========== ЛИНИИ ШИРОТЫ (параллели) — объединённая геометрия ==========
        const latPoints = [];
        const latIndices = [];
        let latIndex = 0;

        for (let lat = 0; lat <= 90; lat += latStep) {
            const startIndex = latIndex;
            
            for (let lon = 0; lon <= 360; lon += latSegmentStep) {
                const proj = this.gleasonProject(lat, lon);
                latPoints.push(proj.x, 8, proj.z);
                
                if (lon > 0) {
                    latIndices.push(latIndex - 1, latIndex);
                }
                latIndex++;
            }
            
            // Подпись широты
            if (lat > 0 && lat < 90) {
                const proj = this.gleasonProject(lat, 0);
                this.addLabel(`${lat}°`, proj.x + 1200, proj.z, 0x4488ff, 256, 64);
            }
        }

        const latGeometry = new THREE.BufferGeometry();
        latGeometry.setAttribute('position', new THREE.Float32BufferAttribute(latPoints, 3));
        latGeometry.setIndex(latIndices);
        const latLines = new THREE.LineSegments(latGeometry, GridLayer.lineMaterial);
        this.gridGroup.add(latLines);

        // ========== ЛИНИИ ДОЛГОТЫ (меридианы) — объединённая геометрия ==========
        const lonPoints = [];
        const lonIndices = [];
        let lonIndex = 0;

        for (let lon = 0; lon < 360; lon += lonStep) {
            for (let lat = 0; lat <= 90; lat += lonSegmentStep) {
                const proj = this.gleasonProject(lat, lon);
                lonPoints.push(proj.x, 8, proj.z);
                
                if (lat > 0) {
                    lonIndices.push(lonIndex - 1, lonIndex);
                }
                lonIndex++;
            }
        }

        const lonGeometry = new THREE.BufferGeometry();
        lonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lonPoints, 3));
        lonGeometry.setIndex(lonIndices);
        const lonLines = new THREE.LineSegments(lonGeometry, GridLayer.lineMaterial);
        this.gridGroup.add(lonLines);

        // ========== ГОРОДА ==========
        const cities = [
            { name: "Москва", lat: 55.75, lon: 37.62 },
            { name: "Лондон", lat: 51.51, lon: -0.13 },
            { name: "Нью-Йорк", lat: 40.71, lon: -74.01 },
            { name: "Лос-Анджелес", lat: 34.05, lon: -118.24 },
            { name: "Сидней", lat: -33.87, lon: 151.21 },
            { name: "Кейптаун", lat: -33.93, lon: 18.42 },
            { name: "Рейкьявик", lat: 64.15, lon: -21.95 },
            { name: "Баренцбург", lat: 74.50, lon: 19.00 },
        ];

        cities.forEach(city => {
            const proj = this.gleasonProject(city.lat, city.lon);
            
            // Проверка: точка в пределах диска
            if (proj.distance <= R) {
                // Маркер города (переиспользуем геометрию и материал)
                const cityMarker = new THREE.Mesh(
                    GridLayer.cityMarkerGeometry, 
                    GridLayer.cityMaterial
                );
                cityMarker.position.set(proj.x, 12, proj.z);
                cityMarker.rotation.x = -Math.PI / 2;
                this.gridGroup.add(cityMarker);

                // Подпись города
                this.addLabel(
                    `${city.name}\n${city.lat.toFixed(1)}°,${city.lon.toFixed(1)}°`,
                    proj.x + 600,
                    proj.z,
                    0xff4444,
                    512,
                    128
                );
            }
        });

        this.hideGrid();
    }

    // Оптимизированное создание подписей с кэшированием текстур
    addLabel(text, x, z, color, canvasWidth = 512, canvasHeight = 128) {
        const cacheKey = `${text}_${color}_${canvasWidth}_${canvasHeight}`;
        
        let texture = GridLayer.labelTextureCache.get(cacheKey);
        
        if (!texture) {
            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            
            ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
            ctx.font = 'bold 28px Arial';
            
            // Поддержка многострочного текста
            const lines = text.split('\n');
            lines.forEach((line, i) => {
                ctx.fillText(line, 20, 40 + i * 32);
            });
            
            texture = new THREE.CanvasTexture(canvas);
            GridLayer.labelTextureCache.set(cacheKey, texture);
        }
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            fog: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x, 15, z);
        
        // Масштаб пропорционален размеру canvas
        const scale = canvasWidth / 512;
        sprite.scale.set(400 * scale, 120 * (canvasHeight / 128), 1);
        
        this.gridGroup.add(sprite);
    }

    toggleGrid() {
        this.gridEnabled = !this.gridEnabled;
        if (this.gridEnabled) {
            this.showGrid();
        } else {
            this.hideGrid();
        }
        return this.gridEnabled;
    }

    showGrid() {
        this.gridGroup.visible = true;
    }

    hideGrid() {
        this.gridGroup.visible = false;
    }

    isGridEnabled() {
        return this.gridEnabled;
    }

    // Очистка ресурсов при уничтожении слоя
    dispose() {
        this.gridGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });
        this.scene.remove(this.gridGroup);
    }

    // Статический метод для очистки кэша (при необходимости)
    static clearCache() {
        GridLayer.labelTextureCache.forEach(texture => texture.dispose());
        GridLayer.labelTextureCache.clear();
        
        if (GridLayer.lineMaterial) {
            GridLayer.lineMaterial.dispose();
            GridLayer.lineMaterial = null;
        }
        if (GridLayer.cityMaterial) {
            GridLayer.cityMaterial.dispose();
            GridLayer.cityMaterial = null;
        }
        if (GridLayer.cityMarkerGeometry) {
            GridLayer.cityMarkerGeometry.dispose();
            GridLayer.cityMarkerGeometry = null;
        }
    }
}

export default GridLayer;
