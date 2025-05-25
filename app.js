class TrailTracker {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.currentTrail = [];
        this.currentTrailPolyline = null;
        this.isRecording = false;
        this.watchId = null;
        this.savedTrails = this.loadTrails();
        this.displayedTrails = new Map();
        
        this.initMap();
        this.setupEventListeners();
        this.startLocationTracking();
    }

    initMap() {
        this.map = L.map('map').setView([0, 0], 16);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: ' OpenStreetMap contributors'
        }).addTo(this.map);
    }

    setupEventListeners() {
        document.getElementById('recordBtn').addEventListener('click', () => this.toggleRecording());
        document.getElementById('saveBtn').addEventListener('click', () => this.showSaveModal());
        document.getElementById('trailsBtn').addEventListener('click', () => this.showTrailsModal());
    }

    startLocationTracking() {
        if (!navigator.geolocation) {
            this.updateStatus('Geolocation not supported');
            return;
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => this.handleLocationError(error),
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 1000
            }
        );
    }

    handleLocationUpdate(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        // Update user marker
        if (!this.userMarker) {
            this.userMarker = L.marker([lat, lng]).addTo(this.map);
            this.map.setView([lat, lng], 16);
        } else {
            this.userMarker.setLatLng([lat, lng]);
        }

        this.updateStatus(`Accuracy: ${Math.round(accuracy)}m`);

        // Add to current trail if recording
        if (this.isRecording) {
            const point = {
                lat,
                lng,
                timestamp: Date.now(),
                accuracy
            };
            
            this.currentTrail.push(point);
            this.updateCurrentTrailDisplay();
        }
    }

    handleLocationError(error) {
        let message = 'Location error: ';
        switch(error.code) {
            case error.PERMISSION_DENIED:
                message += 'Permission denied';
                break;
            case error.POSITION_UNAVAILABLE:
                message += 'Position unavailable';
                break;
            case error.TIMEOUT:
                message += 'Timeout';
                break;
            default:
                message += 'Unknown error';
                break;
        }
        this.updateStatus(message);
    }

    toggleRecording() {
        const btn = document.getElementById('recordBtn');
        const saveBtn = document.getElementById('saveBtn');

        if (!this.isRecording) {
            this.startRecording();
            btn.textContent = 'Stop Recording';
            btn.classList.add('recording');
            saveBtn.style.display = 'block';
        } else {
            this.stopRecording();
            btn.textContent = 'Start Recording';
            btn.classList.remove('recording');
        }
    }

    startRecording() {
        this.isRecording = true;
        this.currentTrail = [];
        this.updateStatus('Recording trail...');
    }

    stopRecording() {
        this.isRecording = false;
        this.updateStatus(`Trail recorded: ${this.currentTrail.length} points`);
    }

    updateCurrentTrailDisplay() {
        if (this.currentTrailPolyline) {
            this.map.removeLayer(this.currentTrailPolyline);
        }

        if (this.currentTrail.length > 1) {
            const latlngs = this.currentTrail.map(point => [point.lat, point.lng]);
            this.currentTrailPolyline = L.polyline(latlngs, {
                color: '#ff4757',
                weight: 4,
                opacity: 0.8
            }).addTo(this.map);
        }
    }

    showSaveModal() {
        if (this.currentTrail.length === 0) {
            alert('No trail data to save');
            return;
        }
        document.getElementById('saveModal').style.display = 'flex';
        document.getElementById('trailName').focus();
    }

    saveTrail() {
        const name = document.getElementById('trailName').value.trim();
        const description = document.getElementById('trailDescription').value.trim();

        if (!name) {
            alert('Please enter a trail name');
            return;
        }

        const trail = {
            id: Date.now(),
            name,
            description,
            points: this.currentTrail,
            createdAt: new Date().toISOString(),
            distance: this.calculateDistance(this.currentTrail)
        };

        this.savedTrails.push(trail);
        this.saveTrails();
        this.closeSaveModal();
        this.clearCurrentTrail();
        this.updateStatus(`Trail "${name}" saved!`);
    }

    calculateDistance(points) {
        if (points.length < 2) return 0;
        
        let distance = 0;
        for (let i = 1; i < points.length; i++) {
            distance += this.getDistanceBetweenPoints(
                points[i - 1].lat, points[i - 1].lng,
                points[i].lat, points[i].lng
            );
        }
        return distance;
    }

    getDistanceBetweenPoints(lat1, lng1, lat2, lng2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lng2-lng1) * Math.PI/180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    clearCurrentTrail() {
        this.currentTrail = [];
        if (this.currentTrailPolyline) {
            this.map.removeLayer(this.currentTrailPolyline);
            this.currentTrailPolyline = null;
        }
        document.getElementById('saveBtn').style.display = 'none';
        document.getElementById('recordBtn').textContent = 'Start Recording';
        document.getElementById('recordBtn').classList.remove('recording');
        this.isRecording = false;
    }

    showTrailsModal() {
        this.renderTrailsList();
        document.getElementById('trailsModal').style.display = 'flex';
    }

    renderTrailsList() {
        const container = document.getElementById('trailsList');
        container.innerHTML = '';

        if (this.savedTrails.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #aaa;">No saved trails</p>';
            return;
        }

        this.savedTrails.forEach(trail => {
            const isDisplayed = this.displayedTrails.has(trail.id);
            const item = document.createElement('div');
            item.className = 'trail-item';
            item.innerHTML = `
                <div class="trail-info">
                    <h4>${trail.name}</h4>
                    <small>${new Date(trail.createdAt).toLocaleDateString()} • ${Math.round(trail.distance)}m • ${trail.points.length} points</small>
                    ${trail.description ? `<div style="margin-top: 5px; color: #ccc;">${trail.description}</div>` : ''}
                </div>
                <div class="trail-actions">
                    <button class="btn btn-small" style="background: ${isDisplayed ? '#ff9500' : '#5352ed'};" onclick="app.showTrail('${trail.id}')">${isDisplayed ? 'Hide' : 'Show'}</button>
                    <button class="btn btn-small" style="background: #ff4757;" onclick="app.deleteTrail('${trail.id}')">Delete</button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    showTrail(trailId) {
        const trail = this.savedTrails.find(t => t.id == trailId);
        if (!trail) return;

        // Remove previously displayed trail if exists
        if (this.displayedTrails.has(trailId)) {
            this.map.removeLayer(this.displayedTrails.get(trailId));
            this.displayedTrails.delete(trailId);
            this.renderTrailsList(); // Update button states
            return;
        }

        // Display the trail
        const latlngs = trail.points.map(point => [point.lat, point.lng]);
        const polyline = L.polyline(latlngs, {
            color: '#2ed573',
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);

        this.displayedTrails.set(trailId, polyline);
        this.map.fitBounds(polyline.getBounds());
        this.renderTrailsList(); // Update button states
        this.closeTrailsModal();
    }

    deleteTrail(trailId) {
        if (confirm('Are you sure you want to delete this trail?')) {
            this.savedTrails = this.savedTrails.filter(t => t.id != trailId);
            this.saveTrails();
            
            // Remove from map if displayed
            if (this.displayedTrails.has(trailId)) {
                this.map.removeLayer(this.displayedTrails.get(trailId));
                this.displayedTrails.delete(trailId);
            }
            
            this.renderTrailsList();
        }
    }

    loadTrails() {
        const saved = localStorage.getItem('gpsTrails');
        return saved ? JSON.parse(saved) : [];
    }

    saveTrails() {
        localStorage.setItem('gpsTrails', JSON.stringify(this.savedTrails));
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    closeSaveModal() {
        document.getElementById('saveModal').style.display = 'none';
        document.getElementById('trailName').value = '';
        document.getElementById('trailDescription').value = '';
    }

    closeTrailsModal() {
        document.getElementById('trailsModal').style.display = 'none';
    }
}

// Global functions for modal buttons
function closeSaveModal() {
    app.closeSaveModal();
}

function closeTrailsModal() {
    app.closeTrailsModal();
}

function saveTrail() {
    app.saveTrail();
}

// Initialize the app
const app = new TrailTracker();