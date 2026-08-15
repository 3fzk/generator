const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qr = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ===== SISTEM SESSION =====
let client = null;
let qrCode = null;
let isReady = false;
let status = 'DISCONNECTED';

// ===== INIT WHATSAPP CLIENT =====
function initClient() {
    if (client) {
        client.destroy();
    }
    
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    client.on('qr', async (qrData) => {
        status = 'WAITING_SCAN';
        qrCode = await qr.toDataURL(qrData);
        console.log('QR Code generated');
    });

    client.on('ready', () => {
        status = 'READY';
        isReady = true;
        qrCode = null;
        console.log('✅ WhatsApp Ready!');
    });

    client.on('disconnected', () => {
        status = 'DISCONNECTED';
        isReady = false;
        client = null;
        console.log('❌ Disconnected');
    });

    client.initialize();
}

// ===== ROUTE WEB =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== API STATUS =====
app.get('/api/status', (req, res) => {
    res.json({
        status: status,
        isReady: isReady,
        qr: qrCode
    });
});

// ===== API REACT GENERATOR =====
app.post('/api/react', async (req, res) => {
    const { channelId, jumlah } = req.body;
    
    if (!isReady || !client) {
        return res.status(400).json({ error: 'Bot belum siap, scan QR dulu!' });
    }

    if (!channelId || !jumlah) {
        return res.status(400).json({ error: 'Channel ID & jumlah wajib diisi!' });
    }

    try {
        const chat = await client.getChatById(`${channelId}@g.us`);
        const messages = await chat.fetchMessages({ limit: 1 });
        
        if (messages.length === 0) {
            return res.status(404).json({ error: 'Tidak ada pesan di channel' });
        }

        const targetMsg = messages[0];
        const emojis = ['🔥', '❤️', '😂', '😱', '👏', '🤯', '💀', '🥶', '😈', '🎯'];
        const results = [];

        for (let i = 0; i < parseInt(jumlah); i++) {
            const emoji = emojis[Math.floor(Math.random() * emojis.length)];
            await targetMsg.react(emoji);
            results.push({ no: i+1, emoji: emoji });
            await delay(100 + Math.random() * 200);
        }

        res.json({
            success: true,
            message: `✅ ${jumlah} react berhasil dikirim!`,
            results: results
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== API MEMBER GENERATOR =====
app.post('/api/member', async (req, res) => {
    const { channelId, jumlah } = req.body;
    
    if (!isReady || !client) {
        return res.status(400).json({ error: 'Bot belum siap!' });
    }

    try {
        const inviteCode = await client.getInviteCode(`${channelId}@g.us`);
        const inviteLink = `https://whatsapp.com/channel/${inviteCode}`;
        
        res.json({
            success: true,
            message: `🔗 Link invite siap! Share ke ${jumlah} orang`,
            inviteLink: inviteLink,
            tips: `Bisa pake panel SMM atau akun dummy buat join`
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== START SERVER =====
app.listen(PORT, () => {
    console.log(`🚀 Server jalan di port ${PORT}`);
    console.log('🔄 Inisialisasi WhatsApp...');
    initClient();
});