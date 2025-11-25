/**
 * Layer 1: Grid Layer - Азимутальная сетка координат и города
 * Отображает широты, долготы и названия городов для проверки модели
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

    createGrid() {
        // Параметры сетки
        const R = this.config.earthRadius;
        const latStep = 10;    // каждые 10 градусов широты
        const lonStep = 30;    // каждые 30 градусов долготы

        // Материал для линий
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x444466, linewidth: 1 });
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0x88aaff });

        // Линии широты (параллели)
        for (let lat = 0; lat <= 90; lat += latStep) {
            const phi = (90 - lat) * Math.PI / 180;
            const r = R * (phi / (Math.PI / 2));
            
            const points = [];
            for (let lon = 0; lon <= 360; lon += 5) {
                const theta = lon * Math.PI / 180;
                const x = r * Math.sin(theta);
                const z = r * Math.cos(theta);
                points.push(new THREE.Vector3(x, 5, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.gridGroup.add(line);

            // Подпись широты
            if (lat > 0 && lat < 90) {
                const labelLon = 0;
                const theta = labelLon * Math.PI / 180;
                const x = r * Math.sin(theta);
                const z = r * Math.cos(theta);
                
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 64;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#88aaff';
                ctx.font = 'bold 24px Arial';
                ctx.fillText(`${lat}°`, 10, 40);
                
                const texture = new THREE.CanvasTexture(canvas);
                const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
                const sprite = new THREE.Sprite(spriteMaterial);
                sprite.position.set(x + 1000, 10, z);
                sprite.scale.set(200, 50, 1);
                this.gridGroup.add(sprite);
            }
        }

        // Линии долготы (меридианы)
        for (let lon = 0; lon < 360; lon += lonStep) {
            const points = [];
            for (let lat = 0; lat <= 90; lat += 2) {
                const phi = (90 - lat) * Math.PI / 180;
                const r = R * (phi / (Math.PI / 2));
                const theta = lon * Math.PI / 180;
                const x = r * Math.sin(theta);
                const z = r * Math.cos(theta);
                points.push(new THREE.Vector3(x, 5, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            this.gridGroup.add(line);
        }

        // Города
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
        const cityMarkerGeometry = new THREE.CircleGeometry(300, 16);
        
        cities.forEach(city => {
            const phi = (90 - city.lat) * Math.PI / 180;
            const r = R * (phi / (Math.PI / 2));
            const theta = city.lon * Math.PI / 180;
            const x = r * Math.sin(theta);
            const z = r * Math.cos(theta);

            // Точка города
            const cityMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff6b6b,
                transparent: true,
                opacity: 0.8
            });
            const cityMarker = new THREE.Mesh(cityMarkerGeometry, cityMaterial);
            cityMarker.position.set(x, 10, z);
            cityMarker.rotation.x = -Math.PI / 2;
            this.gridGroup.add(cityMarker);

            // Подпись города
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 64;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ff6b6b';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(city.name, 10, 40);
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '14px Arial';
            ctx.fillText(`${city.lat.toFixed(1)}°,${city.lon.toFixed(1)}°`, 10, 55);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(x, 20, z);
            sprite.scale.set(300, 100, 1);
            this.gridGroup.add(sprite);
        });

        this.hideGrid();
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
