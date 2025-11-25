/**
 * Layer 1: Grid Layer - Проекция Глисона (равнорасстояний азимутальная)
 * Азимутальная сетка координат, города, видимые линии
 */

class GridLayer {
    constructor(scene, config) {
        this.scene = scene;
        this.config = config;
        this.gridGroup = new THREE.Group();
        this.gridEnabled = false;
        
        this.scene.add(this.gridGroup);
        this.createGrid();
    }

    // Проекция Глисона: latitude → distance_from_center
    gleasonProject(latitudeDeg, longitudeDeg) {
        const R = this.config.earthRadius;
        
        // Преобразуем географические координаты в полярные координаты на диске
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
        const latStep = 10;
        const lonStep = 30;

        // Ярко видимые линии
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0x4488ff, 
            linewidth: 2,
            fog: false
        });

        // ========== ЛИНИИ ШИРОТЫ (параллели) ==========
        for (let lat = 0; lat <= 90; lat += latStep) {
            const points = [];
            
            for (let lon = 0; lon <= 360; lon += 3) {
                const proj = this.gleasonProject(lat, lon);
                points.push(new THREE.Vector3(proj.x, 8, proj.z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.gridGroup.add(line);

            // Подпись широты
            if (lat > 0 && lat < 90) {
                const proj = this.gleasonProject(lat, 0);
                this.addLabel(`${lat}°`, proj.x + 1200, proj.z, 0x4488ff);
            }
        }

        // ========== ЛИНИИ ДОЛГОТЫ (меридианы) ==========
        for (let lon = 0; lon < 360; lon += lonStep) {
            const points = [];
            
            for (let lat = 0; lat <= 90; lat += 2) {
                const proj = this.gleasonProject(lat, lon);
                points.push(new THREE.Vector3(proj.x, 8, proj.z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.gridGroup.add(line);
        }

        // ========== ГОРОДА ==========
        const cities = [
            { name: "Москва", lat: 55.75, lon: 37.62 },
            { name: "Лондон", lat: 51.51, lon: -0.13 },
            { name: "Нью-Йорк", lat: 40.71, lon: -74.01 },
            { name: "Лос-Анджелес", lat: 34.05, lon: -118.24 },
            { name: "Сидней", lat: -33.87, lon: 151.21 },
            { name: "Кейптаун", lat: -33.93, lon: 18.42 },
            { name: "Райккавик", lat: 64.15, lon: -21.95 },
            { name: "Барренцбург", lat: 74.50, lon: 19.00 },
        ];

        // Маркеры городов
        const cityMarkerGeometry = new THREE.CircleGeometry(400, 16);
        
        cities.forEach(city => {
            const proj = this.gleasonProject(city.lat, city.lon);

            // Проверка: точка в пределах диска
            if (proj.distance <= R) {
                // Красная точка
                const cityMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xff4444,
                    transparent: true,
                    opacity: 0.9,
                    fog: false
                });
                const cityMarker = new THREE.Mesh(cityMarkerGeometry, cityMaterial);
                cityMarker.position.set(proj.x, 12, proj.z);
                cityMarker.rotation.x = -Math.PI / 2;
                this.gridGroup.add(cityMarker);

                // Подпись города
                this.addLabel(
                    `${city.name}\n${city.lat.toFixed(1)}°,${city.lon.toFixed(1)}°`,
                    proj.x + 600,
                    proj.z,
                    0xff4444
                );
            }
        });

        this.hideGrid();
    }

    addLabel(text, x, z, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.font = 'bold 28px Arial';
        ctx.fillText(text, 20, 60);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            fog: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.set(x, 15, z);
        sprite.scale.set(400, 120, 1);
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
}

export default GridLayer;
