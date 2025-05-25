class TrailTracker {
    constructor() {
        this.map = null;
        this.userMarker = null;
        this.currentTrail = [];
        this.currentTrailPolyline = null;
        this.isRecording = false;
        this.watchId = null;
        this.currentTrailPhotos = []; // To store photos for the current trail
        this.photoMarkersOnMap = new Map(); // To manage photo markers on the map: trailId -> [L.Marker]
        this.photoIcon = null; // Leaflet icon for photo markers
        this.videoStream = null; // To store the camera stream
        
        // Cache DOM elements
        this.dom = {
            recordBtn: document.getElementById('recordBtn'),
            saveBtn: document.getElementById('saveBtn'),
            trailsBtn: document.getElementById('trailsBtn'),
            cameraBtn: document.getElementById('cameraBtn'), // New camera button
            saveModal: document.getElementById('saveModal'),
            trailNameInput: document.getElementById('trailName'),
            trailDescriptionInput: document.getElementById('trailDescription'),
            trailsModal: document.getElementById('trailsModal'),
            trailsListContainer: document.getElementById('trailsList'),
            statusDisplay: document.getElementById('status'),
            cameraModal: document.getElementById('cameraModal'), // New camera modal
            cameraFeed: document.getElementById('cameraFeed'), // Video element
            photoCanvas: document.getElementById('photoCanvas'), // Canvas for photo capture
            capturePhotoBtn: document.getElementById('capturePhotoBtn'),
            cancelCameraBtn: document.getElementById('cancelCameraBtn'),
            photoViewModal: document.getElementById('photoViewModal'), // Photo view modal
            photoDisplay: document.getElementById('photoDisplay'), // Img element for photo
            closePhotoViewBtn: document.getElementById('closePhotoViewBtn'),
        };
        
        this.savedTrails = this.loadTrails();
        this.displayedTrails = new Map();
        
        this.initMap();
        this.initPhotoIcon();
        this.setupEventListeners();
        this.startLocationTracking();
    }

    initMap() {
        this.map = L.map('map').setView([0, 0], 16);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: ' OpenStreetMap contributors'
        }).addTo(this.map);
    }

    initPhotoIcon() {
        this.photoIcon = L.icon({
            iconUrl: 'photo-location-icon.png',
            iconSize: [25, 25], // size of the icon
            iconAnchor: [12, 12], // point of the icon which will correspond to marker's location
            popupAnchor: [0, -12] // point from which the popup should open relative to the iconAnchor
        });
    }

    setupEventListeners() {
        this.dom.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.dom.saveBtn.addEventListener('click', () => this.showSaveModal());
        this.dom.trailsBtn.addEventListener('click', () => this.showTrailsModal());
        this.dom.cameraBtn.addEventListener('click', () => this.openCamera());
        this.dom.capturePhotoBtn.addEventListener('click', () => this.takePicture());
        this.dom.cancelCameraBtn.addEventListener('click', () => this.closeCamera());
        this.dom.closePhotoViewBtn.addEventListener('click', () => this.closePhotoViewModal());
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
        this.updateCameraBtnVisibility();
    }

    startRecording() {
        this.isRecording = true;
        this.currentTrail = [];
        this.currentTrailPhotos = []; // Reset photos for new trail
        this.updateStatus('Recording trail...');
        this.updateCameraBtnVisibility();
    }

    stopRecording() {
        this.isRecording = false;
        this.updateStatus(`Trail recorded: ${this.currentTrail.length} points, ${this.currentTrailPhotos.length} photos`);
        this.updateCameraBtnVisibility();
    }

    updateCameraBtnVisibility() {
        if (this.isRecording && this.userMarker) { // Only show if recording and location is known
            this.dom.cameraBtn.style.display = 'block';
        } else {
            this.dom.cameraBtn.style.display = 'none';
        }
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
            id: String(Date.now()),
            name,
            description,
            points: this.currentTrail,
            photos: this.currentTrailPhotos, // Add photos
            createdAt: new Date().toISOString(),
            distance: this.calculateDistance(this.currentTrail)
        };

        this.savedTrails.push(trail);
        this.saveTrails();
        this.closeSaveModal();
        this.clearCurrentTrail(); // This will also clear currentTrailPhotos
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
        this.currentTrailPhotos = []; // Clear photos
        if (this.currentTrailPolyline) {
            this.map.removeLayer(this.currentTrailPolyline);
            this.currentTrailPolyline = null;
        }
        this.dom.saveBtn.style.display = 'none';
        this.dom.recordBtn.textContent = 'Start Recording';
        this.dom.recordBtn.classList.remove('recording');
        this.isRecording = false;
        this.updateCameraBtnVisibility(); // Hide camera button
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
        
        const sortedTrails = [...this.savedTrails].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        sortedTrails.forEach(trail => {
            const isDisplayed = this.displayedTrails.has(trail.id);
            const photoCount = trail.photos ? trail.photos.length : 0;
            const item = document.createElement('div');
            item.className = 'trail-item';
            
            // Trail header for name and actions
            const header = document.createElement('div');
            header.className = 'trail-header';
            header.innerHTML = `
                <div class="trail-info">
                    <h4>${trail.name}</h4>
                    <small>${new Date(trail.createdAt).toLocaleDateString()} • ${Math.round(trail.distance)}m • ${trail.points.length} pts • ${photoCount} photos</small>
                </div>
                <div class="trail-actions">
                    <button class="btn btn-small" style="background: ${isDisplayed ? '#ff4757' : '#5352ed'};" onclick="app.showTrail('${trail.id}')">${isDisplayed ? 'Hide' : 'Show'}</button>
                    <button class="btn btn-small" style="background: #ff4757;" onclick="app.deleteTrail('${trail.id}')">Delete</button>
                </div>
            `;
            item.appendChild(header);

            // Trail description if it exists
            if (trail.description) {
                const descriptionDiv = document.createElement('div');
                descriptionDiv.className = 'trail-description';
                descriptionDiv.textContent = trail.description;
                item.appendChild(descriptionDiv);
            }
            
            container.appendChild(item);
        });
    }

    showTrail(trailId) {
        const trail = this.savedTrails.find(t => t.id === trailId);
        if (!trail) return;

        // Clear existing photo markers for this trail before potentially re-adding or removing
        this.clearPhotoMarkersForTrail(trailId);

        if (this.displayedTrails.has(trailId)) {
            this.map.removeLayer(this.displayedTrails.get(trailId));
            this.displayedTrails.delete(trailId);
            // Photo markers already cleared by clearPhotoMarkersForTrail
            this.renderTrailsList(); 
            return;
        }

        const latlngs = trail.points.map(point => [point.lat, point.lng]);
        const polyline = L.polyline(latlngs, {
            color: '#2ed573',
            weight: 3,
            opacity: 0.7
        }).addTo(this.map);

        this.displayedTrails.set(trailId, polyline);
        
        // Display photo markers
        if (trail.photos && trail.photos.length > 0) {
            const markers = [];
            trail.photos.forEach(photo => {
                if (photo.lat && photo.lng) {
                    const marker = L.marker([photo.lat, photo.lng], { icon: this.photoIcon })
                        .addTo(this.map)
                        .on('click', () => this.viewPhoto(photo.imageDataUrl));
                    markers.push(marker);
                }
            });
            this.photoMarkersOnMap.set(trailId, markers);
        }

        this.map.fitBounds(polyline.getBounds());
        this.renderTrailsList();
        this.closeTrailsModal();
    }

    clearPhotoMarkersForTrail(trailId) {
        if (this.photoMarkersOnMap.has(trailId)) {
            this.photoMarkersOnMap.get(trailId).forEach(marker => this.map.removeLayer(marker));
            this.photoMarkersOnMap.delete(trailId);
        }
    }

    deleteTrail(trailId) {
        if (confirm('Are you sure you want to delete this trail?')) {
            this.savedTrails = this.savedTrails.filter(t => t.id !== trailId);
            this.saveTrails();
            
            if (this.displayedTrails.has(trailId)) {
                this.map.removeLayer(this.displayedTrails.get(trailId));
                this.displayedTrails.delete(trailId);
            }
            this.clearPhotoMarkersForTrail(trailId); // Also remove photo markers
            
            this.renderTrailsList();
        }
    }

    loadTrails() {
        const saved = localStorage.getItem('gpsTrails');
        try {
            const trails = saved ? JSON.parse(saved) : [];
            return trails
                .filter(trail => typeof trail === 'object' && trail !== null && 'id' in trail)
                .map(trail => ({ 
                    ...trail, 
                    id: String(trail.id),
                    photos: trail.photos || [] // Ensure photos array exists
                }));
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

    openCamera() {
        if (!this.isRecording) {
            alert("Please start recording a trail first.");
            return;
        }
        if (!this.userMarker) {
            alert("Waiting for location data to take a photo.");
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Camera access is not supported by your browser.");
            this.updateStatus("Camera not supported");
            return;
        }

        navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment", // Prefer rear camera
                width: { ideal: 1280 }, 
                height: { ideal: 720 } 
            } 
        })
        .then(stream => {
            this.videoStream = stream;
            this.dom.cameraFeed.srcObject = this.videoStream;
            // Ensure autoplay is triggered if not already
            this.dom.cameraFeed.play().catch(e => console.warn("Video play interrupted:", e));
            this.dom.cameraModal.style.display = 'flex';
        })
        .catch(err => {
            console.error("Error accessing camera:", err);
            let userMessage = "Could not access camera. ";
            
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                userMessage += "Permission denied. Please grant camera permission in your browser settings.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                userMessage += "No camera found on this device.";
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError" || err.name === "SourceUnavailableError") {
                userMessage += "Camera is already in use, temporarily unavailable, or a hardware error occurred.";
            } else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
                 userMessage += "The camera doesn't support the requested settings (e.g., resolution).";
            } else if (err.name === "AbortError") {
                userMessage += "Camera access was aborted. This might be due to a browser or OS issue."
            }
            else {
                userMessage += `An unknown error occurred: ${err.name || "Unknown Error"}. Check console for details.`;
            }
            
            alert(userMessage);
            this.updateStatus("Camera error: " + (err.name || "Unknown"));
            this.closeCamera(); // Ensure modal is closed if it somehow opened
        });
    }

    closeCamera() {
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
            this.videoStream = null;
        }
        this.dom.cameraFeed.srcObject = null; // Clear the video source
        this.dom.cameraModal.style.display = 'none';
    }

    takePicture() {
        if (!this.userMarker) {
            alert("Cannot capture photo: current location unknown.");
            this.closeCamera();
            return;
        }

        const video = this.dom.cameraFeed;
        const canvas = this.dom.photoCanvas;
        
        // Set canvas dimensions based on video, but cap at a max width for performance/storage
        const maxWidth = 800; 
        const scale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.7); // Compress to JPEG, 70% quality

        const { lat, lng } = this.userMarker.getLatLng();

        const photoData = {
            id: String(Date.now()) + '_' + Math.random().toString(36).substr(2, 9), // Unique ID
            lat,
            lng,
            timestamp: Date.now(),
            imageDataUrl
        };

        this.currentTrailPhotos.push(photoData);
        this.updateStatus(`Photo captured! (${this.currentTrailPhotos.length} total for this trail)`);
        this.closeCamera();
    }

    viewPhoto(imageDataUrl) {
        this.dom.photoDisplay.src = imageDataUrl;
        this.dom.photoViewModal.style.display = 'flex';
    }

    closePhotoViewModal() {
        this.dom.photoDisplay.src = ''; // Clear image to free memory
        this.dom.photoViewModal.style.display = 'none';
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