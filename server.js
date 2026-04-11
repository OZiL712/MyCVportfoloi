const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const UAParser = require('ua-parser-js');

let admin = null;
try {
    admin = require('firebase-admin');
} catch (e) {
    console.log("⏳ جاري تثبيت حزم Firebase، الخادم سيعمل دونه حالياً...");
}

const app = express();
const PORT = process.env.PORT || 3000;

// Use /tmp for Vercel because its root filesystem is Read-Only
const DB_FILE = process.env.VERCEL ? '/tmp/visitors.json' : path.join(__dirname, 'visitors.json');
const ADMIN_SECRET_PATH = '/admin-secret-123';
const ADMIN_SECRET_KEY = 'MY_SECRET_KEY';

// --- Firebase Initialization ---
let db = null;
try {
    if (admin) {
        const serviceAccount = require('./serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log("✅ اتصل بقاعدة بيانات Firebase بنجاح (Firestore)!");
    }
} catch (error) {
    if (admin) {
        console.log("⚠️ لم يتم العثور على 'serviceAccountKey.json' أو فشل تسجيل الدخول لـ Firebase.");
        console.log("⚠️ سيتم استخدام visitors.json المحلي كبديل مؤقت لحين إضافة الملف.");
    }
}

// Initialize the Database File if it doesn't exist (Fallback)
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// Helper to get geolocation
function getGeo(ip) {
    return new Promise((resolve) => {
        http.get(`http://ip-api.com/json/${ip}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({});
                }
            });
        }).on('error', () => resolve({}));
    });
}

// 1. Visit Tracking Middleware
app.use(async (req, res, next) => {
    // We only track requests to the main page to avoid counting CSS/JS/Image requests
    if (req.path === '/' || req.path === '/index.html') {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;
        
        if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
        if (ip === '::1' || ip === '::ffff:127.0.0.1') ip = '127.0.0.1';

        const parser = new UAParser(req.headers['user-agent']);
        const result = parser.getResult();
        const deviceType = result.device.type || 'desktop'; 
        const browserName = result.browser.name || 'Unknown';

        let country = 'Unknown';
        let city = 'Unknown';
        
        if (ip !== '127.0.0.1') {
            const geoData = await getGeo(ip);
            if (geoData.status === 'success') {
                country = geoData.country;
                city = geoData.city || 'Unknown';
            }
        } else {
            country = 'Localhost';
            city = 'Local Machine';
        }

        const visitData = {
            ip: ip,
            country: country,
            city: city,
            deviceType: deviceType,
            browserName: browserName,
            timestamp: new Date().toISOString()
        };

        // --- Store to Firebase if available, otherwise local file ---
        if (db) {
            db.collection('visitors').add(visitData).catch(e => console.error("Firebase write error:", e));
        } else {
            fs.readFile(DB_FILE, (err, data) => {
                if (!err) {
                    try {
                        const visitors = JSON.parse(data);
                        visitors.push(visitData);
                        fs.writeFile(DB_FILE, JSON.stringify(visitors, null, 2), () => {});
                    } catch (e) {}
                }
            });
        }
    }
    next();
});

// 2. Secret Admin Dashboard Serving Route
app.get(ADMIN_SECRET_PATH, (req, res) => {
    if (req.query.key !== ADMIN_SECRET_KEY) {
        return res.status(403).send(`
            <h1 style="text-align: center; font-family: sans-serif; margin-top: 50px;">
                403 Forbidden
            </h1>
        `);
    }
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// 3. Admin Analytics API Route (Used by dashboard)
app.get('/api/analytics', async (req, res) => {
    if (req.query.key !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // --- Read from Firebase if available, otherwise local file ---
    if (db) {
        try {
            const snapshot = await db.collection('visitors').orderBy('timestamp', 'desc').get();
            const visitors = [];
            snapshot.forEach(doc => visitors.push(doc.data()));
            res.setHeader('Content-Type', 'application/json');
            res.json(visitors);
        } catch (error) {
           res.status(500).json({ error: 'Firebase read error' });
        }
    } else {
        fs.readFile(DB_FILE, (err, data) => {
            if (err) return res.status(500).json({ error: 'Database read error' });
            try {
                res.setHeader('Content-Type', 'application/json');
                res.send(data);
            } catch (e) {
                res.status(500).json({ error: 'Database parse error' });
            }
        });
    }
});

// Explicit Home Route for Vercel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 4. Serve the main portfolio files (Static Folder)
app.use(express.static(path.join(__dirname, 'public')));

// Start the Server only if not running on Vercel
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`===============================================`);
        console.log(`🚀 Portfolio Server running on port ${PORT}`);
        console.log(`🌐 Application URL: http://localhost:${PORT}`);
        console.log(`🔒 Admin Dashboard: http://localhost:${PORT}${ADMIN_SECRET_PATH}?key=${ADMIN_SECRET_KEY}`);
        console.log(`===============================================`);
    });
}

// Export for Vercel Serverless
module.exports = app;
