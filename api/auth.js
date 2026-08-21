/**
 * Authentication API Routes
 * POST /api/auth/login  — Authenticate and return JWT
 * GET  /api/auth/verify — Verify current JWT is valid
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireAuth } = require('./middleware');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    // Validate username
    if (username !== process.env.ADMIN_USER) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Validate password against bcrypt hash
    const validPassword = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generate JWT (expires in 8 hours)
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { username, role: 'admin' },
      expiresIn: 8 * 60 * 60 // seconds
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/verify
router.get('/verify', requireAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

module.exports = router;
