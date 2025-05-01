 // Check for dark mode preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.classList.add('dark');
            }

            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
                if (event.matches) {
                    document.documentElement.classList.add('dark');
                } else {
                    document.documentElement.classList.remove('dark');
                }
            });

            // App Data (in-memory storage)
            const appData = {
                currentUser: null,
                rooms: [],
                attendance: []
            };

            // DOM Elements
            const loginSection = document.getElementById('login-section');
            const adminPanel = document.getElementById('admin-panel');
            const studentPanel = document.getElementById('student-panel');
            const logoutContainer = document.getElementById('logout-container');
            const statusMessage = document.getElementById('status-message');

            // Login Functionality
            document.getElementById('login-btn').addEventListener('click', function () {
                const userId = document.getElementById('user-id').value.trim();
                const userRole = document.getElementById('user-role').value;

                if (!userId) {
                    showStatus('Please enter your ID', 'error');
                    return;
                }

                appData.currentUser = {
                    id: userId,
                    role: userRole
                };

                loginSection.classList.add('hidden');
                logoutContainer.classList.remove('hidden');

                if (userRole === 'admin') {
                    adminPanel.classList.remove('hidden');
                    getCurrentLocation('admin');
                } else {
                    studentPanel.classList.remove('hidden');
                    refreshAvailableClasses();
                    getCurrentLocation('student');
                }

                showStatus(`Logged in as ${userRole}`, 'success');
            });

            // Logout Functionality
            document.getElementById('logout-btn').addEventListener('click', function () {
                appData.currentUser = null;

                loginSection.classList.remove('hidden');
                adminPanel.classList.add('hidden');
                studentPanel.classList.add('hidden');
                logoutContainer.classList.add('hidden');
                statusMessage.classList.add('hidden');

                document.getElementById('user-id').value = '';
            });

            // Admin: Set Location Functionality
            document.getElementById('set-location-btn').addEventListener('click', function () {
                const roomName = document.getElementById('room-name').value.trim();
                const courseName = document.getElementById('course-name').value.trim();
                const radius = parseInt(document.getElementById('radius').value) || 50;

                if (!roomName || !courseName) {
                    showStatus('Please enter both room and course names', 'error');
                    return;
                }

                getCurrentLocation('admin', (position) => {
                    const { latitude, longitude } = position.coords;

                    const room = {
                        id: Date.now().toString(),
                        roomName,
                        courseName,
                        latitude,
                        longitude,
                        radius,
                        createdBy: appData.currentUser.id,
                        timestamp: new Date().toISOString()
                    };

                    appData.rooms.push(room);
                    showStatus(`Location set for ${roomName}`, 'success');

                    // Clear form
                    document.getElementById('room-name').value = '';
                    document.getElementById('course-name').value = '';

                    refreshAdminAttendanceList();
                });
            });

            // Get Current Location
            function getCurrentLocation(context, callback) {
                if (!navigator.geolocation) {
                    showStatus('Geolocation is not supported by your browser', 'error');
                    return;
                }

                const options = {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                };

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude, accuracy } = position.coords;

                        if (context === 'admin') {
                            document.getElementById('admin-coordinates').textContent =
                                `Latitude: ${latitude.toFixed(6)}, Longitude: ${longitude.toFixed(6)}, Accuracy: ${accuracy.toFixed(1)}m`;
                        }

                        if (callback) callback(position);
                    },
                    (error) => {
                        let errorMsg = 'Unable to retrieve your location';

                        switch (error.code) {
                            case error.PERMISSION_DENIED:
                                errorMsg = 'Location access denied. Please grant location permission.';
                                break;
                            case error.POSITION_UNAVAILABLE:
                                errorMsg = 'Location information is unavailable.';
                                break;
                            case error.TIMEOUT:
                                errorMsg = 'Location request timed out.';
                                break;
                        }

                        showStatus(errorMsg, 'error');
                    },
                    options
                );
            }

            // Calculate Distance Between Coordinates (Haversine formula)
            function calculateDistance(lat1, lon1, lat2, lon2) {
                const R = 6371e3; // Earth radius in meters
                const φ1 = lat1 * Math.PI / 180;
                const φ2 = lat2 * Math.PI / 180;
                const Δφ = (lat2 - lat1) * Math.PI / 180;
                const Δλ = (lon2 - lon1) * Math.PI / 180;

                const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                    Math.cos(φ1) * Math.cos(φ2) *
                    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

                return R * c; // Distance in meters
            }

            // Refresh Available Classes for Students
            function refreshAvailableClasses() {
                const container = document.getElementById('available-classes');

                if (appData.rooms.length === 0) {
                    container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 italic">No classes available</p>';
                    return;
                }

                let html = '';

                appData.rooms.forEach(room => {
                    const alreadyAttended = appData.attendance.some(a =>
                        a.roomId === room.id && a.studentId === appData.currentUser.id
                    );

                    html += `
                    <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-md">
                        <h3 class="font-bold">${room.courseName}</h3>
                        <p class="text-sm mb-2">Room: ${room.roomName}</p>
                        <button 
                            class="check-in-btn ${alreadyAttended ? 'bg-green-500' : 'bg-primary'} text-white py-2 px-4 rounded-md hover:bg-opacity-90 transition-all w-full"
                            data-room-id="${room.id}"
                            ${alreadyAttended ? 'disabled' : ''}
                        >
                            ${alreadyAttended ? 'Attendance Recorded' : 'Check In'}
                        </button>
                    </div>
                `;
                });

                container.innerHTML = html;

                // Add event listeners to check-in buttons
                document.querySelectorAll('.check-in-btn').forEach(btn => {
                    if (!btn.disabled) {
                        btn.addEventListener('click', handleCheckIn);
                    }
                });
            }

            // Handle Student Check-In
            function handleCheckIn(e) {
                const roomId = e.target.getAttribute('data-room-id');
                const room = appData.rooms.find(r => r.id === roomId);

                if (!room) {
                    showStatus('Class not found', 'error');
                    return;
                }

                // Add loading indicator
                e.target.classList.add('loading');
                e.target.disabled = true;

                getCurrentLocation('student', (position) => {
                    const { latitude, longitude } = position.coords;

                    // Calculate distance between student and lecture room
                    const distance = calculateDistance(
                        latitude, longitude,
                        room.latitude, room.longitude
                    );

                    e.target.classList.remove('loading');

                    if (distance <= room.radius) {
                        // Student is within the allowed radius
                        const attendanceRecord = {
                            id: Date.now().toString(),
                            roomId: room.id,
                            studentId: appData.currentUser.id,
                            timestamp: new Date().toISOString(),
                            distance: distance.toFixed(1)
                        };

                        appData.attendance.push(attendanceRecord);

                        e.target.textContent = 'Attendance Recorded';
                        e.target.classList.remove('bg-primary');
                        e.target.classList.add('bg-green-500');

                        showStatus(`Attendance recorded for ${room.courseName}`, 'success');

                        refreshStudentAttendanceList();
                    } else {
                        // Student is too far from the lecture room
                        e.target.disabled = false;
                        showStatus(`You're ${distance.toFixed(1)}m away from the classroom. Must be within ${room.radius}m to check in.`, 'error');
                    }
                });
            }

            // Refresh Admin Attendance List
            function refreshAdminAttendanceList() {
                const container = document.getElementById('admin-attendance-list');

                if (appData.attendance.length === 0) {
                    container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 italic">No attendance records yet</p>';
                    return;
                }

                let html = '';

                // Group by room/course
                const groupedByRoom = {};

                appData.attendance.forEach(record => {
                    const room = appData.rooms.find(r => r.id === record.roomId);
                    if (!room) return;

                    if (!groupedByRoom[record.roomId]) {
                        groupedByRoom[record.roomId] = {
                            room,
                            students: []
                        };
                    }

                    groupedByRoom[record.roomId].students.push({
                        studentId: record.studentId,
                        timestamp: new Date(record.timestamp),
                        distance: record.distance
                    });
                });

                // Create HTML for each room
                Object.values(groupedByRoom).forEach(group => {
                    html += `
                    <div class="mb-4">
                        <h3 class="font-bold">${group.room.courseName} (${group.room.roomName})</h3>
                        <p class="text-sm mb-2">Total Attendance: ${group.students.length}</p>
                        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="border-b dark:border-gray-600">
                                        <th class="text-left py-2">Student ID</th>
                                        <th class="text-left py-2">Time</th>
                                        <th class="text-left py-2">Distance</th>
                                    </tr>
                                </thead>
                                <tbody>
                `;

                    // Sort students by check-in time
                    group.students.sort((a, b) => a.timestamp - b.timestamp);

                    group.students.forEach(student => {
                        html += `
                        <tr class="border-b dark:border-gray-600">
                            <td class="py-2">${student.studentId}</td>
                            <td class="py-2">${formatDate(student.timestamp)}</td>
                            <td class="py-2">${student.distance}m</td>
                        </tr>
                    `;
                    });

                    html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
                });

                container.innerHTML = html;
            }

            // Refresh Student Attendance List
            function refreshStudentAttendanceList() {
                const container = document.getElementById('student-attendance-list');

                const studentAttendance = appData.attendance.filter(
                    a => a.studentId === appData.currentUser.id
                );

                if (studentAttendance.length === 0) {
                    container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 italic">No attendance records yet</p>';
                    return;
                }

                let html = '';

                studentAttendance.forEach(record => {
                    const room = appData.rooms.find(r => r.id === record.roomId);
                    if (!room) return;

                    const timestamp = new Date(record.timestamp);

                    html += `
                    <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                        <h3 class="font-medium">${room.courseName}</h3>
                        <p class="text-sm">Room: ${room.roomName}</p>
                        <p class="text-sm">Time: ${formatDate(timestamp)}</p>
                    </div>
                `;
                });

                container.innerHTML = html;
            }

            // Format Date
            function formatDate(date) {
                return date.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }

            // Show Status Message
            function showStatus(message, type) {
                statusMessage.textContent = message;
                statusMessage.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'bg-red-100', 'text-red-800');

                if (type === 'success') {
                    statusMessage.classList.add('bg-green-100', 'text-green-800', 'dark:bg-green-900', 'dark:text-green-100');
                } else if (type === 'error') {
                    statusMessage.classList.add('bg-red-100', 'text-red-800', 'dark:bg-red-900', 'dark:text-red-100');
                }

                // Auto-hide after 5 seconds
                setTimeout(() => {
                    statusMessage.classList.add('hidden');
                }, 5000);
            }
