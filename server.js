const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(__dirname));

let sensorHistory = [];
let totalCount = 0;
let lastValue = null;
let alerts = [];

const ADMIN_USER = 'admin';
const ADMIN_PASS = '1234';

// PC'den veri alan endpoint
app.post('/api/veri', (req, res) => {
  const { deger, algilandi, zaman } = req.body;
  const kayit = { zaman: zaman || new Date().toISOString(), deger, algilandi };
  lastValue = deger;
  sensorHistory.unshift(kayit);
  if (sensorHistory.length > 500) sensorHistory.pop();
  if (algilandi) {
    totalCount++;
    io.emit('urun-gecti', { toplam: totalCount, zaman: kayit.zaman, deger });
  }
  io.emit('sensor-data', kayit);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'Hatalı giriş' });
  }
});

app.get('/api/durum', (req, res) => {
  res.json({ bagli: true, toplamUrun: totalCount, sonDeger: lastValue, sonGuncelleme: new Date().toISOString() });
});

app.get('/api/gecmis', (req, res) => {
  res.json(sensorHistory.slice(0, 100));
});

app.post('/api/sifirla', (req, res) => {
  sensorHistory = [];
  totalCount = 0;
  lastValue = null;
  alerts = [];
  io.emit('reset');
  res.json({ ok: true });
});

app.get('/api/istatistik', (req, res) => {
  const now = Date.now();
  const son1dk = sensorHistory.filter(h => h.algilandi && now - new Date(h.zaman).getTime() < 60000).length;
  const son1saat = sensorHistory.filter(h => h.algilandi && now - new Date(h.zaman).getTime() < 3600000).length;
  res.json({ son1dk, son1saat, toplam: totalCount, bagli: true });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log('Railway sunucu hazır: ' + PORT));
