class TrailTracker {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.currentTrail = [];
        this.currentTrailPolyline = null;
        this.isRecording = false;
        this.watchId = null;
        
        // Cache DOM elements
        this.dom = {
            recordBtn: document.getElementById('recordBtn'),
            saveBtn: document.getElementById('saveBtn'),
            trailsBtn: document.getElementById('trailsBtn'),
            saveModal: document.getElementById('saveModal'),
            trailNameInput: document.getElementById('trailName'),
            trailDescriptionInput: document.getElementById('trailDescription'),
            trailsModal: document.getElementById('trailsModal'),
            trailsListContainer: document.getElementById('trailsList'),
            statusDisplay: document.getElementById('status'),
        };
        
        this.savedTrails = this.loadTrails(); // Load trails and ensure IDs are strings
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
        this.dom.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.dom.saveBtn.addEventListener('click', () => this.showSaveModal());
        this.dom.trailsBtn.addEventListener('click', () => this.showTrailsModal());
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

        if (!this.userMarker) {
            this.userMarker = L.marker([lat, lng]).addTo(this.map);
            this.map.setView([lat, lng], 16);
        } else {
            this.userMarker.setLatLng([lat, lng]);
        }

        this.updateStatus(`Accuracy: ${Math.round(accuracy)}m`);

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
        if (!this.isRecording) {
            this.startRecording();
            this.dom.recordBtn.textContent = 'Stop Recording';
            this.dom.recordBtn.classList.add('recording');
            this.dom.saveBtn.style.display = 'block';
        } else {
            this.stopRecording();
            this.dom.recordBtn.textContent = 'Start Recording';
            this.dom.recordBtn.classList.remove('recording');
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
        this.dom.saveModal.style.display = 'flex';
        this.dom.trailNameInput.focus();
    }

    saveTrail() {
        const name = this.dom.trailNameInput.value.trim();
        const description = this.dom.trailDescriptionInput.value.trim();

        if (!name) {
            alert('Please enter a trail name');
            return;
        }

        const trail = {
            id: String(Date.now()), // Ensure ID is a string
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
        this.dom.saveBtn.style.display = 'none';
        this.dom.recordBtn.textContent = 'Start Recording';
        this.dom.recordBtn.classList.remove('recording');
        this.isRecording = false;
    }

    showTrailsModal() {
        this.renderTrailsList();
        this.dom.trailsModal.style.display = 'flex';
    }

    renderTrailsList() {
        const container = this.dom.trailsListContainer;
        container.innerHTML = '';

        if (this.savedTrails.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #aaa;">No saved trails</p>';
            return;
        }
        
        // Sort by creation date, newest first
        const sortedTrails = [...this.savedTrails].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        sortedTrails.forEach(trail => {
            // trail.id is now guaranteed to be a string
            const isDisplayed = this.displayedTrails.has(trail.id);
            const item = document.createElement('div');
            item.className = 'trail-item';
            item.innerHTML = `
                <div class="trail-info">
                    <h4>${trail.name}</h4>
                    <small>${new Date(trail.createdAt).toLocaleDateString()} • ${Math.round(trail.distance)}m • ${trail.points.length} points</small>
                    ${trail.description ? `<div style="margin-top: 5px; color: #ccc; font-size: 0.9em;">${trail.description}</div>` : ''}
                </div>
                <div class="trail-actions">
                    <button class="btn btn-small" style="background: ${isDisplayed ? '#ff4757' : '#5352ed'};" onclick="app.showTrail('${trail.id}')">${isDisplayed ? 'Hide' : 'Show'}</button>
                    <button class="btn btn-small" style="background: #ff4757;" onclick="app.deleteTrail('${trail.id}')">Delete</button>
                </div>
            `;
            container.appendChild(item);
        });
    }

    showTrail(trailId) { // trailId is a string from onclick attribute
        const trail = this.savedTrails.find(t => t.id === trailId); // t.id is string, trailId is string
        if (!trail) return;

        if (this.displayedTrails.has(trailId)) {
            this.map.removeLayer(this.displayedTrails.get(trailId));
            this.displayedTrails.delete(trailId);
            this.renderTrailsList(); // Update button states in the modal
            return;
        }

        const latlngs = trail.points.map(point => [point.lat, point.lng]);
        const polyline = L.polyline(latlngs, {
            color: '#2ed573',
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);

        this.displayedTrails.set(trailId, polyline);
        this.map.fitBounds(polyline.getBounds());
        this.renderTrailsList(); // Update button states in the modal
        this.closeTrailsModal(); // Close modal after showing trail on map
    }

    deleteTrail(trailId) { // trailId is a string
        if (confirm('Are you sure you want to delete this trail?')) {
            this.savedTrails = this.savedTrails.filter(t => t.id !== trailId); // t.id is string
            this.saveTrails();
            
            if (this.displayedTrails.has(trailId)) {
                this.map.removeLayer(this.displayedTrails.get(trailId));
                this.displayedTrails.delete(trailId);
            }
            
            this.renderTrailsList();
        }
    }

    loadTrails() {
        const saved = localStorage.getItem('gpsTrails');
        try {
            const trails = saved ? JSON.parse(saved) : [];
            // Ensure trails are objects, have an id, and convert id to string for consistency
            return trails
                .filter(trail => typeof trail === 'object' && trail !== null && 'id' in trail)
                .map(trail => ({ ...trail, id: String(trail.id) }));
        } catch (e) {
            console.error("Error parsing saved trails:", e);
            localStorage.removeItem('gpsTrails'); // Clear corrupted data
            return [];
        }
    }

    saveTrails() {
        localStorage.setItem('gpsTrails', JSON.stringify(this.savedTrails));
    }

    updateStatus(message) {
        this.dom.statusDisplay.textContent = message;
    }

    closeSaveModal() {
        this.dom.saveModal.style.display = 'none';
        this.dom.trailNameInput.value = '';
        this.dom.trailDescriptionInput.value = '';
    }

    closeTrailsModal() {
        this.dom.trailsModal.style.display = 'none';
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