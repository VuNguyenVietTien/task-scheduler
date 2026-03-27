// Firebase Cloud Messaging Service Worker

// Thêm timestamp để biết SW đã được load khi nào
const loadTime = new Date().toISOString();
console.log('[FCM-SW] Service Worker loaded at: ' + loadTime);

// Import and configure Firebase
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Đảm bảo Firebase chưa được khởi tạo
let firebaseIsInitialized = false;
try {
  if (firebase.apps.length) {
    console.log('[FCM-SW] Firebase already initialized:', firebase.apps.length, 'apps');
    firebaseIsInitialized = true;
  }
} catch (e) {
  console.log('[FCM-SW] Error checking Firebase initialization:', e);
}

if (!firebaseIsInitialized) {
  console.log('[FCM-SW] Initializing Firebase with config...');
  // Initialize the Firebase app in the service worker by passing the generated config
  const firebaseConfig = {
    apiKey: "AIzaSyA6RWMJVsLLScHiRxb99XfmY6a_eQIlCIA",
    authDomain: "projectmanager-e13cb.firebaseapp.com",
    projectId: "projectmanager-e13cb",
    storageBucket: "projectmanager-e13cb.firebasestorage.app",
    messagingSenderId: "801190784027",
    appId: "1:801190784027:web:7e5bfa3bff7a1df14c9cbe",
    measurementId: "G-TY84WR0MKL"
  };
  
  try {
    firebase.initializeApp(firebaseConfig);
    console.log('[FCM-SW] Firebase initialized successfully');
  } catch (e) {
    console.error('[FCM-SW] Firebase initialization error:', e);
  }
}

// Retrieve firebase messaging
const messaging = firebase.messaging();
console.log('[FCM-SW] Firebase messaging retrieved');

// Handle background messages
messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM-SW] 🔴 Background message received:', payload);
  
  // Log detailed payload structure
  console.log('[FCM-SW] Notification:', JSON.stringify(payload.notification || {}));
  console.log('[FCM-SW] Data:', JSON.stringify(payload.data || {}));
  
  // Extract notification data from payload
  let title = 'New notification';
  let body = '';
  let icon = '/favicon.ico';
  
  if (payload.notification) {
    title = payload.notification.title || title;
    body = payload.notification.body || body;
  }
  
  const notificationOptions = {
    body: body,
    icon: icon,
    data: payload.data || {},
    requireInteraction: true,
    badge: '/favicon.ico',
  };
  
  console.log('[FCM-SW] Creating notification with title:', title);
  console.log('[FCM-SW] Notification options:', JSON.stringify(notificationOptions));

  return self.registration.showNotification(title, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[FCM-SW] 🔔 Notification clicked:', event);
  console.log('[FCM-SW] Notification data:', JSON.stringify(event.notification.data || {}));
  
  event.notification.close();
  const data = event.notification.data || {};
  
  // Determine URL to navigate to
  let url = '/';
  if (data) {
    console.log('[FCM-SW] Processing notification data for navigation');
    // Try to get task and project ID (handle both camelCase and snake_case)
    const taskId = data.task_id || data.taskId;
    const projectId = data.project_id || data.projectId;
    
    if (projectId && taskId) {
      console.log('[FCM-SW] Navigating to task detail:', projectId, taskId);
      url = `/projects/${projectId}/tasks/${taskId}`;
    } else if (data.notification_type === 'NEW_NOTIFICATION' || 
              data.notificationType === 'NEW_NOTIFICATION') {
      console.log('[FCM-SW] Navigating to notifications page');
      url = '/notifications';
    }
  }
  
  console.log('[FCM-SW] Will navigate to URL:', url);
  
  // Open/focus the client tab or open a new window
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(function(clientList) {
      console.log('[FCM-SW] Found', clientList.length, 'clients');
      
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        console.log('[FCM-SW] Checking client:', client.url);
        
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          console.log('[FCM-SW] Focusing existing client and navigating');
          return client.focus().then(function(client) {
            client.navigate(url);
          });
        }
      }
      
      console.log('[FCM-SW] Opening new window');
      return clients.openWindow(url);
    })
  );
});

// Add handler for push events (older API that might be used by some browsers)
self.addEventListener('push', function(event) {
  console.log('[FCM-SW] Push event received:', event);
  
  if (!event.data) {
    console.log('[FCM-SW] Push event has no data');
    return;
  }
  
  try {
    const payload = event.data.json();
    console.log('[FCM-SW] Push event data parsed:', payload);
    
    // Extract notification data from payload
    let title = payload.notification?.title || 'New notification';
    let body = payload.notification?.body || '';
    
    // Show notification
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body,
        icon: '/favicon.ico',
        data: payload.data || {},
      })
    );
  } catch (e) {
    console.error('[FCM-SW] Error processing push event:', e);
  }
});

// Additional logging for service worker lifecycle
self.addEventListener('install', function(event) {
  console.log('[FCM-SW] Service worker installed');
  // Force activation without waiting for page reload
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[FCM-SW] Service worker activated');
  // Claim clients immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('message', function(event) {
  console.log('[FCM-SW] Message received from client:', event.data);
});

console.log('[FCM-SW] Service worker fully registered and ready for messages'); 