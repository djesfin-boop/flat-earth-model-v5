/**
 * Layer 1: Grid Layer - Проекция Глисона (равнорасстояния азимутальная)
 * Азимутальная сетка координат, города, видимые линии
 * Система выбора городов: включение/отключение через панель управления
 */
class GridLayer {
 static lineMaterial = null;
 static cityMaterial = null;
 static cityMarkerGeometry = null;
 static labelTextureCache = new Map();
 static citiesData = [
 { id: 'moscow', name: 'Москва', lat: 55.75, lon: 37.62, color: 0xff4444, enabled: true },
 { id: 'london', name: 'Лондон', lat: 51.51, lon: -0.13, color: 0xff6644, enabled: true },
 { id: 'newyork', name: 'Нью-Йорк', lat: 40.71, lon: -74.01, color: 0xff8844, enabled: true },
 { id: 'sydey', name: 'Сидней', lat: -33.87, lon: 151.21, color: 0xffaa44, enabled: true },
 { id: 'capetown', name: 'Кейптаун', lat: -33.93, lon: 18.42, color: 0xffcc44, enabled: true },
 { id: 'reykjavik', name: 'Рейкьявик', lat: 64.15, lon: -21.95, color: 0xffee44, enabled: true }
 ];

 constructor(scene, config) {
 this.scene = scene;
 this.config = config;
 this.gridGroup = new THREE.Group();
 this.gridEnabled = false;
 this.cities = new Map();
 this.cityMarkers = new Map();

 this.initSharedResources();
 this.scene.add(this.gridGroup);
 this.createGrid();
 }

 initSharedResources() {
 if (!GridLayer.lineMaterial) {
 GridLayer.lineMaterial = new THREE.LineBasicMaterial({
 color: 0x4488ff,
 linewidth: 2,
 fog: false
 });
 }

 if (!GridLayer.cityMaterial) {
 GridLayer.cityMaterial = new THREE.MeshBasicMaterial({
 color: 0xff4444,
 transparent: true,
 opacity: 0.9,
 fog: false
 });
 }

 if (!GridLayer.cityMarkerGeometry) {
 GridLayer.cityMarkerGeometry = new THREE.CircleGeometry(400, 16);
 }
 }

 gleasonProject(latitudeDeg, longitudeDeg) {
 const R = this.config.earthRadius;
 const phi = (90 - latitudeDeg) * Math.PI / 180;
 const distance = R * (phi / (Math.PI / 2));
 const theta = longitudeDeg * Math.PI / 180;
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

 // ЛИНИИ ШИРОТЫ
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

 // ЛИНИИ ДОЛГОТЫ
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

 // ГОРОДА
 this.addCities();
 this.hideGrid();
 }

 addCities() {
 GridLayer.citiesData.forEach(cityData => {
 const proj = this.gleasonProject(cityData.lat, cityData.lon);
 if (proj.distance <= this.config.earthRadius) {
 this.cities.set(cityData.id, { ...cityData, proj });
 this.createCityMarker(cityData.id);
 }
 });
 }

 createCityMarker(cityId) {
 const cityData = this.cities.get(cityId);
 if (!cityData) return;

 const material = new THREE.MeshBasicMaterial({
 color: cityData.color,
 transparent: true,
 opacity: 0.9,
 fog: false
 });

 const marker = new THREE.Mesh(GridLayer.cityMarkerGeometry, material);
 marker.position.set(cityData.proj.x, 12, cityData.proj.z);
 marker.rotation.x = -Math.PI / 2;
 marker.userData = { cityId };

 this.gridGroup.add(marker);
 this.cityMarkers.set(cityId, marker);

 this.addLabel(
 `${cityData.name}\n${cityData.lat.toFixed(1)}°,${cityData.lon.toFixed(1)}°`,
 cityData.proj.x + 600,
 cityData.proj.z,
 cityData.color,
 512,
 128
 );
 }

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
 const lines = text.split('\n');
 lines.forEach((line, i) => {
 ctx.fillText(line, 20, 40 + i * 32);
 });

 texture = new THREE.CanvasTexture(canvas);
 GridLayer.labelTextureCache.set(cacheKey, texture);
 }

 const spriteMaterial = new THREE.SpriteMaterial({ map: texture, fog: false });
 const sprite = new THREE.Sprite(spriteMaterial);
 sprite.position.set(x, 15, z);
 const scale = canvasWidth / 512;
 sprite.scale.set(400 * scale, 120 * (canvasHeight / 128), 1);
 this.gridGroup.add(sprite);
 }

 toggleCityVisibility(cityId) {
 const marker = this.cityMarkers.get(cityId);
 if (marker) {
 marker.visible = !marker.visible;
 const cityData = this.cities.get(cityId);
 if (cityData) {
 cityData.enabled = marker.visible;
 }
 }
 }

 setCityVisibility(cityId, visible) {
 const marker = this.cityMarkers.get(cityId);
 if (marker) {
 marker.visible = visible;
 const cityData = this.cities.get(cityId);
 if (cityData) {
 cityData.enabled = visible;
 }
 }
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

 getCities() {
 return Array.from(this.cities.values());
 }

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
