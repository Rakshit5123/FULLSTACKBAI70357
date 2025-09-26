https://k3mpry-8080.bytexl.dev

html:
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ticket Booking System</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    #seats { display: grid; grid-template-columns: repeat(5, 60px); gap: 10px; margin-bottom: 20px; }
    .seat { padding: 15px; text-align: center; border-radius: 8px; cursor: pointer; }
    .available { background-color: #8f8; }
    .locked { background-color: #ff8; }
    .booked { background-color: #f88; cursor: not-allowed; }
    #log { white-space: pre-wrap; background: #eee; padding: 10px; border: 1px solid #aaa; }
  </style>
</head>
<body>
  <h1>Concurrent Ticket Booking</h1>

  <label>User ID: <input id="userId" type="text" value="alice"></label>
  <button onclick="loadSeats()">Refresh Seats</button>

  <div id="seats"></div>

  <h3>Logs:</h3>
  <div id="log"></div>

  <script src="script.js"></script>
</body>
</html>


node.js;
// server.js
const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve index.html & script.js

// Lock expiry in milliseconds (1 min for demo)
const LOCK_EXP_MS = 60000;

// In-memory seats
let seats = [];
const NUM_SEATS = 10;
for (let i = 1; i <= NUM_SEATS; i++) {
  seats.push({
    id: i,
    status: "available", // available | locked | booked
    lockedBy: null,
    lockExpiresAt: null,
    lockTimer: null,
  });
}

function cleanupExpiredLock(seat) {
  if (seat.status === "locked" && Date.now() > seat.lockExpiresAt) {
    if (seat.lockTimer) clearTimeout(seat.lockTimer);
    seat.status = "available";
    seat.lockedBy = null;
    seat.lockExpiresAt = null;
    seat.lockTimer = null;
  }
}

function getSeat(id) {
  const seat = seats.find((s) => s.id === id);
  if (!seat) return null;
  cleanupExpiredLock(seat);
  return seat;
}

function lockSeat(seat, userId) {
  cleanupExpiredLock(seat);
  if (seat.status === "booked") return { ok: false, msg: "Seat already booked." };
  if (seat.status === "locked") return { ok: false, msg: `Seat locked by ${seat.lockedBy}.` };

  seat.status = "locked";
  seat.lockedBy = userId;
  seat.lockExpiresAt = Date.now() + LOCK_EXP_MS;
  if (seat.lockTimer) clearTimeout(seat.lockTimer);
  seat.lockTimer = setTimeout(() => {
    if (seat.status === "locked" && Date.now() >= seat.lockExpiresAt) {
      seat.status = "available";
      seat.lockedBy = null;
      seat.lockExpiresAt = null;
      seat.lockTimer = null;
      console.log(`Auto-released seat ${seat.id}`);
    }
  }, LOCK_EXP_MS + 100);

  return { ok: true, msg: `Seat ${seat.id} locked for ${userId}.` };
}

function confirmSeat(seat, userId) {
  cleanupExpiredLock(seat);
  if (seat.status === "booked") return { ok: false, msg: "Seat already booked." };
  if (seat.status !== "locked") return { ok: false, msg: "Seat is not locked." };
  if (seat.lockedBy !== userId) return { ok: false, msg: `Seat locked by ${seat.lockedBy}.` };

  seat.status = "booked";
  if (seat.lockTimer) clearTimeout(seat.lockTimer);
  seat.lockedBy = null;
  seat.lockExpiresAt = null;
  seat.lockTimer = null;
  return { ok: true, msg: `Seat ${seat.id} booked by ${userId}.` };
}

// Routes
app.get("/api/seats", (req, res) => {
  seats.forEach(cleanupExpiredLock);
  res.json(seats);
});

app.post("/api/seats/:id/lock", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: "userId required" });
  const seat = getSeat(parseInt(req.params.id));
  if (!seat) return res.status(404).json({ msg: "Seat not found" });
  const result = lockSeat(seat, userId);
  res.status(result.ok ? 200 : 409).json(result);
});

app.post("/api/seats/:id/confirm", (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ msg: "userId required" });
  const seat = getSeat(parseInt(req.params.id));
  if (!seat) return res.status(404).json({ msg: "Seat not found" });
  const result = confirmSeat(seat, userId);
  res.status(result.ok ? 200 : 409).json(result);
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
